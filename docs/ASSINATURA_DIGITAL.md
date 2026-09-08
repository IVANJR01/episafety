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

A função `supabase/functions/assinar-pdf` assina o PDF inteiro no padrão
PAdES. Ela lê dois secrets:

| Secret | Conteúdo |
| --- | --- |
| `CERT_A1_PFX_BASE64` | o arquivo `.pfx` inteiro em base64, numa linha só |
| `CERT_A1_SENHA` | a senha do `.pfx` |

Enquanto esses secrets não existirem, a função responde
`{ success: false, configuracaoAusente: true }` e o front baixa a ficha sem
assinatura, avisando o usuário. Nada quebra.

Cadastre em **Supabase → Project Settings → Edge Functions → Secrets**.
A chave privada não deve passar por chat, e-mail nem pelo repositório.

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

## Trocar de certificado depois

Basta substituir os dois secrets. As fichas já emitidas continuam válidas
com a assinatura antiga; as novas saem com a nova. Não há migração.
