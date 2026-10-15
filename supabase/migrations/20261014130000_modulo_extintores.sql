-- =====================================================================
-- EPISafety — Módulo de Controle de Extintores
-- Base normativa: NR-23, ABNT NBR 12962 (inspeção/manutenção/recarga),
--                 NBR 12693 (distribuição), NBR 13434 (sinalização)
--
-- Rodar no Supabase: SQL Editor (ou como migration). Idempotente.
-- Depende das tabelas existentes: empresa_config, contratos,
-- conformidades, profiles, user_roles, usuarios_liberados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Helper de acesso (matriz enxerga filiais; super_admin enxerga tudo)
--    Se o projeto já tiver um helper equivalente, pode trocar nas policies.
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
-- 2. Cadastro de extintores
-- ---------------------------------------------------------------------
create table if not exists public.extintores (
  id                              uuid primary key default gen_random_uuid(),
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,
  contrato_id                     uuid references public.contratos(id) on delete set null,

  numero                          text not null,           -- patrimônio / TAG (ex.: EXT-001)
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
  capacidade                      numeric(6,2) not null,   -- 4, 6, 10, 12...
  unidade_capacidade              text not null default 'kg' check (unidade_capacidade in ('kg','L')),

  fabricante                      text,
  numero_cilindro                 text,
  ano_fabricacao                  int check (ano_fabricacao between 1950 and 2100),
  selo_inmetro                    text,

  local_setor                     text,                    -- ex.: ALMOXARIFADO
  local_descricao                 text,                    -- ex.: Ao lado da porta de saída
  latitude                        numeric(9,6),
  longitude                       numeric(9,6),
  foto_url                        text,

  data_ultima_recarga             date,
  data_proxima_recarga            date,
  data_ultimo_teste_hidrostatico  date,
  data_proximo_teste_hidrostatico date,
  data_ultima_inspecao            date,

  status                          text not null default 'ATIVO' check (status in
                                    ('ATIVO','EM_MANUTENCAO','RESERVA','BAIXADO')),
  qr_token                        uuid not null unique default gen_random_uuid(),
  observacoes                     text,

  created_by                      uuid default auth.uid(),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  unique (empresa_id, numero)
);

create index if not exists idx_extintores_empresa    on public.extintores (empresa_id);
create index if not exists idx_extintores_contrato   on public.extintores (contrato_id);
create index if not exists idx_extintores_prox_rec   on public.extintores (data_proxima_recarga);

drop trigger if exists trg_extintores_updated_at on public.extintores;
create trigger trg_extintores_updated_at
  before update on public.extintores
  for each row execute function public.ext_set_updated_at();


-- ---------------------------------------------------------------------
-- 3. Inspeções mensais (checklist visual)
--    null = "não se aplica" (ex.: manômetro em extintor de CO2)
-- ---------------------------------------------------------------------
create table if not exists public.extintor_inspecoes (
  id                      uuid primary key default gen_random_uuid(),
  extintor_id             uuid not null references public.extintores(id) on delete cascade,
  empresa_id              uuid not null references public.empresa_config(id) on delete cascade,
  data_inspecao           date not null default current_date,
  inspetor_id             uuid default auth.uid(),
  inspetor_nome           text,

  acesso_desobstruido     boolean,
  sinalizacao_parede      boolean,   -- placa NBR 13434
  demarcacao_piso         boolean,
  altura_fixacao_ok       boolean,   -- topo a no máx. 1,60 m do piso
  lacre_intacto           boolean,
  pino_seguranca_ok       boolean,
  manometro_faixa_verde   boolean,   -- null para CO2
  mangueira_difusor_ok    boolean,
  corpo_sem_danos         boolean,   -- sem corrosão, amassados, vazamento
  rotulo_legivel          boolean,
  selo_inmetro_presente   boolean,

  resultado               text generated always as (
                            case when coalesce(acesso_desobstruido,   true)
                                  and coalesce(sinalizacao_parede,    true)
                                  and coalesce(demarcacao_piso,       true)
                                  and coalesce(altura_fixacao_ok,     true)
                                  and coalesce(lacre_intacto,         true)
                                  and coalesce(pino_seguranca_ok,     true)
                                  and coalesce(manometro_faixa_verde, true)
                                  and coalesce(mangueira_difusor_ok,  true)
                                  and coalesce(corpo_sem_danos,       true)
                                  and coalesce(rotulo_legivel,        true)
                                  and coalesce(selo_inmetro_presente, true)
                                 then 'CONFORME' else 'NAO_CONFORME' end
                          ) stored,

  observacoes             text,
  foto_url                text,
  latitude                numeric(9,6),
  longitude               numeric(9,6),
  conformidade_id         uuid references public.conformidades(id) on delete set null,

  created_at              timestamptz not null default now()
);

