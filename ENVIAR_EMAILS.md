# 📧 Ativar Envio Real de Emails de Compras

Atualmente, o sistema **registra os emails em log** (modo debug) quando uma solicitação é enviada, porque **nenhuma chave de API de email foi configurada**.

## 3 Opções para Ativar Emails Reais

### Opção 1: Resend (Recomendado ⭐)

**Resend** é um serviço moderno e fácil de usar para enviar emails.

1. Vá para [resend.com](https://resend.com)
2. Crie uma conta grátis
3. Gere uma **API Key**
4. Copie a chave
5. Vá para **Supabase Console** → Seu Projeto → **Edge Functions** → `send-purchase-email` → **Settings**
6. Adicione uma variável de ambiente:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `sua_chave_aqui`
7. Clique em **Save**
8. Pronto! Os emails começarão a ser enviados realmente

**Custos:** Gratuito até 100 emails/dia

---

### Opção 2: SendGrid

Se preferir SendGrid:

1. Vá para [sendgrid.com](https://sendgrid.com)
2. Crie conta e gere **API Key**
3. Modifique a função `send-purchase-email/index.ts` para usar SendGrid em vez de Resend
4. Configure a chave em Supabase Edge Functions settings

---

### Opção 3: AWS SES (Amazon)

Para alta escala:

1. Configure AWS SES
2. Obtenha credenciais
3. Modifique a função para usar AWS SDK

---

## Como Verificar se Está Funcionando

### Modo Debug (Atual)

Se abrir os **Logs** da Edge Function no Supabase Console, verá algo como:

```
📧 EMAIL ENVIADO (MODO DEBUG - sem API Resend configurada)
Para: compras@empresa.com
Assunto: [SOL-2026-0001] Reposição de EPIs - 🔴 URGENTE
HTML: <!DOCTYPE html>...
```

### Modo Real (Com API Key)

Quando configurar a chave, o email será **realmente enviado** para a caixa de entrada do destinatário.

---

## Template do Email

O email enviado segue este padrão:

```
📋 Nova Solicitação de Materiais

Número: SOL-2026-0001
Título: Reposição de EPIs
Empresa: CG3 ENGENHARIA LTDA
Setor: Operacional
Solicitante: Jose Ivan Holanda
Necessário até: 15/08/2026
Prioridade: Urgente 🔴
Itens: 5 produtos

[Botão: Revisar Solicitação]
```

---

## Próximas Ações

1. ✅ Escolha um serviço de email (recomendado: Resend)
2. ✅ Configure a chave de API
3. ✅ Teste enviando uma nova solicitação
4. ✅ Verifique se o email chegou na caixa do setor de compras

---

## Dúvidas?

- **Resend não aceita meu domínio?** Use o domínio padrão `onboarding@resend.dev` durante testes
- **Email não chegou?** Verifique a pasta de spam
- **Precisa de outro serviço?** Contate para adaptar a função

---

**Status Atual:** 🟡 Modo Debug (registra em log, não envia)  
**Para Produção:** 🟢 Configure chave de API acima
