# Assinatura digital da Ficha de EPI

A ficha de EPI sai do sistema em duas camadas de garantia.

## 1. Código de conferência (sempre ativo)

Embaixo de cada assinatura do funcionário o PDF imprime um código de 40
caracteres e a data/hora com segundos. O código é o SHA-256 de
`id|created_at|assinatura` da entrega — recalculável a qualquer momento a
partir do banco, então serve para provar que aquela linha da ficha
corresponde a um registro real e não foi remontada depois.

Isso não depende de certificado nenhum e funciona hoje.

## 2. Assinatura PAdES no PDF (depende de certificado)

**Em produção desde 14/09/2026, com e-CNPJ A1 da AC Certisign RFB G5.**
Conferido em <https://validar.iti.gov.br>: *"Assinatura aprovada"*, com o selo
**Assinatura Eletrônica Qualificada** (MP 2.200-2/01 e Lei 14.063/20).

A função `supabase/functions/assinar-pdf` assina o PDF inteiro. Ela lê duas
coisas:

| O quê | Onde | Por quê ali |
| --- | --- | --- |
| `.pfx` em base64, numa linha só | segredo `CERT_A1_PFX_BASE64` **ou** o Vault do banco | colar ~5.400 caracteres no campo do painel falhou três vezes seguidas na configuração real: o valor não era salvo. O Vault aceita ser preenchido por SQL. |
| senha do `.pfx` | segredo `CERT_A1_SENHA` | fica fora do banco de propósito: arquivo e senha no mesmo lugar é o que transforma um vazamento de banco numa assinatura falsificada |

O segredo do painel tem prioridade; o Vault é a reserva, lido pela RPC
`certificado_a1_pfx_base64` — `SECURITY DEFINER`, com `EXECUTE` revogado de
`public`, `anon` e `authenticated` e concedido só à `service_role`, porque
quem lê aquilo assina como a empresa.

Para gravar no Vault:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'CERT_A1_PFX_BASE64'),
  '<base64>', 'CERT_A1_PFX_BASE64', 'Certificado A1 em base64');
```

Enquanto esses secrets não existirem, a função responde
`{ success: false, configuracaoAusente: true }` e o front baixa a ficha sem
assinatura, avisando o usuário. Nada quebra.

Cadastre em **Supabase → Project Settings → Edge Functions → Secrets**.
A chave privada não deve passar por chat, e-mail nem pelo repositório.

## O que o validador vê, e o que o Edge vê

A assinatura sai com `/SubFilter /adbe.pkcs7.detached`, SHA-256, atributos
assinados contentType, signingTime e messageDigest.

O `.pfx` do titular traz só o certificado dele — a cadeia até a AC **não vai
embutida**. O validador do ITI monta a cadeia sozinho e aprovou assim; não há
o que corrigir. Se algum dia um verificador reclamar de cadeia incompleta, o
caminho é embutir o certificado (público) da AC emissora na assinatura.

Leitores que usam o repositório de certificados do Windows — Edge, Chrome —
mostram "Desconhecido" e falam em "certificados pai não encontrados": eles não
trazem as raízes da ICP-Brasil. Não é defeito do documento; no mesmo painel
eles dizem "Documento modificado: Não".

O nome exibido como signatário é o titular do certificado: a razão social do
CNPJ na Receita Federal, escrita pela AC dentro do certificado e protegida
pela assinatura dela. Exibir outro nome exige certificado emitido para outra
empresa. O campo `/Name` do objeto de assinatura, esse sim nosso, declara
"Safety Soluções".

## Qual certificado usar

### A1 ICP-Brasil (pago) — única opção com valor perante terceiros

Comprado numa AC credenciada (Certisign, Serasa, Soluti, Valid, Safeweb).
Passa no <https://validar.iti.gov.br> e tem presunção de veracidade pela
MP 2.200-2, Art. 10, §1. Preço na faixa de R$ 200–400/ano para e-CNPJ A1.

Alguns bancos (Sicoob, Sicredi, Banco do Brasil, Banrisul) já ofereceram
e-CNPJ A1 sem custo para correntista PJ — vale checar antes de comprar.

### Certificado gov.br (gratuito) — NÃO serve para o servidor

É ICP-Brasil de verdade, mas a chave privada fica no HSM do governo. O
portal só entrega o `.crt` público; não existe `.pfx` para exportar. Só
assina manualmente em <https://assinador.iti.br>.

### Auto-assinado (gratuito) — integridade sim, identidade não

> Foi o que rodou até 14/09/2026, como ponte até o A1 chegar. Continua no
> repositório para quem precisar testar o caminho de assinatura sem gastar
> certificado.

Gerado com `scripts/gerar-certificado-autoassinado.sh`. Produz uma
assinatura PAdES criptográfica real: alterar um byte do PDF depois de
assinado quebra a assinatura e o Adobe Reader acusa. Vale entre as partes
(MP 2.200-2, Art. 10, §2).

O que ele **não** dá: o `validar.iti.gov.br` rejeita e o Adobe mostra
"identidade do signatário não verificada", porque a cadeia não sobe até a
raiz da ICP-Brasil.

```bash
# usa o MEI da 3M Cursos e Treinamentos, só pede a senha
./scripts/gerar-certificado-autoassinado.sh

