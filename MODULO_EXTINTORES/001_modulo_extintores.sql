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

  status                          text not null default 'ATIVO'
                                    check (status in ('ATIVO','EM_MANUTENCAO','RESERVA','BAIXADO')),
  motivo_baixa                    text,

  data_ultima_recarga             date,
  data_proxima_recarga            date,
  data_ultimo_teste_hidrostatico  date,
  data_proximo_teste_hidrostatico date,

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
-- 3. Inspeções mensais (NR-23 / NBR 12962)
-- ---------------------------------------------------------------------
create table if not exists public.extintor_inspecoes (
  id                              uuid primary key default gen_random_uuid(),
  extintor_id                     uuid not null references public.extintores(id) on delete cascade,
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,
  inspetor_id                     uuid references auth.users(id) on delete set null,
  inspetor_nome                   text,

  data_inspecao                   date not null default current_date,

  -- Itens do checklist visual (NBR 12962 item 4)
  acesso_desobstruido             boolean not null default true,
  sinalizacao_conforme            boolean not null default true,
  altura_instalacao_conforme      boolean not null default true,
  lacre_intacto                   boolean not null default true,
  pino_seguranca_presente         boolean not null default true,
  manometro_pressao_adequada      boolean not null default true, -- true = faixa verde / CO2 s/ manômetro
  manga_bico_sem_obstrucao        boolean not null default true,
  cilindro_sem_corrosao_ou_dano   boolean not null default true,
  rotulo_instrucoes_legivel       boolean not null default true,
  selo_inmetro_presente           boolean not null default true,
  quadro_demarcacao_piso_ok       boolean not null default true,

  resultado                       text not null check (resultado in ('CONFORME','NAO_CONFORME')),
  observacoes                     text,
  foto_url                        text,

  -- Integração com a tabela existente `conformidades` (não conformidades)
  conformidade_gerada_id          uuid references public.conformidades(id) on delete set null,

  created_at                      timestamptz not null default now()
);

create index if not exists idx_ext_inspecoes_extintor on public.extintor_inspecoes(extintor_id, data_inspecao desc);
create index if not exists idx_ext_inspecoes_empresa on public.extintor_inspecoes(empresa_id, data_inspecao desc);


-- ---------------------------------------------------------------------
-- 4. Manutenções e recargas (níveis 1, 2 e 3)
-- ---------------------------------------------------------------------
create table if not exists public.extintor_manutencoes (
  id                              uuid primary key default gen_random_uuid(),
  extintor_id                     uuid not null references public.extintores(id) on delete cascade,
  empresa_id                      uuid not null references public.empresa_config(id) on delete cascade,

  tipo_servico                    text not null check (tipo_servico in
                                    ('RECARGA_ANUAL','TESTE_HIDROSTATICO','MANUTENCAO_CORRETIVA','PINTURA','TROCA_PECA')),
  nivel_manutencao                int check (nivel_manutencao in (1, 2, 3)),

  data_servico                    date not null default current_date,
  data_proxima_prevista           date,

  empresa_prestadora              text not null,
  registro_inmetro_prestadora     text,
  numero_os                       text,
  numero_novo_selo_inmetro        text,
  custo                           numeric(10,2),

  laudo_url                       text,
  observacoes                     text,

  created_at                      timestamptz not null default now()
);

create index if not exists idx_ext_manutencoes_extintor on public.extintor_manutencoes(extintor_id, data_servico desc);


