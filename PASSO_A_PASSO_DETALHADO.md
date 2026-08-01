# 🎯 Passo a Passo Detalhado — Ativar Envio Real de Email

Este guia assume que você não fez nada ainda. Siga NA ORDEM, sem pular etapas.

---

## PARTE 1 — Criar a Conta na Resend (serviço que envia o email)

### 1.1
Abra uma nova aba no navegador e digite este endereço:
```
https://resend.com/signup
```

### 1.2
Você verá uma tela de cadastro com campos **Email** e **Password** (ou um botão "Continue with Google").

**Opção mais rápida:** clique no botão **"Continue with Google"** e escolha a conta `ivanjr.tstconsultoria@gmail.com`. Isso pula a etapa de confirmação de email.

**Opção manual:**
- Campo **Email**: digite `ivanjr.tstconsultoria@gmail.com`
- Campo **Password**: crie uma senha (anote em algum lugar)
- Clique no botão **Sign Up** (ou **Create account**)
- Vá até sua caixa de entrada do Gmail
- Procure um email de **Resend** com assunto tipo "Confirm your email"
- **Se não encontrar em alguns minutos, olhe na pasta Spam/Lixo Eletrônico**
- Abra o email e clique no botão/link de confirmação

### 1.3
Depois de confirmar, você será redirecionado para o **Dashboard da Resend** (tela inicial, geralmente vazia, com menu do lado esquerdo).

---

## PARTE 2 — Gerar a Chave de API (API Key)

### 2.1
No menu do lado **esquerdo** da tela da Resend, procure e clique em **"API Keys"**
(ícone parecido com uma chave 🔑)

### 2.2
Você verá uma lista vazia (ou com chaves antigas) e um botão no canto superior direito escrito **"Create API Key"**. Clique nele.

### 2.3
Vai abrir uma pequena janela (modal) pedindo:
- **Name** (nome): digite `episafety` (pode ser qualquer nome, é só pra identificar)
- **Permission** (permissão): deixe selecionado **"Full access"** (ou "Sending access" se for a única opção)
- **Domain**: deixe em branco ou "All domains"

Clique no botão **"Add"** (ou "Create") para confirmar.

### 2.4 ⚠️ MUITO IMPORTANTE
Assim que criar, a tela vai mostrar a chave **UMA ÚNICA VEZ**, algo parecido com:
```
re_AbCdEfGh_1234567890abcdefghijklmnop
```

**Clique no ícone de copiar** (geralmente um ícone de duas folhas, ao lado da chave) ou selecione o texto manualmente e copie (Ctrl+C ou Cmd+C).

**Cole essa chave em algum lugar temporário agora** (ex: Bloco de Notas) para não perder — se você fechar essa tela sem copiar, vai precisar apagar essa chave e criar outra.

---

## PARTE 3 — Colar a Chave no Supabase

### 3.1
Volte para a aba do navegador onde está o **Supabase** (o painel do seu projeto EPISAFETY).

### 3.2
No menu do lado esquerdo, procure o ícone de **Edge Functions** (parece um raio ⚡). Clique nele.

### 3.3
Dentro de Edge Functions, procure no menu (mais à esquerda, dentro da seção) por **"Secrets"**. Clique nele.

### 3.4
Você verá uma tela com campos **"Name"** e **"Value"** (a mesma tela do print que você me mandou antes), e embaixo uma lista chamada **"Custom secrets"**.

### 3.5
No campo **Name**, apague qualquer texto que já esteja lá e digite exatamente (tudo maiúsculo, sem espaços):
```
RESEND_API_KEY
```

### 3.6
No campo **Value** (a caixa de texto grande logo abaixo), cole a chave que você copiou na Parte 2.4 (deve começar com `re_`).

**Como colar:** clique dentro da caixa branca/escura do campo Value, depois aperte **Ctrl+V** (Windows/Linux) ou **Cmd+V** (Mac).

### 3.7
Confira visualmente que:
- Name = `RESEND_API_KEY` (exatamente assim)
- Value = a chave que começa com `re_` (não está vazio)

### 3.8
Clique no botão verde **"Save"** no canto superior direito dessa seção.

### 3.9
Se aparecer uma mensagem de sucesso (geralmente uma notificação verde no canto da tela), está feito.

**Se aparecer um erro**, tire um print da tela inteira (incluindo a mensagem de erro) e me envie — eu leio o texto do erro e te digo exatamente o que fazer.

---

## PARTE 4 — Confirmar que a Função `send-purchase-email` Existe

### 4.1
Ainda dentro de **Edge Functions**, clique em **"Functions"** no menu (voltar para a lista de funções).

### 4.2
Procure na lista por **`send-purchase-email`**.

**Se ela NÃO aparecer na lista:**
- Você ainda precisa implantá-la (isso é outro guia: `IMPLANTAR_EDGE_FUNCTION.md`, que já tem o código pronto pra copiar e colar)
- Siga aquele guia primeiro, depois volte pra Parte 5 aqui

**Se ela JÁ aparecer na lista:**
- Ótimo, pule direto pra Parte 5

---

## PARTE 5 — Testar se Está Funcionando de Verdade

### 5.1
Abra o sistema EPISAFETY em outra aba.

### 5.2
No menu lateral, vá em **EPIs → Solicitações de Materiais**.

### 5.3
Encontre a solicitação `SOL-2026-0001` (ou qualquer uma com status "Enviada").

### 5.4
Na linha dela, procure um **ícone de envelope/carta (✉️)** do lado direito, entre os outros ícones de ação. Clique nele.

### 5.5
Uma pequena notificação (toast) vai aparecer no canto da tela. Leia com atenção a cor:

| Cor | Mensagem | O que significa |
|-----|----------|------------------|
| 🟢 Verde | "Email reenviado com sucesso" | **Funcionou! Email foi enviado de verdade.** |
| 🟡 Amarelo | "Email NÃO foi enviado de verdade" | A função existe mas ainda não está lendo a chave certa — volte na Parte 3 e confira o nome/valor |
| 🔴 Vermelho | "Erro ao reenviar email" | Tem outro problema — leia a descrição do erro e me envie um print |

### 5.6
Se deu verde, confira sua caixa de entrada do email cadastrado em **Empresas → E-mail para Compras** (no seu caso, `ivanjr.tstconsultoria@gmail.com`). O email deve chegar em até 1 minuto. Confira o Spam também.

---

## 🆘 Resumo Visual do Fluxo Completo

```
1. resend.com/signup → criar conta → confirmar email
2. Dentro da Resend → API Keys → Create API Key → copiar chave (re_...)
3. Supabase → Edge Functions → Secrets → 
   Name: RESEND_API_KEY | Value: (colar chave) → Save
4. Supabase → Edge Functions → Functions →
   conferir que "send-purchase-email" está na lista
   (se não estiver, seguir IMPLANTAR_EDGE_FUNCTION.md primeiro)
5. Sistema EPISAFETY → Solicitações de Materiais →
   clicar no ícone ✉️ → conferir cor do toast (verde = sucesso)
```

---

## Ainda com Dificuldade?

Me mande um print de exatamente onde você travou — não precisa descrever com palavras, só a imagem da tela já me diz tudo que preciso saber pra te guiar no próximo clique.
