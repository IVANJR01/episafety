# Automação de WhatsApp com IA — sem n8n

A automação roda dentro deste projeto: o WhatsApp chama uma Edge Function, ela
grava no Postgres, pergunta para a IA e responde. Não existe orquestrador no
meio, e não há nada para manter ligado numa terceira conta.

```text
        CLIENTE  ──►  WhatsApp  ──►  WhatsApp Cloud API (Meta)
                                            │  webhook (POST assinado)
                                            ▼
                            supabase/functions/whatsapp-webhook
                                   │                    │
                        whatsapp_* (Postgres)     OpenAI / Gemini
                                   │                    │
                                   └────────┬───────────┘
                                            ▼
                                  Graph API  ──►  WhatsApp  ──►  CLIENTE
```

## Uma correção de rota, antes de tudo

A ideia original punha o backend da automação na Vercel. Aqui, **não**: a Vercel
deste projeto serve o front (Vite/React, `outputDirectory: dist`), e o backend
já é o Supabase — banco, RLS, Storage, Auth e dezoito Edge Functions.

Pôr o webhook do WhatsApp na Vercel significaria a function precisar da
`SUPABASE_SERVICE_ROLE_KEY` em mais um lugar, um segundo conjunto de secrets
para manter, e um salto de rede a mais em cada mensagem. A Edge Function fica
ao lado do banco que ela lê, usa o mesmo `_shared/` (CORS, rate limit, escolha
de IA) e é publicada pelo mesmo comando das outras. A arquitetura é a mesma que
você descreveu, com uma peça a menos.

## O que existe agora

| Arquivo | O que faz |
| --- | --- |
| `supabase/migrations/20260917120000_whatsapp_automacao.sql` | `whatsapp_config`, `whatsapp_contatos`, `whatsapp_mensagens` + a busca de cliente por telefone |
| `supabase/functions/_shared/whatsapp.ts` | Leitura do payload da Meta, conferência de assinatura, envio (texto e template) |
| `supabase/functions/whatsapp-webhook/index.ts` | Recebe, grava, decide, chama a IA, responde |
| `supabase/functions/whatsapp-enviar/index.ts` | Envio a partir do sistema (texto livre e template) |
| `supabase/functions/whatsapp-templates/index.ts` | Lista na tela os templates que a Meta aprovou |
| `src/test/whatsappWebhook.test.ts` | Testes das partes que não dependem de rede |
| `src/pages/comercial/Atendimento.tsx` | A tela: conversas, histórico, assumir do robô e responder |
| `src/components/comercial/EnviarTemplateDialog.tsx` | Escolher, preencher e enviar um template, com prévia |
| `src/lib/whatsappDados.ts` / `src/lib/janelaWhatsapp.ts` / `src/lib/templatesWhatsapp.ts` | Acesso às tabelas, a regra das 24h e a leitura dos templates |

A IA é a que o projeto já usa: `_shared/provedorIa.ts` — OpenAI quando a
`OPENAI_API_KEY` existe, Gemini como reserva. Não há chave nova de IA para
configurar.

---

## Passo a passo

### 1. Criar o app na Meta