create index if not exists idx_ext_insp_extintor on public.extintor_inspecoes (extintor_id, data_inspecao desc);
create index if not exists idx_ext_insp_empresa  on public.extintor_inspecoes (empresa_id);


-- ---------------------------------------------------------------------
-- 4. Manutenções (recarga, teste hidrostático, corretiva, baixa)
-- ---------------------------------------------------------------------
create table if not exists public.extintor_manutencoes (
  id                        uuid primary key default gen_random_uuid(),
  extintor_id               uuid not null references public.extintores(id) on delete cascade,
  empresa_id                uuid not null references public.empresa_config(id) on delete cascade,
  tipo                      text not null check (tipo in
                              ('RECARGA','TESTE_HIDROSTATICO','MANUTENCAO_CORRETIVA','BAIXA')),
  data_servico              date not null,
  data_validade             date,          -- validade informada na etiqueta da empresa de recarga
  empresa_prestadora        text,
  cnpj_prestadora           text,
  numero_os                 text,
  selo_inmetro              text,
  custo                     numeric(10,2),
  anexo_url                 text,          -- certificado / nota
  observacoes               text,
  created_by                uuid default auth.uid(),
  created_at                timestamptz not null default now()
);

create index if not exists idx_ext_man_extintor on public.extintor_manutencoes (extintor_id, data_servico desc);
create index if not exists idx_ext_man_empresa  on public.extintor_manutencoes (empresa_id);


-- ---------------------------------------------------------------------
-- 5. Triggers: herdar empresa_id e atualizar datas do extintor
-- ---------------------------------------------------------------------
create or replace function public.ext_herdar_empresa()
returns trigger
language plpgsql
as $$
begin
  select empresa_id into new.empresa_id from public.extintores where id = new.extintor_id;
  return new;
end;
$$;

drop trigger if exists trg_ext_insp_empresa on public.extintor_inspecoes;
create trigger trg_ext_insp_empresa
  before insert on public.extintor_inspecoes
  for each row execute function public.ext_herdar_empresa();

drop trigger if exists trg_ext_man_empresa on public.extintor_manutencoes;
create trigger trg_ext_man_empresa
  before insert on public.extintor_manutencoes
  for each row execute function public.ext_herdar_empresa();

create or replace function public.ext_apos_inspecao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update extintores
     set data_ultima_inspecao = new.data_inspecao
   where id = new.extintor_id
     and (data_ultima_inspecao is null or data_ultima_inspecao <= new.data_inspecao);
  return new;
end;
$$;

drop trigger if exists trg_ext_apos_inspecao on public.extintor_inspecoes;
create trigger trg_ext_apos_inspecao
  after insert on public.extintor_inspecoes
  for each row execute function public.ext_apos_inspecao();

