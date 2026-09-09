-- Verificação pública da Ficha de EPI pelo código impresso.
--
-- A ficha já trazia um código de 40 caracteres embaixo de cada assinatura,
-- mas ele não servia para nada: não havia onde digitá-lo. Quem recebia o
-- papel não tinha como conferir se aquilo corresponde a um registro real.
--
-- O código é SHA-256 de "id|created_at|assinatura", cortado em 40 — a mesma
-- conta que o navegador faz ao gerar a ficha (src/lib/codigoAssinatura.ts).
-- Conferido contra uma ficha já impressa: o banco reproduz o mesmo código,
-- então a verificação vale retroativamente para tudo que já foi emitido.

-- O `SET timezone` não é detalhe: a serialização de timestamptz em JSON
-- depende do fuso da sessão, e é a forma UTC que o front recebe da API e usa
-- na conta. Sem fixar aqui, o mesmo registro geraria códigos diferentes
-- conforme quem chamasse.
create or replace function public.calcular_codigo_verificacao(
  p_id uuid,
  p_created_at timestamptz,
  p_assinatura text
) returns text
language sql
stable
set timezone = 'UTC'
as $$
  select case
    when p_assinatura is null or p_assinatura = '' then null
    else left(
      encode(
        digest(
          p_id::text || '|' || (to_jsonb(p_created_at) #>> '{}') || '|' || p_assinatura,
          'sha256'
        ),
        'hex'
      ),
      40
    )
  end;
$$;

comment on function public.calcular_codigo_verificacao is
  'Código impresso na Ficha de EPI. Precisa bater com src/lib/codigoAssinatura.ts.';

alter table public.entregas add column if not exists codigo_verificacao text;

comment on column public.entregas.codigo_verificacao is
  'Preenchido por gatilho. Existe como coluna, e não como índice de expressão, porque a conta depende do fuso da sessão e não pode ser declarada imutável.';

create or replace function public.entregas_preencher_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo_verificacao := public.calcular_codigo_verificacao(
    new.id, new.created_at, new.assinatura_colaborador
  );
  return new;
end;
$$;

drop trigger if exists trg_entregas_codigo_verificacao on public.entregas;
create trigger trg_entregas_codigo_verificacao
  before insert or update of assinatura_colaborador, created_at
  on public.entregas
  for each row execute function public.entregas_preencher_codigo();

update public.entregas
   set codigo_verificacao = public.calcular_codigo_verificacao(id, created_at, assinatura_colaborador)
 where assinatura_colaborador is not null
   and codigo_verificacao is distinct from public.calcular_codigo_verificacao(id, created_at, assinatura_colaborador);

create index if not exists entregas_codigo_verificacao_idx
  on public.entregas (codigo_verificacao)
  where codigo_verificacao is not null;

-- Abrevia o nome para a página pública: primeiro nome inteiro, o resto em
-- iniciais. O suficiente para quem tem o papel na mão conferir que é a mesma
-- pessoa, sem publicar o nome completo de um trabalhador numa URL aberta.
create or replace function public.abreviar_nome(p_nome text)
returns text
language sql
immutable
as $$
  select case
    when p_nome is null or btrim(p_nome) = '' then null
    else (
      select string_agg(
               case when i = 1 then parte else left(parte, 1) || '.' end,
               ' ' order by i
             )
      from (
        select parte, row_number() over () as i
        from regexp_split_to_table(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), ' ') as parte
      ) partes
    )
  end;
$$;

-- Consulta pública da autenticidade de uma entrega pelo código impresso.
--
-- SECURITY DEFINER porque quem consulta não está autenticado e não tem — nem
-- deve ter — acesso às tabelas. Devolve só o mínimo para conferir o papel:
-- empresa, nome abreviado, data, EPI e CA. Nada de CPF, matrícula, imagem da
-- assinatura ou foto.
--
-- Não há risco de varredura: o código tem 160 bits de entropia, então não se
-- chega a um registro sem ter o papel na mão.
create or replace function public.verificar_ficha(p_codigo text)
returns table (
  encontrado boolean,
  empresa text,
  funcionario text,
  cargo text,
  data_entrega date,
  assinado_em timestamptz,
  epi text,
  ca text,
  tipo text,
  quantidade integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    true,
    emp.nome,
    public.abreviar_nome(f.nome),
    f.cargo,
    e.data,
    e.created_at,
    epi.nome,
    epi.ca,
    e.tipo::text,
    e.quantidade
  from public.entregas e
  left join public.funcionarios f on f.id = e.funcionario_id
  left join public.empresa_config emp on emp.id = e.empresa_id
  left join public.epis epi on epi.id = e.epi_id
  where e.codigo_verificacao = lower(btrim(p_codigo))
  limit 1;
$$;

comment on function public.verificar_ficha is
  'Consulta pública pelo código impresso na Ficha de EPI. Devolve zero linhas quando o código não existe.';

revoke all on function public.verificar_ficha(text) from public;
grant execute on function public.verificar_ficha(text) to anon, authenticated;
grant execute on function public.abreviar_nome(text) to anon, authenticated;
