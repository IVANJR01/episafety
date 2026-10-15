-- =====================================================================
-- EPISafety — Módulo de Controle de Extintores (NR-23)
-- Base normativa: NR-23, ABNT NBR 12962, NBR 12693, NBR 13434
-- Idempotente (pode rodar mais de uma vez com segurança).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers de segurança e atualização
-- ---------------------------------------------------------------------
create or replace function public.ext_pode_acessar_empresa(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role::text = 'super_admin'
    )
    or exists (
      select 1
      from profiles p
      join empresa_config e on e.id = _empresa_id
      where p.user_id = auth.uid()
        and (p.empresa_id = e.id or p.empresa_id = e.empresa_pai_id)
    )
    or exists (
      select 1
      from usuarios_liberados u
      join empresa_config e on e.id = _empresa_id
      where u.ativo
        and lower(u.email) = lower(auth.jwt() ->> 'email')
        and (u.empresa_id = e.id or u.empresa_id = e.empresa_pai_id)
    );
$$;

create or replace function public.ext_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role::text in ('admin', 'super_admin')
  );
$$;

create or replace function public.ext_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Tabela de Extintores
-- ---------------------------------------------------------------------
create table if not exists public.extintores (
  id                              uuid primary key default gen_random_uuid(),
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,
  contrato_id                     uuid references public.contratos(id) on delete set null,

  numero                          text not null,
  agente                          text not null check (agente in
                                    ('AGUA','ESPUMA','PQS_BC','PQS_ABC','CO2','CLASSE_K','CLASSE_D')),
  classes                         text generated always as (
                                    case agente
                                      when 'AGUA'     then 'A'
                                      when 'ESPUMA'   then 'AB'
                                      when 'PQS_BC'   then 'BC'
                                      when 'PQS_ABC'  then 'ABC'
                                      when 'CO2'      then 'BC'
                                      when 'CLASSE_K' then 'K'
                                      when 'CLASSE_D' then 'D'
                                    end) stored,
  capacidade                      numeric(6,2) not null,
  unidade_capacidade              text not null default 'kg' check (unidade_capacidade in ('kg','L')),

  fabricante                      text,
  numero_cilindro                 text,
  ano_fabricacao                  int check (ano_fabricacao between 1950 and 2100),
  selo_inmetro                    text,

  local_setor                     text,
  local_descricao                 text,
  latitude                        numeric(9,6),
  longitude                       numeric(9,6),

  status                          text not null default 'ATIVO'
                                    check (status in ('ATIVO','EM_MANUTENCAO','RESERVA','BAIXADO')),
  motivo_baixa                    text,

  data_ultima_recarga             date,
  data_proxima_recarga            date,
  data_ultimo_teste_hidrostatico  date,
  data_proximo_teste_hidrostatico date,
  data_ultima_inspecao            date,
  ultima_inspecao_resultado       text,

  qr_token                        uuid not null default gen_random_uuid() unique,
  observacoes                     text,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint extintores_empresa_numero_unique unique (empresa_id, numero)
);

create index if not exists idx_extintores_empresa on public.extintores(empresa_id);
create index if not exists idx_extintores_proxima_recarga on public.extintores(data_proxima_recarga);
create index if not exists idx_extintores_proximo_th on public.extintores(data_proximo_teste_hidrostatico);
create index if not exists idx_extintores_qr_token on public.extintores(qr_token);

drop trigger if exists trg_extintores_updated_at on public.extintores;
create trigger trg_extintores_updated_at
  before update on public.extintores
  for each row execute function public.ext_set_updated_at();


-- ---------------------------------------------------------------------
-- 3. Tabela de Inspeções Mensais
-- ---------------------------------------------------------------------
create table if not exists public.extintor_inspecoes (
  id                              uuid primary key default gen_random_uuid(),
  extintor_id                     uuid not null references public.extintores(id) on delete cascade,
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,
  inspetor_id                     uuid references auth.users(id) on delete set null,
  inspetor_nome                   text,

  data_inspecao                   date not null default current_date,

  acesso_desobstruido             boolean not null default true,
  sinalizacao_conforme            boolean not null default true,
  altura_instalacao_conforme      boolean not null default true,
  lacre_intacto                   boolean not null default true,
  pino_seguranca_presente         boolean not null default true,
  manometro_pressao_adequada      boolean not null default true,
  manga_bico_sem_obstrucao        boolean not null default true,
  cilindro_sem_corrosao_ou_dano   boolean not null default true,
  rotulo_instrucoes_legivel       boolean not null default true,
  selo_inmetro_presente           boolean not null default true,
  quadro_demarcacao_piso_ok       boolean not null default true,

  resultado                       text not null check (resultado in ('CONFORME','NAO_CONFORME')),
  observacoes                     text,
  foto_url                        text,
  conformidade_gerada_id          uuid references public.conformidades(id) on delete set null,

  created_at                      timestamptz not null default now()
);