-- ---------------------------------------------------------------------
-- 5. Triggers de automação:
--    a) Na manutenção, atualiza datas de recarga/TH no cadastro do extintor
--    b) Na inspeção não conforme, abre não conformidade em `conformidades`
-- ---------------------------------------------------------------------
create or replace function public.ext_trg_apos_manutencao()
returns trigger
language plpgsql
as $$
begin
  -- Preenche empresa_id a partir do extintor se veio nulo
  if new.empresa_id is null then
    select empresa_id into new.empresa_id from public.extintores where id = new.extintor_id;
  end if;

  if new.tipo_servico = 'RECARGA_ANUAL' then
    update public.extintores
    set data_ultima_recarga  = new.data_servico,
        data_proxima_recarga = coalesce(new.data_proxima_prevista, new.data_servico + interval '1 year'),
        selo_inmetro         = coalesce(new.numero_novo_selo_inmetro, selo_inmetro),
        status               = 'ATIVO'
    where id = new.extintor_id;

  elsif new.tipo_servico = 'TESTE_HIDROSTATICO' then
    update public.extintores
    set data_ultimo_teste_hidrostatico  = new.data_servico,
        data_proximo_teste_hidrostatico = coalesce(new.data_proxima_prevista, new.data_servico + interval '5 years'),
        data_ultima_recarga             = coalesce(data_ultima_recarga, new.data_servico),
        data_proxima_recarga            = coalesce(data_proxima_recarga, new.data_servico + interval '1 year'),
        status                          = 'ATIVO'
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
begin
  select numero, local_setor, local_descricao, empresa_id
    into v_ext
    from public.extintores
   where id = new.extintor_id;

  new.empresa_id := coalesce(new.empresa_id, v_ext.empresa_id);

  -- Se for NÃO CONFORME, lista o que falhou e abre registro em `conformidades`
  if new.resultado = 'NAO_CONFORME' then
    if not new.acesso_desobstruido          then v_motivos := v_motivos || 'Acesso obstruído; '; end if;
    if not new.sinalizacao_conforme         then v_motivos := v_motivos || 'Sinalização ausente/inconforme; '; end if;
    if not new.lacre_intacto                then v_motivos := v_motivos || 'Lacre violado ou ausente; '; end if;
    if not new.pino_seguranca_presente      then v_motivos := v_motivos || 'Pino de segurança ausente; '; end if;
    if not new.manometro_pressao_adequada   then v_motivos := v_motivos || 'Pressão inadequada (fora da faixa verde); '; end if;
    if not new.manga_bico_sem_obstrucao     then v_motivos := v_motivos || 'Mangueira/bico danificado ou obstruído; '; end if;
    if not new.cilindro_sem_corrosao_ou_dano then v_motivos := v_motivos || 'Cilindro com sinais de corrosão ou amassado; '; end if;
    if not new.rotulo_instrucoes_legivel    then v_motivos := v_motivos || 'Rótulo de instruções ilegível; '; end if;
    if not new.selo_inmetro_presente        then v_motivos := v_motivos || 'Selo do Inmetro ausente; '; end if;
    if not new.quadro_demarcacao_piso_ok    then v_motivos := v_motivos || 'Demarcação de piso ausente/desgastada; '; end if;
    if not new.altura_instalacao_conforme   then v_motivos := v_motivos || 'Altura de instalação fora do padrão NBR 12693; '; end if;

    insert into public.conformidades (
      empresa_id,
      tipo,
      descricao,
      origem,
      local,
      status,
      prioridade,
      data_identificacao
    ) values (
      v_ext.empresa_id,
      'NAO_CONFORMIDADE',
      format('Extintor TAG %s: reprovado na inspeção visual mensal. Itens: %s Observações: %s',
             v_ext.numero, v_motivos, coalesce(new.observacoes, '—')),
      'INSPECAO_EXTINTOR_NR23',
      coalesce(v_ext.local_setor || ' - ' || coalesce(v_ext.local_descricao, ''), 'Local não informado'),
      'ABERTA',
      'ALTA',
      new.data_inspecao
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
-- 6. View para o painel: status calculado (vencido, a vencer, ok)
-- ---------------------------------------------------------------------
create or replace view public.vw_extintores_situacao as
select
  e.*,
  ui.data_inspecao as data_ultima_inspecao,
  ui.resultado     as ultima_inspecao_resultado,
  case
    when e.status = 'BAIXADO' then 'BAIXADO'
    when e.status = 'EM_MANUTENCAO' then 'CRITICO'
    when ui.resultado = 'NAO_CONFORME' then 'CRITICO'
    when e.data_proxima_recarga < current_date then 'CRITICO'
    when e.data_proximo_teste_hidrostatico < current_date then 'CRITICO'
    when ui.data_inspecao is null or ui.data_inspecao < current_date - interval '35 days' then 'ATENCAO'
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


-- ---------------------------------------------------------------------
-- 8. Cadastros de apoio: Setores/Áreas, Locais Específicos e Fabricantes
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

alter table public.extintores_cadastros_apoio enable row level security;

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
