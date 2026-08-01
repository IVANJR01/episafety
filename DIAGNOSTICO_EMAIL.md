# 🔍 Diagnóstico - Por que o Email Não Chega?

Se você criou uma solicitação, marcou como "Enviada" mas o email não chegou, siga este checklist para descobrir o problema:

---

## ✅ Passo 1: Verificar se a Migration foi Aplicada

### No Supabase Console:

1. Vá para **SQL Editor**
2. Execute este comando:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'empresa_config' AND column_name = 'email_compras';
```

3. Resultado esperado: Uma linha mostrando `email_compras`

**Se não mostrar nada:**
- ❌ **Problema:** Migration não foi aplicada
- **Solução:** Aplique a migration SQL (veja TESTAR_EMAIL.md Passo 1)

**Se mostrar `email_compras`:**
- ✅ Coluna existe. Vá pro Passo 2.

---

## ✅ Passo 2: Verificar se há Email Configurado

### No Supabase Console:

1. Vá para **SQL Editor**
2. Execute:

```sql
SELECT id, nome, email, email_compras 
FROM empresa_config 
LIMIT 5;
```

3. Procure sua empresa e verifique:

**Se `email_compras` estiver NULL e `email` também:**
- ❌ **Problema:** Nenhum email configurado
- **Solução:** 
  - Abra episafety
  - Vá a **Empresas/Unidades** → **Dados da Empresa**
  - Preencha **E-mail Principal** ou **E-mail para Compras**
  - Clique **Salvar**
  - Tente novamente

**Se há email (qualquer um dos dois):**
- ✅ Email configurado. Vá pro Passo 3.

---

## ✅ Passo 3: Verificar os Logs da Edge Function

É aqui que você descobre se o email foi **tentado** e por quê.

### No Supabase Console:

1. Vá para **Edge Functions** (menu esquerdo)
2. Clique em **`send-purchase-email`**
3. Clique em **Logs** (aba inferior)
4. Procure por qualquer linha com `📧` ou `EMAIL`
5. Clique nela para expandir

### Interpretando o Log:

**Caso A: Vê `📧 EMAIL ENVIADO (MODO DEBUG...)`**
```
📧 EMAIL ENVIADO (MODO DEBUG - sem API Resend configurada)
Para: compras@empresa.com
Assunto: [SOL-2026-0001] Teste Email - 🔴 URGENTE
HTML: <!DOCTYPE html>...
```

- ✅ **Código funcionando!**
- ⚠️ **Problema:** API key Resend não está configurada
- **Solução:** Configure RESEND_API_KEY (veja TESTAR_EMAIL.md Passo 2)

**Caso B: Vê `Resend API error`**
```
Resend API error: 
{"message":"Invalid credentials","code":"invalid_request_params"}
```

- ⚠️ **Problema:** API key está ERRADA ou expirou
- **Solução:**
  - Vá a https://resend.com → API Keys
  - Copie a chave novamente (deve começar com `re_`)
  - Atualize em Supabase Edge Functions → send-purchase-email → Settings → Environment Variables

**Caso C: Vê `error: function not found` ou similar**

- ⚠️ **Problema:** Edge Function não foi deployada
- **Solução:**
  - Verifique se o arquivo existe: `supabase/functions/send-purchase-email/index.ts`
  - Tente fazer deploy: `supabase functions deploy send-purchase-email`

**Caso D: Nenhum log aparece**

- ⚠️ **Problema:** Solicitação pode não ter chegado na Edge Function
- **Solução:**
  - Verifique no console do navegador (F12) se há erro
  - Verifique logs gerais do Supabase
  - Tente criar outra solicitação e imediatamente procure pelo novo ID nos logs

---

## ✅ Passo 4: Verificar o Console do Navegador

Se tudo nos passos anteriores está OK mas ainda não há logs:

1. Abra episafety
2. Pressione **F12** (abre Developer Tools)
3. Clique em **Console**
4. Crie uma nova solicitação e marque como **"Enviada"**
5. Procure por linhas com `[solicitacao]` ou qualquer erro em vermelho

**Erros comuns:**

- `404 - function not found` → Edge Function não existe
- `401 - unauthorized` → Problema de autenticação
- `500 - internal error` → Erro na Edge Function (verifique logs Supabase)

---

## ✅ Passo 5: Verificar Spam

Se todos os passos anteriores mostram ✅ e o email foi "enviado":

1. Procure pela pasta de **Spam** no seu email
2. Procure por mensagens de `noreply@episafety.com.br`
3. Se encontrar:
   - ✅ Email está funcionando!
   - **Solução:** Marque como "Não é spam" para futuros emails não caírem em spam

---

## 📋 Checklist Interativo

Marque conforme avança:

```
Passo 1 - Coluna email_compras existe?
  [ ] Sim → próximo
  [ ] Não → Aplicar migration (TESTAR_EMAIL.md Passo 1)

Passo 2 - Email está configurado?
  [ ] Sim → próximo
  [ ] Não → Preencher email em Empresas/Unidades e salvar

Passo 3 - Qual é o log?
  [ ] "MODO DEBUG" → Configurar RESEND_API_KEY
  [ ] "Resend API error" → Verificar/atualizar API key
  [ ] "function not found" → Fazer deploy da Edge Function
  [ ] Nenhum log → Verificar console (F12)

Passo 4 - Há erro no console (F12)?
  [ ] Sim → Descrever o erro
  [ ] Não → próximo

Passo 5 - Email em Spam?
  [ ] Sim → Marcar como "Não é spam"
  [ ] Não → Abrir issue com os logs de todos os passos
```

---

## 🆘 Se Mesmo Assim Não Funcionar

Colete as seguintes informações e descreva o problema:

1. **Output do Passo 1:** (resultado do SQL de coluna)
2. **Output do Passo 2:** (resultado do SQL de email)
3. **Log completo do Passo 3:** (expandir e copiar a mensagem inteira)
4. **Erro do Console (F12):** (qual é a mensagem exata)
5. **Screenshots:** Se possível, envie screenshots dos logs

---

## ⚡ Resumo das Soluções Rápidas

| Sintoma | Causa | Solução |
|---------|-------|---------|
| "MODO DEBUG" em logs | API key não configurada | Configure RESEND_API_KEY em Edge Functions |
| "Invalid credentials" | API key errada | Copie novamente de https://resend.com |
| Nenhum log aparece | Edge Function não chamada | Verifique console (F12) para erro |
| Email em Spam | Filtro normal | Marque como "Não é spam" |
| Email não chega | Coluna não existe | Aplique migration SQL |