create index if not exists idx_ext_inspecoes_extintor on public.extintor_inspecoes(extintor_id, data_inspecao desc);
create index if not exists idx_ext_inspecoes_empresa on public.extintor_inspecoes(empresa_id, data_inspecao desc);


-- ---------------------------------------------------------------------
-- 4. Tabela de Manutenções e Recargas
-- ---------------------------------------------------------------------
create table if not exists public.extintor_manutencoes (
  id                              uuid primary key default gen_random_uuid(),
  extintor_id                     uuid not null references public.extintores(id) on delete cascade,
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,

  tipo                            text not null, -- 'RECARGA', 'TESTE_HIDROSTATICO', 'CORRETIVA', 'BAIXA'
  tipo_servico                    text,
  nivel_manutencao                int,

  data_manutencao                 date not null default current_date,
  data_servico                    date,
  data_validade_etiqueta          date,
  data_proxima_prevista           date,

  empresa_prestadora              text,
  cnpj_prestadora                 text,
  registro_inmetro_prestadora     text,
  numero_os                       text,
  selo_inmetro                    text,
  numero_novo_selo_inmetro        text,
  custo                           numeric(10,2),

  laudo_url                       text,
  observacoes                     text,

  created_at                      timestamptz not null default now()
);

create index if not exists idx_ext_manutencoes_extintor on public.extintor_manutencoes(extintor_id, created_at desc);
create index if not exists idx_ext_manutencoes_empresa on public.extintor_manutencoes(empresa_id);


-- ---------------------------------------------------------------------
-- 5. Triggers de Automação
-- ---------------------------------------------------------------------
create or replace function public.ext_trg_apos_manutencao()
returns trigger
language plpgsql
as $$
declare
  v_tipo text;
  v_data date;
  v_val date;
begin
  if new.empresa_id is null then
    select empresa_id into new.empresa_id from public.extintores where id = new.extintor_id;
  end if;

  v_tipo := coalesce(new.tipo, new.tipo_servico);
  v_data := coalesce(new.data_manutencao, new.data_servico, current_date);
  v_val  := coalesce(new.data_validade_etiqueta, new.data_proxima_prevista, v_data + interval '1 year');

  if v_tipo in ('RECARGA', 'RECARGA_ANUAL') then
    update public.extintores
    set data_ultima_recarga  = v_data,
        data_proxima_recarga = v_val,
        selo_inmetro         = coalesce(new.selo_inmetro, new.numero_novo_selo_inmetro, selo_inmetro),
        status               = 'ATIVO'
    where id = new.extintor_id;

  elsif v_tipo in ('TESTE_HIDROSTATICO') then
    update public.extintores
    set data_ultimo_teste_hidrostatico  = v_data,
        data_proximo_teste_hidrostatico = v_data + interval '5 years',
        data_ultima_recarga             = coalesce(data_ultima_recarga, v_data),
        data_proxima_recarga            = v_val,
        selo_inmetro                    = coalesce(new.selo_inmetro, new.numero_novo_selo_inmetro, selo_inmetro),
        status                          = 'ATIVO'
    where id = new.extintor_id;

  elsif v_tipo = 'BAIXA' then
    update public.extintores
    set status = 'BAIXADO'
    where id = new.extintor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ext_apos_manutencao on public.extintor_manutencoes;
create trigger trg_ext_apos_manutencao
  before insert on public.extintor_manutencoes
  for each row execute function public.ext_trg_apos_manutencao();


create or replace function public.ext_trg_apos_inspecao()
returns trigger
language plpgsql
as $$
declare
  v_ext record;
  v_nc_id uuid;
  v_motivos text := '';
  v_proximo_num integer;