# ou para outra empresa
./scripts/gerar-certificado-autoassinado.sh \
  --cnpj 12.345.678/0001-95 \
  --razao-social "OUTRA EMPRESA" \
  --nome-fantasia "OUTRA"
```

O script já vem com o CNPJ `51.489.453/0001-64` como padrão, conferido no
CCMEI. Ele valida os dígitos verificadores, grava o CNPJ no OID
`2.16.76.1.3.3` (o mesmo que a ICP-Brasil usa) e cospe o `.pfx` e o
`.base64` prontos.

O signatário sai assim no Adobe Reader:

```
O  = 3M CURSOS E TREINAMENTOS
CN = 51.489.453 JOSE IVAN HOLANDA DE MELO JUNIOR:51489453000164
```

> O `.pfx` é exportado com PBE-SHA1-3DES de propósito. O `node-forge`, que
> o `@signpdf/signer-p12` usa por baixo, não lê PKCS#12 cifrado com
> AES-256/PBKDF2 — que é o padrão do OpenSSL 3. Com o padrão do OpenSSL o
> arquivo é gerado normalmente, mas a função não consegue abrir.

## Aviso de vencimento

Um A1 vale um ano, e no dia em que ele expira nada aparenta ter mudado: a
ficha continua sendo gerada e baixada, só volta a sair sem assinatura
reconhecida pelo validador do ITI.

Por isso a função `assinar-pdf` devolve, junto com o PDF, o titular e o
vencimento do certificado:

```json
{ "success": true, "pdfBase64": "...", "certificado": { "titular": "...", "validoAte": "2027-09-08T19:44:37.000Z" } }
```

O front avalia isso em `src/lib/validadeCertificado.ts` e mostra um toast a
partir de **30 dias** antes (`DIAS_DE_AVISO`), e um toast vermelho depois de
vencido.

Dois cuidados que o código toma:

- **O certificado lido é o do titular, não o da AC.** Um `.pfx` da ICP-Brasil
  traz a cadeia inteira dentro dele; pegar o primeiro certificado do arquivo
  mostraria a validade da AC Soluti, que vence em 2029, e o aviso nunca
  dispararia. `escolherCertificado.ts` acha a folha pela regra "não é emissor
  de nenhum outro".
- **Sem certeza, sem aviso.** Se não der para abrir o `.pfx` ou identificar a
  folha, a resposta vem com `certificado: null` e o front não diz nada. Um
  "está tudo em dia" falso seria pior do que silêncio.

## Trocar de certificado depois

Basta substituir os dois valores — o `.pfx` em base64 e a senha. As fichas já
emitidas continuam válidas com a assinatura antiga; as novas saem com a nova.
Não há migração. O certificado em uso vence em **14/09/2027**.

Para gerar o base64 **sem passar por editor de texto**:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\cert.pfx")) | Set-Clipboard
```

O resultado começa com `MIIP` — todo PKCS#12 começa assim — e tem alguns
milhares de caracteres. Se não começar com `MIIP`, não é o certificado.

> **Nunca abra um `.pfx` no Bloco de Notas para copiar o conteúdo.** É
> binário: salvar assim destrói o arquivo. Aconteceu na configuração real —
> 137 bytes trocados, com `00` e `07` virando espaço e `LF` virando `CR`, e o
> OpenSSL já não conseguia ler a estrutura.

A senha do certificado anterior não abre o novo. Se ela ficar para trás, a
função responde exatamente isso, em vez do "MAC could not be verified" do
node-forge.
