
# Fase 3 — RLS Portal RH (Plano de Implementação)

## 1. Tabelas reais usadas pelo Portal RH

| Tabela | Papel no Portal RH | `empresa_id`? |
|---|---|---|
| `asos` | Registro principal do ASO (PDF em `pdf_url` no GDrive BYOK) | NOT NULL |
| `aso_exames` | Exames vinculados ao ASO | via `aso_id` |
| `aso_assinaturas` | Assinaturas digitais do ASO | via `aso_id` (+ `empresa_id` redundante) |
| `aso_download_logs` | Auditoria de download/visualização | NOT NULL |
| `aso_medicos` | Médicos do ASO (CRM, CPF, assinatura) | NULLABLE |
| `locais_emissao_aso` | Locais de emissão (clínica) | NOT NULL |
| `funcionarios` | Colaborador selecionado no Emitir ASO | NOT NULL |
| `medicos` (legacy) | Não usado pelo Portal RH novo — só PCMSO | — |

Storage: PDF do ASO é **Google Drive BYOK** (`pdf_url` é link gdrive-proxy), não há bucket Supabase ligado ao Portal RH. Logo, não há policy de `storage.objects` a ajustar nesta fase. O gate de download deve viver no edge function que assina/serve o PDF.

## 2. Policies atuais (resumo)

Todas as tabelas acima já têm **isolamento por tenant** via `is_in_user_company_tree(auth.uid(), empresa_id)` + `is_super_admin`. `aso_medicos` exige `empresa_id IS NOT NULL` (bom — não vaza médico global).

**O que falta:**

1. **Nenhuma policy checa permissão `portal_rh:*`.** Hoje qualquer usuário da Empresa A com token válido consegue `SELECT` em `asos` via PostgREST, independente do menu. O gate é só visual.
2. **`funcionarios` tem policies redundantes/sobrepostas** (`Tenant read by unidade`, `from parent company`, `funcionarios_isolation_all`, `Users read own`). Funciona mas é difícil auditar; vamos manter como está nesta fase para não impactar SST.
3. **`asos` não tem flag de liberação para RH.** Hoje RH veria qualquer ASO da empresa, inclusive rascunho técnico do SST.
4. **`aso_download_logs`**: SELECT aberto a toda árvore — RH pode ver logs de download de qualquer usuário da empresa. Aceitável (auditoria interna), mantém.

## 3. Proposta de alteração

### 3.1 Helper de permissão (security definer)

```sql
create or replace function public.has_permission(_user_id uuid, _permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_super_admin(_user_id)
    or is_principal(_user_id)
    or exists (
      select 1 from usuarios_liberados u
      where u.email = (select email from auth.users where id = _user_id)
        and u.ativo = true
        and (
          _permission = any(u.modulos_permitidos)
          -- wildcard "portal_rh" cobre "portal_rh:*"
          or split_part(_permission, ':', 1) = any(u.modulos_permitidos)
        )
    )
$$;
```

Isso espelha a lógica do front (`startsWith("portal_rh:")`) no banco, sem mudar tabela.

### 3.2 Flag de liberação para RH em `asos`

Adicionar:
```sql
alter table public.asos
  add column liberado_portal_rh boolean not null default false;
```

Regra de preenchimento (trigger ou app):
- `liberado_portal_rh = true` quando `status in ('assinado','concluido')` **E** `pdf_url is not null`.
- ASO em rascunho/em emissão fica invisível para RH.

Migration de backfill: marcar `liberado_portal_rh = true` para ASOs já assinados/concluídos com `pdf_url`.

### 3.3 Policies novas (somente SELECT — RH não escreve)

Adicionar policies aditivas (sem remover as atuais de SST):

```sql
-- asos: RH só vê ASO liberado da própria árvore de empresa
create policy "RH read asos liberados"
on public.asos for select to authenticated
using (
  has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  and is_in_user_company_tree(auth.uid(), empresa_id)
  and liberado_portal_rh = true
);

-- funcionarios: RH vê funcionários da empresa (sem flag, já é dado de RH)
create policy "RH read funcionarios"
on public.funcionarios for select to authenticated
using (
  has_permission(auth.uid(), 'portal_rh:funcionarios:visualizar')
  and is_in_user_company_tree(auth.uid(), empresa_id)
);

-- aso_medicos / locais_emissao_aso: leitura para emissão (se RH emite)
create policy "RH read aso_medicos"
on public.aso_medicos for select to authenticated
using (
  has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  and empresa_id is not null
  and is_in_user_company_tree(auth.uid(), empresa_id)
);
-- idem locais_emissao_aso
```

