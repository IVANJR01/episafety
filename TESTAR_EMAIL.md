# 🧪 Guia de Teste - Sistema de Email de Compras

## Status Atual do Sistema

✅ **Código está pronto**
- Edge Function para envio de emails: `supabase/functions/send-purchase-email/index.ts`
- Biblioteca de orquestração: `src/lib/solicitacaoMateriaisEmail.ts`
- UI de configuração: `src/pages/Empresas.tsx` (campo "E-mail para Compras")
- Integração automática: `src/components/epis/SolicitacaoMaterialFormDialog.tsx`
- Resend manual: `src/pages/epis/SolicitacoesMateriais.tsx` (botão Mail no rodapé)

❓ **Pendências (configuração, não código)**
1. Aplicar migration SQL: `supabase/migrations/20260801000000_add_email_compras_empresa.sql`
2. Configurar API key de email: `RESEND_API_KEY` no Edge Function settings

---

## Passo 1: Aplicar a Migration

### No Supabase Console:

1. Vá para: **https://app.supabase.com** → seu projeto
2. Clique em **SQL Editor** (no menu esquerdo)
3. Clique em **+ New query**
4. Cole o conteúdo da migration:

```sql
-- Adiciona campo para email de compras da empresa
-- Permite especificar um email dedicado para receber as notificações de solicitação de materiais

ALTER TABLE IF EXISTS empresa_config
ADD COLUMN IF NOT EXISTS email_compras TEXT;

-- Comentário para documentar o campo
COMMENT ON COLUMN empresa_config.email_compras IS
  'Email para receber notificações de solicitação de materiais. Se não preenchido, usa o email principal da empresa.';

-- Criar índice para buscas rápidas (opcional, para se necessário filtrar por email de compras)
CREATE INDEX IF NOT EXISTS idx_empresa_config_email_compras
  ON empresa_config(email_compras)
  WHERE email_compras IS NOT NULL;
```

5. Clique em **RUN** (ou Ctrl+Enter)
6. ✅ Pronto! A coluna `email_compras` foi criada

---

## Passo 2: Configurar Email Service

### Opção A: Resend (Recomendado)

1. Vá para: **https://resend.com** (ou crie conta se não tiver)
2. Vá a **API Keys** no dashboard
3. Copie a chave (começa com `re_`)
4. Volte ao **Supabase Console**
5. Vá para **Edge Functions** (menu esquerdo) → `send-purchase-email`
6. Clique em **Settings** (no topo da função)
7. Em **Environment Variables**, adicione:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_xxxxxx...` (sua chave)
8. Clique em **Save**

✅ Pronto! Emails reais começarão a ser enviados

---

## Passo 3: Testar a Funcionalidade

### Teste 1: Verificar se coluna existe

1. Vá para **Supabase Console** → **SQL Editor**
2. Execute:

```sql
SELECT id, nome, email, email_compras 
FROM empresa_config 
LIMIT 1;
```

3. Se ver a coluna `email_compras`, significa a migration funcionou ✅

### Teste 2: Configurar email de compras

1. No episafety, vá a **Empresas/Unidades** (menu lateral)
2. Clique em aba **Dados da Empresa**
3. Procure o campo **"E-mail para Compras 📧"**
4. Digite um email válido (pode ser seu próprio email para testar)
5. Clique em **Salvar**

### Teste 3: Enviar solicitação de teste

1. Vá a **EPIs → Solicitações de Materiais** (no menu)
2. Clique em **Nova Solicitação**
3. Preencha:
   - **Título:** "Teste de Email - Reposição de EPIs"
   - **Setor:** Qualquer um
   - **Prioridade:** "Urgente" (para destacar no email)
   - **Itens:** Adicione pelo menos 1 item
   - **Data necessária:** Qualquer data futura
4. Clique em **Enviar**
5. Sistema exibe: "Solicitação enviada ✓ Email foi disparado para o setor de compras"

### Teste 4: Verificar se email foi recebido

**Modo Debug (sem API key):**
- Email será registrado em log no Supabase Edge Functions
- Vá a **Edge Functions** → `send-purchase-email` → **Logs**
- Procure por `📧 EMAIL ENVIADO (MODO DEBUG...)`
- Significa: está tudo pronto, só falta a API key

**Modo Real (com API key Resend):**
- Verifique a caixa de entrada do email configurado
- Procure por email com assunto: `[TEST-2026-0001] Teste de Email - Reposição de EPIs - 🔴 URGENTE`
- Email terá formato profissional com logo, empresa, items, etc.

### Teste 5: Reenviar email manualmente

Se precisar reenviar:

1. Vá a **EPIs → Solicitações de Materiais**
2. Encontre a solicitação que enviou
3. Procure o **ícone de email (✉️)** na linha da solicitação
4. Clique nele → Email é reenviado imediatamente
5. Toast confirma: "Email reenviado com sucesso para o setor de compras"

---

## Checklist de Verificação

Marque conforme avança:

- [ ] Migration aplicada no Supabase SQL Editor
- [ ] Campo `email_compras` aparece em Supabase (SQL: SELECT)
- [ ] Campo "E-mail para Compras" visível em episafety/Empresas
- [ ] Email de compras configurado e salvo
- [ ] Nova solicitação criada e marcada como "Enviada"
- [ ] Toast aparece: "Solicitação enviada ✓ Email foi disparado..."
- [ ] Email recebido (ou log em Supabase Edge Functions se em modo debug)
- [ ] Botão de reenvio (ícone de email) funciona

---

## Troubleshooting

### Erro: "Coluna não encontrada (email_compras)"
→ Migration ainda não foi aplicada no Supabase

### Campo "E-mail para Compras" não aparece
→ Deploy talvez não tenha atualizado. Aguarde 1-2 min ou faça F5

### Cliquei "Salvar" mas dados não aparecem
→ Verifique se há conexão de internet
→ Se offline, será sincronizado quando reconectar

### Email não chegou (com API key configurada)
→ Verifique pasta de Spam
→ Verifique se domínio foi verificado em Resend
→ Logs do Supabase Edge Functions para erros

### Email aparece em modo Debug mas não quer sair do debug
→ Confirme que API key foi copiada corretamente (começa com `re_`)
→ Certifique-se que Environment Variable foi marcada como "Save"
→ Tente recarregar a página do Edge Function

---

## Contato

Se tiver dúvidas ou problemas não previstos aqui, verifique:
- `ENVIAR_EMAILS.md` (configuração de serviço de email)
- Logs do Supabase Edge Functions
- Console do navegador (F12 → Console)

