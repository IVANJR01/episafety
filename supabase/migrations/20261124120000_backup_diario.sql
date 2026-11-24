-- Backup diário de TUDO: tabelas, usuários e arquivos.
--
-- O projeto está no plano gratuito da Supabase, que não faz backup nenhum,
-- e o backup para o Google Drive parou em 12/04/2026 (as funções do Drive
-- ficaram no projeto antigo). Até hoje, tudo o que foi cadastrado desde
-- abril existia num lugar só.
--
-- A edge function backup-diario grava, todo dia, numa pasta PRIVADA do
-- Storage (backups-sistema), separada dos arquivos do sistema:
--   diario/AAAA-MM-DD/tabelas/<tabela>.json.gz   (todas as tabelas do public)
--   diario/AAAA-MM-DD/usuarios.json.gz           (contas, sem senha)
--   diario/AAAA-MM-DD/resumo.json                (quantas linhas de cada)
--   arquivos/<pasta>/<arquivo>                   (cópia espelho dos arquivos)
-- Guarda 30 dias de tabelas. Arquivos apagados no sistema continuam na
-- cópia — é para isso que ela existe.
--
-- Protege contra apagar por engano e contra dado estragado. Não protege
-- contra perder o projeto inteiro: para isso a cópia precisa sair da
-- Supabase (Google Drive, ou download pela tela de Backups).

-- ── Pasta privada ───────────────────────────────────────────────────
-- Sem nenhuma política de acesso: só a chave de serviço (a função) entra.
insert into storage.buckets (id, name, public)
values ('backups-sistema', 'backups-sistema', false)
on conflict (id) do nothing;

-- ── Registro de cada execução (para a tela e para o alerta) ──────────
create table if not exists public.backup_execucoes (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  terminado_em timestamptz,
  modo text not null,                    -- 'completo' | 'arquivos'
  status text not null default 'rodando',-- 'rodando' | 'ok' | 'erro' | 'parcial'
  pasta text,                            -- diario/AAAA-MM-DD
  tabelas integer,
  linhas bigint,
  arquivos_copiados integer,
  arquivos_pendentes integer,
  bytes_copiados bigint,
  erro text,
  detalhes jsonb
);
alter table public.backup_execucoes enable row level security;

drop policy if exists "super admin le backups" on public.backup_execucoes;
create policy "super admin le backups" on public.backup_execucoes
  for select to authenticated using (public.is_super_admin(auth.uid()));

-- ── O que a função precisa ler (só a chave de serviço executa) ───────
create or replace function public.backup_listar_tabelas()
returns setof text language sql stable security definer set search_path to '' as $$
  select c.relname::text
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  order by 1
$$;

-- Contas de acesso, SEM a senha (encrypted_password fica de fora).
create or replace function public.backup_usuarios()
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'email', u.email, 'phone', u.phone,
    'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'raw_user_meta_data', u.raw_user_meta_data, 'raw_app_meta_data', u.raw_app_meta_data
  ) order by u.created_at), '[]'::jsonb)
  from auth.users u
$$;

-- Arquivos do sistema e o que já está na cópia.
create or replace function public.backup_listar_arquivos()
returns table (pasta text, nome text, atualizado_em timestamptz, tamanho bigint)
language sql stable security definer set search_path to '' as $$
  select o.bucket_id::text, o.name::text, coalesce(o.updated_at, o.created_at),
         coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where o.bucket_id <> 'backups-sistema' and o.name is not null
$$;

create or replace function public.backup_arquivos_ja_copiados()
returns table (caminho text, atualizado_em timestamptz)
language sql stable security definer set search_path to '' as $$
  select o.name::text, coalesce(o.updated_at, o.created_at)
  from storage.objects o
  where o.bucket_id = 'backups-sistema' and o.name like 'arquivos/%'
$$;

create or replace function public.backup_pastas_diarias()
returns setof text language sql stable security definer set search_path to '' as $$
  select distinct split_part(o.name, '/', 2)
  from storage.objects o
  where o.bucket_id = 'backups-sistema' and o.name like 'diario/%'
  order by 1
$$;

-- Confere a chave que o agendamento manda, guardada no Vault.
create or replace function public.backup_chave_confere(chave text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'backup_diario_chave' and decrypted_secret = chave
  )
$$;

revoke all on function public.backup_listar_tabelas() from public, anon, authenticated;
revoke all on function public.backup_usuarios() from public, anon, authenticated;
revoke all on function public.backup_listar_arquivos() from public, anon, authenticated;
revoke all on function public.backup_arquivos_ja_copiados() from public, anon, authenticated;
revoke all on function public.backup_pastas_diarias() from public, anon, authenticated;
revoke all on function public.backup_chave_confere(text) from public, anon, authenticated;
grant execute on function public.backup_listar_tabelas() to service_role;
grant execute on function public.backup_usuarios() to service_role;
grant execute on function public.backup_listar_arquivos() to service_role;
grant execute on function public.backup_arquivos_ja_copiados() to service_role;
grant execute on function public.backup_pastas_diarias() to service_role;
grant execute on function public.backup_chave_confere(text) to service_role;

-- ── Chave do agendamento, gerada uma vez, só no Vault ────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'backup_diario_chave') then
    perform vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'backup_diario_chave',
      'Chave que o agendamento manda para a função backup-diario. A função confere com backup_chave_confere(); não precisa copiar para lugar nenhum.'
    );
  end if;
end $$;

-- ── Agendamentos ─────────────────────────────────────────────────────
-- 06:00 UTC = 03:00 de Brasília: backup completo (tabelas + arquivos).
select cron.schedule(
  'backup-diario-completo',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://estmuducawmftvpbeutm.supabase.co/functions/v1/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-chave-backup', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_diario_chave')
    ),
    body := '{"modo":"completo"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

-- A cada 2 horas: continua copiando arquivos novos. Cada execução copia
-- um lote limitado (a função tem tempo máximo); sem nada novo, termina em
-- segundos.
select cron.schedule(
  'backup-arquivos',
  '30 */2 * * *',
  $cron$
  select net.http_post(
    url := 'https://estmuducawmftvpbeutm.supabase.co/functions/v1/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-chave-backup', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_diario_chave')
    ),
    body := '{"modo":"arquivos"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
