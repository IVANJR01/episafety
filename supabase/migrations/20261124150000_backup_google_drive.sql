-- Cópia automática do backup para o Google Drive do dono da conta.
--
-- O backup diário (20261124120000_backup_diario.sql) fica numa pasta
-- privada DENTRO da Supabase. Para sobreviver à perda da conta inteira, a
-- cópia precisa sair de lá. A função google-drive faz a autorização
-- (OAuth, o dono clica em "Permitir" uma vez) e a backup-diario, no modo
-- "drive", envia para a pasta "SafetySoluções - Backups" do Drive:
--   backup-AAAA-MM-DD.json  — todas as tabelas daquele dia num arquivo só
--   arquivos/<pasta>/...    — espelho dos PDFs e fotos
--
-- Credenciais (Client ID/Secret do Google e o token de acesso) ficam só no
-- Vault. Escopo pedido ao Google: drive.file — o sistema só enxerga os
-- arquivos que ele mesmo criou, nunca o resto do Drive.

-- ── Estado da ligação (sem segredo nenhum aqui) ──────────────────────
create table if not exists public.backup_drive_config (
  id boolean primary key default true check (id),
  conectado_em timestamptz,
  conta_email text,
  pasta_id text,
  pasta_diario_id text,
  pasta_arquivos_id text,
  ultimo_envio_em timestamptz,
  ultimo_erro text
);
insert into public.backup_drive_config (id) values (true) on conflict do nothing;
alter table public.backup_drive_config enable row level security;
drop policy if exists "super admin le drive" on public.backup_drive_config;
create policy "super admin le drive" on public.backup_drive_config
  for select to authenticated using (public.is_super_admin(auth.uid()));

-- Dias e arquivos já enviados ao Drive.
create table if not exists public.backup_drive_enviados (
  caminho text primary key,          -- 'dia:AAAA-MM-DD' ou 'arq:<pasta>/<nome>'
  drive_id text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.backup_drive_enviados enable row level security;

-- "state" do OAuth: só aceita a volta do Google que esta tela iniciou.
create table if not exists public.backup_drive_estados (
  estado text primary key,
  criado_em timestamptz not null default now()
);
alter table public.backup_drive_estados enable row level security;

-- ── Segredos no Vault ────────────────────────────────────────────────
create or replace function public._vault_gravar(nome text, valor text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = nome;
  if v_id is null then
    perform vault.create_secret(valor, nome);
  else
    perform vault.update_secret(v_id, valor);
  end if;
end $$;
revoke all on function public._vault_gravar(text, text) from public, anon, authenticated;

-- O super admin cola Client ID e Client Secret na tela de Backups.
create or replace function public.drive_salvar_credenciais(client_id text, client_secret text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_super_admin(auth.uid()) then
    raise exception 'Só o administrador pode configurar o Google Drive';
  end if;
  if coalesce(trim(client_id), '') = '' or coalesce(trim(client_secret), '') = '' then
    raise exception 'Preencha o Client ID e o Client Secret';
  end if;
  perform public._vault_gravar('google_drive_client_id', trim(client_id));
  perform public._vault_gravar('google_drive_client_secret', trim(client_secret));
end $$;
revoke all on function public.drive_salvar_credenciais(text, text) from public, anon;
grant execute on function public.drive_salvar_credenciais(text, text) to authenticated;

-- O que a tela precisa saber, sem revelar segredo.
create or replace function public.drive_status()
returns jsonb language sql stable security definer set search_path to '' as $$
  select case when not public.is_super_admin(auth.uid()) then null else jsonb_build_object(
    'tem_credenciais', exists (select 1 from vault.secrets where name = 'google_drive_client_secret'),
    'conectado', exists (select 1 from vault.secrets where name = 'google_drive_refresh_token'),
    'conectado_em', c.conectado_em, 'conta_email', c.conta_email,
    'ultimo_envio_em', c.ultimo_envio_em, 'ultimo_erro', c.ultimo_erro,
    'dias_no_drive', (select count(*) from public.backup_drive_enviados where caminho like 'dia:%'),
    'arquivos_no_drive', (select count(*) from public.backup_drive_enviados where caminho like 'arq:%')
  ) end
  from public.backup_drive_config c
$$;
grant execute on function public.drive_status() to authenticated;

-- Só para as funções do servidor (chave de serviço).
create or replace function public.drive_segredos()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'client_id', (select decrypted_secret from vault.decrypted_secrets where name = 'google_drive_client_id'),
    'client_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_drive_client_secret'),
    'refresh_token', (select decrypted_secret from vault.decrypted_secrets where name = 'google_drive_refresh_token')
  )
$$;
create or replace function public.drive_salvar_refresh(token text)
returns void language sql security definer set search_path to '' as $$
  select public._vault_gravar('google_drive_refresh_token', token)
$$;
revoke all on function public.drive_segredos() from public, anon, authenticated;
revoke all on function public.drive_salvar_refresh(text) from public, anon, authenticated;
grant execute on function public.drive_segredos() to service_role;
grant execute on function public.drive_salvar_refresh(text) to service_role;
grant execute on function public._vault_gravar(text, text) to service_role;

-- ── Agendamento: envia para o Drive a cada 2 horas ───────────────────
-- Às :50, depois do backup das 03:00 (06:00 UTC) e de cada cópia de
-- arquivos (:30). Sem Drive conectado, termina na hora sem fazer nada.
select cron.schedule(
  'backup-google-drive',
  '50 */2 * * *',
  $cron$
  select net.http_post(
    url := 'https://estmuducawmftvpbeutm.supabase.co/functions/v1/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-chave-backup', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_diario_chave')
    ),
    body := '{"modo":"drive"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
