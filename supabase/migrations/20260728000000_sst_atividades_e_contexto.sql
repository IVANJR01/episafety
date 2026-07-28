-- ============================================================================
-- ATIVIDADE COMO ENTIDADE + CONTEXTO HIERÁRQUICO NO INVENTÁRIO
-- ============================================================================
-- A hierarquia técnica do PGR é:
--   Empresa > Unidade > Ambiente > Processo > Setor > GES > Função > Atividade
--   > Perigo > Avaliação > Ação > Risco residual
--
-- Dois elos faltavam:
--
-- 1) ATIVIDADE. Hoje ela existe apenas como texto livre em
--    sst_funcoes.descricao_atividades. Não dá para pendurar um perigo em uma
--    atividade, nem dizer que a mesma atividade é executada por duas funções.
--    Vira tabela própria, com vínculo N:N para função — uma atividade pode ser
--    de mais de uma função (ex.: "içamento de carga" para operador e sinaleiro).
--
-- 2) CONTEXTO EM FK NO INVENTÁRIO. pgr_inventario_itens guarda ambiente, setor e
--    processo como TEXTO livre (descricao_ambiente, setor, processo). Texto não
--    filtra, não agrega e diverge do cadastro assim que alguém renomeia o setor.
--    As colunas de texto ficam — PGRs já emitidos dependem delas e não podem ser
--    reescritos — e passam a conviver com as FKs, que são a fonte preferencial.
--
-- Tudo aditivo: nenhuma coluna é removida, nenhum dado é alterado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) sst_atividades
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,

  -- Função "dona" da atividade. Opcional: uma atividade pode ser cadastrada no
  -- nível do processo e só depois ser atribuída a funções via sst_atividade_funcoes.
  funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ges_id uuid REFERENCES public.sst_ges(id) ON DELETE SET NULL,

  nome text NOT NULL,
  codigo text,
  descricao text,

  -- Caracterização da execução (subsidia a análise de exposição)
  caracteristica text NOT NULL DEFAULT 'rotineira'
    CHECK (caracteristica IN ('rotineira', 'nao_rotineira', 'emergencia')),
  frequencia text,
  duracao text,
  habitualidade text,
  local_execucao text,
  maquinas text,
  ferramentas text,
  equipamentos text,
  produtos_utilizados text,
  postura_esforco text,
  trabalhadores_envolvidos integer CHECK (trabalhadores_envolvidos >= 0),
  observacoes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sst_atividades_empresa_idx ON public.sst_atividades (empresa_id);
CREATE INDEX IF NOT EXISTS sst_atividades_funcao_idx  ON public.sst_atividades (funcao_id) WHERE funcao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sst_atividades_ges_idx     ON public.sst_atividades (ges_id) WHERE ges_id IS NOT NULL;

COMMENT ON TABLE public.sst_atividades IS
  'Atividades executadas. Nível entre Função e Perigo na hierarquia do PGR.';

-- Vínculo N:N atividade <-> função: a mesma atividade pode ser executada por
-- funções diferentes. funcao_id na tabela acima é apenas a função de origem.
CREATE TABLE IF NOT EXISTS public.sst_atividade_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.sst_atividades(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.sst_funcoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atividade_id, funcao_id)
);

-- ---------------------------------------------------------------------------
-- 2) Campos organizacionais que o documento exige e não existiam
-- ---------------------------------------------------------------------------
ALTER TABLE public.sst_setores
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS turnos text,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.sst_funcoes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS turnos text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- O GES é o conceito mais confundido com "setor". Estes campos existem para
-- forçar a distinção: um GES precisa declarar POR QUE aquelas pessoas têm
-- exposição semelhante, e isso não se deduz do setor.
ALTER TABLE public.sst_ges
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS frequencia_exposicao text,
  ADD COLUMN IF NOT EXISTS justificativa_similaridade text,
  ADD COLUMN IF NOT EXISTS observacoes text;

COMMENT ON COLUMN public.sst_ges.justificativa_similaridade IS
  'Por que estes trabalhadores têm exposição semelhante. Sem isso o GES é apenas um setor renomeado.';

ALTER TABLE public.sst_ambientes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS localizacao text,
  ADD COLUMN IF NOT EXISTS area_m2 numeric CHECK (area_m2 >= 0),
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.sst_processos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entradas text,
  ADD COLUMN IF NOT EXISTS saida text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- ---------------------------------------------------------------------------
-- 3) Contexto hierárquico em FK no inventário
-- ---------------------------------------------------------------------------
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.sst_atividades(id) ON DELETE SET NULL,
  -- Campos descritivos exigidos pela NR-01 que não tinham coluna própria.
  ADD COLUMN IF NOT EXISTS circunstancia text,
  ADD COLUMN IF NOT EXISTS medidas_existentes text,
  ADD COLUMN IF NOT EXISTS grupo_expostos text;

COMMENT ON COLUMN public.pgr_inventario_itens.ambiente_id IS
  'Fonte preferencial. A coluna de texto descricao_ambiente permanece para PGRs já emitidos.';
COMMENT ON COLUMN public.pgr_inventario_itens.circunstancia IS
  'Circunstância em que o perigo se manifesta — distinta da fonte geradora.';

CREATE INDEX IF NOT EXISTS pgr_inv_ambiente_idx  ON public.pgr_inventario_itens (ambiente_id) WHERE ambiente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pgr_inv_setor_idx     ON public.pgr_inventario_itens (setor_id) WHERE setor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pgr_inv_atividade_idx ON public.pgr_inventario_itens (atividade_id) WHERE atividade_id IS NOT NULL;

-- Mesmo contexto no levantamento preliminar, que já tinha ambiente/setor/GES.
ALTER TABLE public.pgr_levantamento_preliminar
  ADD COLUMN IF NOT EXISTS funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.sst_atividades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4) RLS — mesmo isolamento multiempresa das demais tabelas sst_*
-- ---------------------------------------------------------------------------
ALTER TABLE public.sst_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_atividade_funcoes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_atividades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_atividade_funcoes TO authenticated;
GRANT ALL ON public.sst_atividades TO service_role;
GRANT ALL ON public.sst_atividade_funcoes TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_atividades') THEN
    CREATE POLICY "Empresa tenant isolation sst_atividades" ON public.sst_atividades
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_atividade_funcoes') THEN
    CREATE POLICY "Empresa tenant isolation sst_atividade_funcoes" ON public.sst_atividade_funcoes
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
END $$;

-- updated_at automático, no mesmo padrão das demais tabelas do Núcleo Mestre.
DROP TRIGGER IF EXISTS trg_sst_atividades_updated ON public.sst_atividades;
CREATE TRIGGER trg_sst_atividades_updated
  BEFORE UPDATE ON public.sst_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
