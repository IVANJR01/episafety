## Plano: Hardening de Segurança (Itens 1–10)

Esse plano é grande e arriscado — toca em RLS de praticamente todas as tabelas, storage, Edge Functions e auth. Vou executar em **fases sequenciais**, cada uma com migration/edit isolada para você revisar antes de seguir. Nada de fazer tudo numa única migration "big bang" (alto risco de quebrar telas em produção).

---

### Fase 1 — Auditoria e correção de RLS (itens 1 + 3 do scanner)
Achados conhecidos:
- `aso_numeracao`: política `USING (true) WITH CHECK (true)` para `authenticated` → **vazamento de numeração ASO entre empresas**.
- Múltiplas políticas com `USING (true)` em INSERT/UPDATE/DELETE (scanner aponta padrão `rls_policy_always_true`).
- `SECURITY DEFINER` functions executáveis por `anon` e `authenticated` sem necessidade (ex.: `gerar_numero_aso`, `get_consolidated_epi_stock`, `transfer_*`, `finalizar_conferencia_estoque`, `get_filial_epis`, `resolve_contrato_target_for_entrega`, etc.).

Ações:
1. Listar todas as policies com `qual='true'` ou `with_check='true'` via `pg_policies` e gerar migration que substitui por filtro `is_in_user_company_tree(auth.uid(), empresa_id) OR is_super_admin(auth.uid()) OR is_principal(auth.uid())`.
2. `aso_numeracao`: política específica scoped por `empresa_id` (somente users da própria empresa podem ler/escrever).
3. `REVOKE EXECUTE ... FROM anon` em todas as SECURITY DEFINER (mantém em `authenticated` apenas as que precisam ser chamadas pelo client; resto fica só para `service_role`).
4. Adicionar validação `auth.uid() IS NOT NULL` no topo das funções DEFINER expostas.

### Fase 2 — Storage buckets (item 2)
Buckets públicos: `logos`, `inspecoes`, `conformidades`, `fotos-reconhecimento`, `videos-treinamento`, `empresa-assets`.
- Mantém `public=true` (necessário para `<img src>` via Drive proxy e CDN), mas **remove política ampla `SELECT ON storage.objects`** que permite *listar* arquivos.
- Mantém SELECT por path/objeto individual (acesso direto à URL continua), bloqueia `list()`.
- Policies de INSERT/UPDATE/DELETE: exigir `auth.uid() IS NOT NULL` e prefixo de path scoped por `empresa_id`.

### Fase 3 — CORS das Edge Functions (item 4)
Substituir `Access-Control-Allow-Origin: *` por allowlist em **todas** as functions (`cleanup-storage`, `gdrive-proxy`, `gdrive-storage`, `gdrive-token`, `nr-chatbot`, `scheduled-backup`, `create-user`, `update-profile`, `analyze-certificate`, `consulta-ca`, `migrate-to-drive`, `parse-pcmso`, `sugerir-nr`).
Allowlist: `https://safetysolucoes.com`, `https://www.safetysolucoes.com`, `https://episafety.lovable.app`, e wildcard regex para `*.lovable.app` preview. Helper `resolveCors(req)` compartilhado por cópia em cada function (sem subpastas).

### Fase 4 — MFA/2FA obrigatório (item 5)
- Habilitar TOTP MFA via `configure_auth`.
- Tabela `mfa_enforcement` (lista de roles que exigem MFA: `super_admin`, `principal`).
- Trigger/edge guard: ao logar, se role exige MFA e `aal != 'aal2'`, redireciona para `/setup-mfa`.
- Página `/setup-mfa` com QR code (`supabase.auth.mfa.enroll`).
- Bloqueio em `AuthContext` para rotas sensíveis até `aal2`.

### Fase 5 — Audit log imutável (item 6)
- Tabela `audit_log` (`id`, `user_id`, `user_email`, `action`, `entity_type`, `entity_id`, `empresa_id`, `old_data jsonb`, `new_data jsonb`, `ip`, `user_agent`, `created_at`).
- RLS: somente `super_admin` lê; `INSERT` apenas via SECURITY DEFINER trigger; **UPDATE/DELETE bloqueados** (policy `USING (false)`) — append-only.
- Triggers `AFTER INSERT/UPDATE/DELETE` em: `profiles`, `usuarios_liberados`, `user_roles`, `usuario_empresas`, `entregas`, `funcionarios`, `empresa_config`, `contratos`, `faturas`, `epis`, `contrato_epis`.
- Login/logout logado via edge function `log-auth-event` chamada no `onAuthStateChange`.