Como as policies de tenant já existentes são permissive, **um usuário SST mantém acesso** (passa pela policy antiga); um usuário **RH puro** passa pela nova. Não há regressão para U2/U3/U1.

### 3.4 Restrição opcional por `contrato_id`/`unidade_id`

`usuarios_liberados.contrato_id` existe mas `asos` não tem `contrato_id` direto — apenas via `funcionarios.contrato_id` (a confirmar). **Proposta:** nesta fase **não** filtrar por contrato no RLS de `asos` (precisaria join e mudaria semântica do SST). Documentar como Fase 3.1 futura.

### 3.5 Download de ASO (edge function `aso-download` ou equivalente)

Antes de devolver signed URL / stream do PDF:
1. `auth.getUser()` → exigir sessão.
2. `select empresa_id, pdf_url, liberado_portal_rh from asos where id = $1` (server-side, service role).
3. Validar:
   - `is_in_user_company_tree(uid, empresa_id)` **OU** `is_super_admin/principal`;
   - se for RH-only: exigir `has_permission(uid, 'portal_rh:aso:baixar')` **E** `liberado_portal_rh = true`.
4. Em falha → 403 `forbidden_tenant`.
5. Registrar em `aso_download_logs` (acao='download_rh' ou 'view_rh', `perfil_usuario`).

Se hoje o download passa direto pelo `gdrive-proxy` sem checar tenant, vamos **inserir o gate antes** do proxy (novo endpoint `portal-rh-aso-download` ou checagem no proxy existente).

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Quebrar SST ao adicionar policies | Policies novas são aditivas (permissive OR), SST continua via policy antiga |
| `liberado_portal_rh=false` esconder ASOs legítimos | Backfill marca todos `assinado/concluido` como true; trigger mantém |
| RH ver médicos com CPF | `aso_medicos` já exige `empresa_id IS NOT NULL`, sem global; CPF fica dentro da árvore |
| `has_permission` recursivo via RLS de `usuarios_liberados` | Função é SECURITY DEFINER — bypassa RLS |
| Edge function de download usar service role sem checar uid | Implementar checagem explícita antes de devolver URL |

## 5. Migrations planejadas (ordem)

1. **`20260623_portal_rh_has_permission.sql`** — cria `public.has_permission(uuid,text)`.
2. **`20260623_asos_liberado_portal_rh.sql`** — adiciona coluna + backfill + trigger de manutenção.
3. **`20260623_portal_rh_rls_policies.sql`** — cria policies SELECT para `asos`, `funcionarios`, `aso_medicos`, `locais_emissao_aso`, `aso_exames`, `aso_assinaturas`.
4. **Edge function** `portal-rh-aso-download` (ou patch no proxy) com gate de tenant + permissão + log.

## 6. Plano de teste (após aplicar)

Roteiro Playwright + curl direto:

- **U5 (RH-only Empresa A)**
  - `/rh/asos` lista somente ASOs `liberado_portal_rh=true` da Empresa A. ✔
  - `curl PostgREST /asos?empresa_id=<EmpresaB>` → vazio.
  - `curl PostgREST /asos?id=<aso_empresa_B>` → vazio.
  - `curl portal-rh-aso-download?aso_id=<empresa_B>` → 403 `forbidden_tenant`.
  - `curl /cat_comunicacoes` → vazio (sem permissão).
- **U2 Principal Empresa A** — vê tudo da árvore (incluindo ASO não liberado).
- **U3 Técnico SST** — vê módulos técnicos, sem regressão em PCMSO/LTCAT/PPP.
- **U1 Super Admin** — acesso total.

## 7. Fora de escopo desta fase

eSocial real, certificado digital, ICP-Brasil, XMLDSig, SOAP, S-3000, alteração de módulos SST.

---

**Aguardo aprovação para gerar as 3 migrations + edge function.** Posso também, antes, abrir um diff exato de cada policy nova se preferir revisar SQL final.