begin
  select numero, local_setor, local_descricao, empresa_id
    into v_ext
    from public.extintores
   where id = new.extintor_id;

  new.empresa_id := coalesce(new.empresa_id, v_ext.empresa_id);

  -- Atualiza última inspeção no extintor
  update public.extintores
  set data_ultima_inspecao = new.data_inspecao,
      ultima_inspecao_resultado = new.resultado
  where id = new.extintor_id;

  -- Se for NÃO CONFORME, abre registro na tabela conformidades
  if new.resultado = 'NAO_CONFORME' then
    if not new.acesso_desobstruido          then v_motivos := v_motivos || 'Acesso obstruído; '; end if;
    if not new.sinalizacao_conforme         then v_motivos := v_motivos || 'Sinalização ausente/inconforme; '; end if;
    if not new.lacre_intacto                then v_motivos := v_motivos || 'Lacre violado ou ausente; '; end if;
    if not new.pino_seguranca_presente      then v_motivos := v_motivos || 'Pino de segurança ausente; '; end if;
    if not new.manometro_pressao_adequada   then v_motivos := v_motivos || 'Pressão fora da faixa verde; '; end if;
    if not new.manga_bico_sem_obstrucao     then v_motivos := v_motivos || 'Mangueira/bico danificado ou obstruído; '; end if;
    if not new.cilindro_sem_corrosao_ou_dano then v_motivos := v_motivos || 'Cilindro com corrosão ou dano; '; end if;
    if not new.rotulo_instrucoes_legivel    then v_motivos := v_motivos || 'Rótulo ilegível; '; end if;
    if not new.selo_inmetro_presente        then v_motivos := v_motivos || 'Selo Inmetro ausente; '; end if;
    if not new.quadro_demarcacao_piso_ok    then v_motivos := v_motivos || 'Demarcação de piso inadequada; '; end if;
    if not new.altura_instalacao_conforme   then v_motivos := v_motivos || 'Altura de instalação fora do padrão; '; end if;

    select coalesce(max(numero), 0) + 1
      into v_proximo_num
      from public.conformidades
     where empresa_id = v_ext.empresa_id;

    insert into public.conformidades (
      numero,
      empresa_id,
      data_inspecao,
      situacao_detectada,
      gravidade,
      status,
      local,
      foto_antes,
      referencia_normativa
    ) values (
      v_proximo_num,
      v_ext.empresa_id,
      new.data_inspecao,
      format('Extintor TAG %s: reprovado na inspeção mensal NR-23. Apontamentos: %s Observações: %s',
             v_ext.numero, v_motivos, coalesce(new.observacoes, '—')),
      'ALTA',
      'ABERTA',
      coalesce(v_ext.local_setor || ' - ' || coalesce(v_ext.local_descricao, ''), 'Local não informado'),
      new.foto_url,
      'NR-23 / NBR 12962'
    )
    returning id into v_nc_id;

    new.conformidade_gerada_id := v_nc_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ext_apos_inspecao on public.extintor_inspecoes;
create trigger trg_ext_apos_inspecao
  before insert on public.extintor_inspecoes
  for each row execute function public.ext_trg_apos_inspecao();


-- ---------------------------------------------------------------------
-- 6. Tabela de Cadastros de Apoio (Setores, Locais e Fabricantes)
-- ---------------------------------------------------------------------
create table if not exists public.extintores_cadastros_apoio (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresa_config(id) on delete cascade,
  tipo        text not null check (tipo in ('SETOR', 'LOCAL', 'FABRICANTE')),
  nome        text not null,
  setor_pai   text,
  created_at  timestamptz not null default now(),
  constraint extintores_cadastros_apoio_unique unique (empresa_id, tipo, nome)
);

create index if not exists idx_ext_apoio_empresa_tipo on public.extintores_cadastros_apoio(empresa_id, tipo);


-- ---------------------------------------------------------------------
-- 7. View do Painel (Situação Calculada)
-- ---------------------------------------------------------------------
create or replace view public.vw_extintores_situacao as
select
  e.id,
  e.empresa_id,
  e.contrato_id,
  e.numero,
  e.agente,
  e.classes,
  e.capacidade,
  e.unidade_capacidade,
  e.fabricante,
  e.numero_cilindro,
  e.ano_fabricacao,
  e.selo_inmetro,
  e.local_setor,
  e.local_descricao,
  e.latitude,
  e.longitude,
  e.status,
  e.motivo_baixa,
  e.data_ultima_recarga,
  e.data_proxima_recarga,
  e.data_ultimo_teste_hidrostatico,
  e.data_proximo_teste_hidrostatico,
  coalesce(ui.data_inspecao, e.data_ultima_inspecao) as data_ultima_inspecao,
  coalesce(ui.resultado, e.ultima_inspecao_resultado) as ultima_inspecao_resultado,
  e.qr_token,
  e.observacoes,
  e.created_at,
  e.updated_at,
  case
    when e.status = 'BAIXADO' then 'BAIXADO'
    when e.status = 'EM_MANUTENCAO' then 'CRITICO'
    when coalesce(ui.resultado, e.ultima_inspecao_resultado) = 'NAO_CONFORME' then 'CRITICO'
    when e.data_proxima_recarga < current_date then 'CRITICO'
    when e.data_proximo_teste_hidrostatico < current_date then 'CRITICO'
    when coalesce(ui.data_inspecao, e.data_ultima_inspecao) is null or coalesce(ui.data_inspecao, e.data_ultima_inspecao) < current_date - interval '35 days' then 'ATENCAO'
    when e.data_proxima_recarga between current_date and current_date + interval '30 days' then 'ATENCAO'
    when e.data_proximo_teste_hidrostatico between current_date and current_date + interval '60 days' then 'ATENCAO'
    else 'OK'
  end as situacao_geral