1. Entre em [developers.facebook.com](https://developers.facebook.com/apps) →
   **Criar app** → tipo **Empresa**.
2. No painel do app, adicione o produto **WhatsApp**.
3. Em *WhatsApp → Introdução*, a Meta já dá um **número de teste** e um
   **token temporário (24h)**. Dá para testar tudo com ele antes de cadastrar o
   número da empresa.
4. Anote dois identificadores da mesma tela — nenhum dos dois é o telefone:
   - **Identificação do número de telefone** (`phone_number_id`): a linha.
   - **Identificação da conta do WhatsApp Business** (`waba_id`): a conta. É por
     ela que se pergunta quais templates estão aprovados.

### 2. Os três segredos

| Secret | De onde sai |
| --- | --- |
| `WHATSAPP_TOKEN` | *WhatsApp → Configuração da API*. O temporário serve para testar; para valer, gere um **token de usuário do sistema** permanente em *Configurações do negócio → Usuários do sistema*, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management` |
| `WHATSAPP_APP_SECRET` | *Configurações do app → Básico → Chave secreta do app* |
| `WHATSAPP_VERIFY_TOKEN` | Você inventa. Qualquer texto longo e aleatório; só serve para a Meta provar que a URL é sua no momento do cadastro |

Gravando no Supabase:

```sh
supabase secrets set \
  WHATSAPP_TOKEN="EAAG..." \
  WHATSAPP_APP_SECRET="a1b2c3..." \
  WHATSAPP_VERIFY_TOKEN="uma-frase-longa-que-so-voce-sabe" \
  --project-ref estmuducawmftvpbeutm
```

> O `WHATSAPP_APP_SECRET` não é opcional. O webhook é um endereço público, e a
> assinatura HMAC é o único controle de acesso dele. Sem o secret configurado, a
> function recusa **todos** os POSTs de propósito — falhar fechado é o certo
> aqui.

### 3. Publicar o banco e as functions

```sh
supabase db push --project-ref estmuducawmftvpbeutm
supabase functions deploy whatsapp-webhook   --project-ref estmuducawmftvpbeutm
supabase functions deploy whatsapp-enviar    --project-ref estmuducawmftvpbeutm
supabase functions deploy whatsapp-templates --project-ref estmuducawmftvpbeutm
```

O `verify_jwt = false` do webhook já está no `supabase/config.toml` — a Meta não
tem como mandar um JWT do Supabase.

### 4. Cadastrar a URL na Meta

Em *WhatsApp → Configuração → Webhook → Editar*:

- **URL de retorno de chamada**:
  `https://estmuducawmftvpbeutm.supabase.co/functions/v1/whatsapp-webhook`
- **Token de verificação**: o mesmo `WHATSAPP_VERIFY_TOKEN`.

Clique em **Verificar e salvar**. Depois, em **Gerenciar**, assine o campo
**messages** — sem essa assinatura a Meta cadastra a URL e não manda nada.

### 5. Ligar a linha à empresa

O webhook descobre de quem é a conversa pelo `phone_number_id`. Enquanto não há
tela para isso, é um INSERT (SQL Editor do Supabase):

```sql
insert into public.whatsapp_config (empresa_id, phone_number_id, waba_id, numero_exibicao, automacao_ativa, prompt_extra, saudacao)
values (
  (select id from public.empresa_config order by created_at limit 1),
  '123456789012345',            -- o phone_number_id do passo 1
  '102290129340398',            -- o waba_id do passo 1 (para os templates)
  '+55 85 99999-9999',
  true,                         -- a automação começa desligada; true liga
  'Vendemos PGR, PCMSO, LTCAT, treinamentos de NR-35, NR-33 e NR-10, e gestão de EPI pelo EPISafety. Atendemos o Ceará. Orçamento sai em até 24h úteis. Nunca informe preço fechado: diga que a equipe confirma.',
  null
);
```

Esse INSERT é a única parte que ainda pede SQL, e é de propósito: o
`phone_number_id` é único no banco inteiro, então deixar qualquer empresa
cadastrar o seu deixaria uma tomar a linha da outra. Depois dele, **tudo o mais
se faz pela tela** — ligar e desligar a automação, a saudação e as instruções da
IA ficam em *Comercial → Atendimento WhatsApp → Configuração*.

O `prompt_extra` é o que transforma o atendente genérico no atendente da sua
operação. Vale escrever com calma: serviços, região, o que responder sobre
prazo, o que nunca prometer.

### 5.1. Liberar o acesso

O atendimento é um módulo de permissão próprio (`atendimento`). Quem já tinha
acesso ao Comercial **não** ganha a tela automaticamente: libere em *Cadastro →
Usuários Liberados*, marcando "Atendimento WhatsApp". Conversa de cliente é dado
sensível — é melhor liberar para quem precisa do que para todo mundo por
descuido.

### 6. Testar

Mande uma mensagem do seu celular para o número de teste (no modo de teste, seu
número precisa estar na lista de destinatários permitidos, em *WhatsApp →
Configuração da API*).

```sh
# acompanhe ao vivo
supabase functions logs whatsapp-webhook --project-ref estmuducawmftvpbeutm
```

```sql
-- e confira o que ficou gravado
select direcao, origem, texto, status, created_at
from public.whatsapp_mensagens
order by created_at desc
limit 10;
```

---

## Como a automação decide responder

Em ordem, para cada mensagem recebida:

1. **Assinatura confere?** Não → 401, nada acontece.
2. **`phone_number_id` conhecido?** Não → registra no log e ignora.
3. **Mensagem já gravada?** Sim → é reenvio da Meta, ignora. (A Meta reenvia o
   mesmo POST quando não recebe `200` em ~10s; o `wa_message_id` único no banco
   é o que impede o cliente de receber a mesma resposta duas vezes.)
4. **`automacao_ativa` na empresa e no contato?** Não → só grava.
5. **A pessoa pediu atendente?** Sim → desliga a automação daquele contato,
   avisa que vai chamar alguém e para. A IA não volta sozinha: quem assumiu
   religa o `automacao_ativa` do contato.
6. **Passou do limite de 20 mensagens/minuto daquele número?** Sim → para.
7. Manda para a IA as últimas 12 mensagens da conversa + o que o sistema sabe
   do cliente, e responde.

Se a IA falhar, o cliente recebe um aviso de instabilidade e a conversa é
entregue a uma pessoa — silêncio depois do visto é o pior desfecho possível.

## A regra das 24 horas

A Meta só aceita **texto livre até 24h depois da última mensagem do cliente**.
Passou disso, só **template aprovado** por ela. Não é detalhe: é o motivo de
campanhas de WhatsApp precisarem de template, e a resposta automática, não.

A `whatsapp-enviar` confere a janela antes de gastar a chamada e devolve
`409 janela_24h_fechada` quando é o caso. **Na tela isso já está resolvido**: com
a janela fechada, no lugar do campo de escrita aparece o botão *Escolher
template* (ver abaixo). Por código, a chamada é esta:

```ts
await supabase.functions.invoke("whatsapp-enviar", {
  body: {
    telefone: "85988887777",
    template: { nome: "aviso_vencimento", idioma: "pt_BR", parametros: ["NR-35", "12/10/2026"] },
  },
});
```

Dentro da janela, texto livre:

```ts
await supabase.functions.invoke("whatsapp-enviar", {
  body: { telefone: "85988887777", texto: "Bom dia! Segue a proposta que combinamos." },
});
```

## Custo

- **WhatsApp**: as conversas iniciadas pelo cliente têm uma faixa gratuita
  mensal; as iniciadas pela empresa (template) são cobradas por conversa, na
  tabela da Meta para o Brasil.
- **IA**: uma chamada por mensagem respondida, com teto de 400 tokens de saída.
  Com `gpt-4o-mini` o custo por conversa fica em centavos; a variável
  `OPENAI_MODEL` troca o modelo sem republicar nada.
- **Supabase**: Edge Function e as três tabelas cabem no plano que o projeto já
  usa.

## A tela de atendimento

*Comercial → Atendimento WhatsApp* (`/comercial/atendimento`).

À esquerda, as conversas, da mais recente para a mais antiga, com busca por nome
ou número. À direita, o histórico e o campo de resposta. As mensagens chegam
sozinhas enquanto a tela estiver aberta — Realtime, o mesmo canal por tabela que
o resto do sistema usa.

Três coisas que a tela deixa explícitas, porque errar nelas é caro:

- **Quem está respondendo.** Cada conversa mostra `IA respondendo` ou
  `Você responde`. O botão ao lado assume a conversa, e assumir **desliga a IA
  naquele contato** — senão os dois responderiam a mesma mensagem, e o cliente
  veria duas respostas diferentes. A IA não volta sozinha: quem assumiu devolve
  no mesmo botão.
- **Quem escreveu cada mensagem.** Cada balão enviado diz `IA`, `Automático` ou
  `Você`. Sem isso ninguém sabe o que já foi prometido antes de continuar.
- **A janela de 24h.** Dentro dela, o rodapé mostra quanto falta. Fora dela, o
  campo de escrita **não aparece** — no lugar dele, a explicação de que a Meta
  exige template. Deixar escrever para recusar no envio seria pior: o texto se
  perde e a tentativa já foi contada.

Mensagem que falhou no envio aparece em vermelho, com o motivo que a Meta
devolveu.

### Enviar template pela tela

O botão *Template* fica no alto da conversa, e vira o botão principal quando a
janela de 24h fecha. O diálogo:

1. Lista os templates **aprovados**, consultados na Meta na hora (cache de cinco
   minutos). Template em análise ou pausado não aparece — oferecer um que a Meta
   vai recusar seria descobrir o problema no envio, sem segunda chance, porque a
   conversa está fechada.
2. Cria um campo para cada marcador do texto (`{{1}}`, `{{2}}`, ou `{{nome}}` nos
   templates de parâmetro nomeado). Cabeçalho e corpo têm numeração própria: o
   `{{1}}` de um não é o `{{1}}` do outro, e a tela trata os dois separados.
3. Mostra a **prévia** com os valores no lugar — exatamente o que o cliente vai
   ler. Sem ela, enviar template é enviar no escuro: o texto foi aprovado dentro
   do painel da Meta, não aqui.
4. Só libera o envio com todos os campos preenchidos, porque a Meta recusa
   parâmetro vazio.

O que fica gravado no histórico é o texto já preenchido, não `[template
aviso_vencimento]` — a mensagem que reabriu a conversa precisa ser legível para
quem for continuar o atendimento. O balão vem marcado como `template`.

Se faltar o `waba_id` da empresa, o diálogo diz isso e onde preencher
(*Configuração* da própria tela). Como alternativa para quem tem uma empresa só,
a function aceita o secret `WHATSAPP_WABA_ID`.

**Enviar template não reabre a janela de 24h.** Só a resposta do cliente reabre.

## O que ainda não existe

- **Template com cabeçalho de mídia.** Imagem, vídeo ou documento no cabeçalho
  exigem enviar um arquivo como parâmetro; a tela oferece só os de texto, e
  ignora os outros em vez de montar um envio que a Meta recusaria.
- **Disparo automático de aviso de vencimento por WhatsApp.** A
  `alertas-vencimento-sst` continua mandando e-mail; passar a mandar WhatsApp é
  chamar a `whatsapp-enviar` com um template aprovado.
- **Verificação do negócio na Meta.** Sem ela, a conta fica no limite de 250
  conversas iniciadas por dia e no número de teste.