### Fase 6 — Cache React Query / localStorage (item 7)
Já fizemos parte (scope por uid em `offlineStorage.ts`). Falta:
- `AuthContext.signOut`: chamar `queryClient.clear()` + `clearAllCachedData()` + `clearAllOfflineViewCache()` + `indexedDB` limpeza (`idb-keyval clear`).
- `onAuthStateChange('SIGNED_IN')`: se `user.id !== previousScope`, `queryClient.clear()` antes de hidratar.
- `EmpresaQuerySync`: ao trocar `active_empresa_id`, `queryClient.invalidateQueries()` em todas as keys tenant-scoped.

### Fase 7 — CSP no frontend (item 8)
- Meta `<meta http-equiv="Content-Security-Policy">` em `index.html` com:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' https://cdn.gpteng.co` (Lovable script)
  - `connect-src 'self' https://*.supabase.co https://*.googleapis.com https://generativelanguage.googleapis.com wss://*.supabase.co`
  - `img-src 'self' data: blob: https:`
  - `style-src 'self' 'unsafe-inline'` (Tailwind/shadcn precisam)
  - `frame-ancestors 'none'`
- Modo `report-only` inicialmente para não quebrar.

### Fase 8 — Rate limiting Edge Functions (item 9)
**Nota:** o backend não tem primitiva padrão para rate limit. Implementação ad-hoc:
- Tabela `edge_rate_limit (key text, window_start timestamptz, count int, primary key(key, window_start))`.
- Helper `checkRateLimit(req, { key, limit, windowSec })` que faz `INSERT ... ON CONFLICT DO UPDATE`.
- Aplicar em: `create-user` (5/min/IP), `nr-chatbot` (30/min/user), `consulta-ca` (60/min/user), `analyze-certificate` (20/min/user), `parse-pcmso` (10/min/user).

Por isso esse item exige sua confirmação explícita (regra do sistema).

### Fase 9 — Leaked password protection
Habilitar via `configure_auth` (`password_hibp_enabled: true`). Item bônus do scanner.

### Fase 10 — Relatório
Documento `SECURITY_REPORT_2026-06-20.md` em `/mnt/documents/` com:
- Diff de policies (antes/depois)
- Lista de SECURITY DEFINER endurecidas
- Buckets e seu novo estado
- CORS allowlist final
- Cobertura de audit triggers
- Riscos residuais (ex.: SUPABASE_SERVICE_ROLE_KEY exposto em edge functions — mitigação: scoping)

---

### Ordem de execução proposta (commits separados):
1. Fase 1 RLS + DEFINER (migration grande, alto impacto — revisar com cuidado)
2. Fase 2 Storage
3. Fase 3 CORS
4. Fase 6 Cache (puramente frontend, baixo risco)
5. Fase 7 CSP report-only
6. Fase 5 Audit log
7. Fase 4 MFA (requer UI nova)
8. Fase 8 Rate limit *(pede confirmação)*
9. Fase 9 HIBP
10. Fase 10 Relatório

### Confirmações que preciso de você antes de começar:

1. **MFA obrigatório**: bloqueio total (usuário não consegue usar nada sem TOTP configurado) ou *grace period* de 7 dias? Recomendo grace period para não travar você agora.
2. **Rate limiting** (item 9): autorizo a implementação ad-hoc com tabela Postgres? (regra do sistema exige confirmação).
3. **CORS allowlist**: além de `safetysolucoes.com`, `www.safetysolucoes.com`, `episafety.lovable.app` e previews `*.lovable.app`, tem algum outro domínio (mobile Capacitor `capacitor://localhost`, app Android empacotado, etc.)?
4. **CSP**: posso começar em `Content-Security-Policy-Report-Only` por 1 semana antes de aplicar enforced? Reduz risco de quebrar tela em produção.

Assim que você responder essas 4, começo pela **Fase 1 (RLS)** que é a mais crítica.