from public.extintores e
left join lateral (
  select data_inspecao, resultado
  from public.extintor_inspecoes
  where extintor_id = e.id
  order by data_inspecao desc
  limit 1
) ui on true;


-- ---------------------------------------------------------------------
-- 8. Row Level Security (RLS)
-- ---------------------------------------------------------------------
alter table public.extintores                 enable row level security;
alter table public.extintor_inspecoes         enable row level security;
alter table public.extintor_manutencoes       enable row level security;
alter table public.extintores_cadastros_apoio enable row level security;

-- Extintores policies
drop policy if exists extintores_select on public.extintores;
drop policy if exists extintores_anon_select on public.extintores;
drop policy if exists extintores_insert on public.extintores;
drop policy if exists extintores_update on public.extintores;
drop policy if exists extintores_delete on public.extintores;

create policy extintores_select on public.extintores for select to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));

create policy extintores_anon_select on public.extintores for select to anon
  using (true);

create policy extintores_insert on public.extintores for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));

create policy extintores_update on public.extintores for update to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id))
  with check (public.ext_pode_acessar_empresa(empresa_id));

create policy extintores_delete on public.extintores for delete to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));

-- Inspeções policies
drop policy if exists ext_inspecoes_select on public.extintor_inspecoes;
drop policy if exists ext_inspecoes_insert on public.extintor_inspecoes;
drop policy if exists ext_inspecoes_update on public.extintor_inspecoes;
drop policy if exists ext_inspecoes_delete on public.extintor_inspecoes;

create policy ext_inspecoes_select on public.extintor_inspecoes for select to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_inspecoes_insert on public.extintor_inspecoes for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_inspecoes_update on public.extintor_inspecoes for update to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id))
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_inspecoes_delete on public.extintor_inspecoes for delete to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));

-- Manutenções policies
drop policy if exists ext_manutencoes_select on public.extintor_manutencoes;
drop policy if exists ext_manutencoes_insert on public.extintor_manutencoes;
drop policy if exists ext_manutencoes_update on public.extintor_manutencoes;
drop policy if exists ext_manutencoes_delete on public.extintor_manutencoes;

create policy ext_manutencoes_select on public.extintor_manutencoes for select to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_manutencoes_insert on public.extintor_manutencoes for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_manutencoes_update on public.extintor_manutencoes for update to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id))
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_manutencoes_delete on public.extintor_manutencoes for delete to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));

-- Cadastros de Apoio policies
drop policy if exists ext_apoio_select on public.extintores_cadastros_apoio;
drop policy if exists ext_apoio_insert on public.extintores_cadastros_apoio;
drop policy if exists ext_apoio_update on public.extintores_cadastros_apoio;
drop policy if exists ext_apoio_delete on public.extintores_cadastros_apoio;

create policy ext_apoio_select on public.extintores_cadastros_apoio for select to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_apoio_insert on public.extintores_cadastros_apoio for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_apoio_update on public.extintores_cadastros_apoio for update to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id))
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy ext_apoio_delete on public.extintores_cadastros_apoio for delete to authenticated
  using (public.ext_pode_acessar_empresa(empresa_id));

-- Grants gerais para roles
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.extintores to authenticated, service_role;
grant select on table public.extintores to anon;
grant all on table public.extintor_inspecoes to authenticated, service_role;
grant all on table public.extintor_manutencoes to authenticated, service_role;
grant all on table public.extintores_cadastros_apoio to authenticated, service_role;
grant all on table public.vw_extintores_situacao to authenticated, service_role;
grant select on table public.vw_extintores_situacao to anon;