-- Lançamentos retroativos não sobrescrevem datas mais recentes.
create or replace function public.ext_apos_manutencao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo in ('RECARGA', 'TESTE_HIDROSTATICO') then
    -- teste hidrostático sempre inclui recarga
    update extintores
       set data_ultima_recarga  = new.data_servico,
           data_proxima_recarga = coalesce(new.data_validade, new.data_servico + interval '1 year')::date,
           selo_inmetro         = coalesce(new.selo_inmetro, selo_inmetro),
           status               = case when status = 'EM_MANUTENCAO' then 'ATIVO' else status end
     where id = new.extintor_id
       and (data_ultima_recarga is null or data_ultima_recarga <= new.data_servico);
  end if;

  if new.tipo = 'TESTE_HIDROSTATICO' then
    update extintores
       set data_ultimo_teste_hidrostatico  = new.data_servico,
           data_proximo_teste_hidrostatico = (new.data_servico + interval '5 years')::date
     where id = new.extintor_id
       and (data_ultimo_teste_hidrostatico is null or data_ultimo_teste_hidrostatico <= new.data_servico);
  end if;

  if new.tipo = 'BAIXA' then
    update extintores set status = 'BAIXADO' where id = new.extintor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ext_apos_manutencao on public.extintor_manutencoes;
create trigger trg_ext_apos_manutencao
  after insert on public.extintor_manutencoes
  for each row execute function public.ext_apos_manutencao();


-- ---------------------------------------------------------------------
-- 6. View de situação (dashboard, alertas, relatórios)
--    security_invoker = respeita o RLS de quem consulta
-- ---------------------------------------------------------------------
create or replace view public.vw_extintores_situacao
with (security_invoker = true) as
select
  e.*,
  ec.nome                                         as empresa_nome,
  c.nome                                          as contrato_nome,
  ui.resultado                                    as ultima_inspecao_resultado,
  (e.data_proxima_recarga - current_date)         as dias_para_recarga,
  case
    when e.data_proxima_recarga is null                            then 'SEM_DATA'
    when e.data_proxima_recarga <  current_date                    then 'VENCIDA'
    when e.data_proxima_recarga <= current_date + 30               then 'VENCE_30_DIAS'
    else 'EM_DIA'
  end                                             as situacao_recarga,
  case
    when e.data_proximo_teste_hidrostatico is null                 then 'SEM_DATA'
    when e.data_proximo_teste_hidrostatico <  current_date         then 'VENCIDO'
    when e.data_proximo_teste_hidrostatico <= current_date + 60    then 'VENCE_60_DIAS'
    else 'EM_DIA'
  end                                             as situacao_teste_hidrostatico,
  (e.data_ultima_inspecao is null
     or e.data_ultima_inspecao < current_date - 30)               as inspecao_atrasada,
  case
    when e.status = 'BAIXADO'                                      then 'BAIXADO'
    when e.data_proxima_recarga < current_date
      or e.data_proximo_teste_hidrostatico < current_date
      or ui.resultado = 'NAO_CONFORME'                             then 'CRITICO'
    when e.data_proxima_recarga is null
      or e.data_proxima_recarga <= current_date + 30
      or e.data_ultima_inspecao is null
      or e.data_ultima_inspecao < current_date - 30                then 'ATENCAO'
    else 'OK'
  end                                             as situacao_geral
from public.extintores e
join public.empresa_config ec on ec.id = e.empresa_id
left join public.contratos c  on c.id  = e.contrato_id
left join lateral (
  select i.resultado
  from public.extintor_inspecoes i
  where i.extintor_id = e.id
  order by i.data_inspecao desc, i.created_at desc
  limit 1
) ui on true;


-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.extintores           enable row level security;
alter table public.extintor_inspecoes   enable row level security;
alter table public.extintor_manutencoes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['extintores','extintor_inspecoes','extintor_manutencoes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);

    execute format('create policy %1$s_select on public.%1$s for select to authenticated
                    using (public.ext_pode_acessar_empresa(empresa_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                    using (public.ext_pode_acessar_empresa(empresa_id))
                    with check (public.ext_pode_acessar_empresa(empresa_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                    using (public.ext_pode_acessar_empresa(empresa_id) and public.ext_is_admin())', t);
  end loop;
end $$;

-- extintores: o empresa_id vem do formulário
create policy extintores_insert on public.extintores for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));

-- filhas: empresa_id é preenchido pelo trigger a partir do extintor
create policy extintor_inspecoes_insert on public.extintor_inspecoes for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));
create policy extintor_manutencoes_insert on public.extintor_manutencoes for insert to authenticated
  with check (public.ext_pode_acessar_empresa(empresa_id));
