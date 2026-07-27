-- ============================================================================
-- FASE 3.1 — Risco inicial, atual e residual + justificativa técnica
-- ============================================================================
-- Hoje pgr_inventario_itens guarda UM único par severidade/probabilidade. A
-- NR-01 1.5.4.4.6 exige reavaliar o risco após a implantação de medidas, e o
-- plano de ação precisa comparar "antes" e "depois" para demonstrar eficácia.
--
-- Convenção adotada (as colunas antigas NÃO mudam de significado):
--   severidade / probabilidade ............ risco ATUAL, com os controles hoje existentes
--   severidade_inicial / probabilidade_inicial ... cenário ANTES dos controles
--   severidade_residual / probabilidade_residual . risco ESPERADO após as ações do plano
--
-- Manter severidade/probabilidade como "atual" preserva o comportamento de todas
-- as telas, PDFs e do índice pgr_inv_dedupe já existentes.
--
-- A justificativa técnica de probabilidade e severidade deixa de ser opcional
-- na prática: passa a ter coluna própria, e o painel de pendências da Fase 5
-- cobrará o preenchimento.
-- ============================================================================

ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS severidade_inicial     smallint,
  ADD COLUMN IF NOT EXISTS probabilidade_inicial  smallint,
  ADD COLUMN IF NOT EXISTS classificacao_inicial  text,
  ADD COLUMN IF NOT EXISTS severidade_residual    smallint,
  ADD COLUMN IF NOT EXISTS probabilidade_residual smallint,
  ADD COLUMN IF NOT EXISTS classificacao_residual text,
  ADD COLUMN IF NOT EXISTS justificativa_severidade    text,
  ADD COLUMN IF NOT EXISTS justificativa_probabilidade text,
  -- Gancho para a Fase 2 (matriz versionada). Fica nulo até que o motor de
  -- matriz exista; a partir de lá, registra QUAL matriz classificou este item.
  ADD COLUMN IF NOT EXISTS matriz_versao_id uuid,
  -- Substitui o uso de "N.A" como preenchimento genérico: estados distintos e
  -- explícitos, conforme exigido para não esconder campo faltante.
  ADD COLUMN IF NOT EXISTS avaliacao_estado text NOT NULL DEFAULT 'avaliado';

ALTER TABLE public.pgr_inventario_itens
  DROP CONSTRAINT IF EXISTS pgr_inv_sev_prob_extra_chk;
ALTER TABLE public.pgr_inventario_itens
  ADD CONSTRAINT pgr_inv_sev_prob_extra_chk CHECK (
    (severidade_inicial     IS NULL OR severidade_inicial     BETWEEN 1 AND 5) AND
    (probabilidade_inicial  IS NULL OR probabilidade_inicial  BETWEEN 1 AND 5) AND
    (severidade_residual    IS NULL OR severidade_residual    BETWEEN 1 AND 5) AND
    (probabilidade_residual IS NULL OR probabilidade_residual BETWEEN 1 AND 5)
  );

ALTER TABLE public.pgr_inventario_itens
  DROP CONSTRAINT IF EXISTS pgr_inv_avaliacao_estado_chk;
ALTER TABLE public.pgr_inventario_itens
  ADD CONSTRAINT pgr_inv_avaliacao_estado_chk CHECK (avaliacao_estado IN (
    'avaliado',
    'nao_avaliado',
    'pendente',
    'nao_aplicavel',
    'sem_exposicao_identificada',
    'informacao_nao_disponivel'
  ));

COMMENT ON COLUMN public.pgr_inventario_itens.severidade IS
  'Risco ATUAL — com os controles hoje existentes.';
COMMENT ON COLUMN public.pgr_inventario_itens.severidade_inicial IS
  'Cenário ANTES dos controles. Base de comparação para demonstrar eficácia das medidas.';
COMMENT ON COLUMN public.pgr_inventario_itens.severidade_residual IS
  'Risco ESPERADO após concluir as ações do plano. Confirmado na verificação de eficácia.';
COMMENT ON COLUMN public.pgr_inventario_itens.avaliacao_estado IS
  'Estado da avaliação. Evita "N.A" genérico: distingue não avaliado, pendente, não aplicável, sem exposição identificada e informação não disponível.';
COMMENT ON COLUMN public.pgr_inventario_itens.matriz_versao_id IS
  'Versão da matriz de risco usada nesta avaliação (Fase 2). Nulo enquanto o motor versionado não existir.';

-- Estende o guard para classificar também o cenário inicial e o residual,
-- usando a MESMA função de classificação — nunca uma segunda escala.
CREATE OR REPLACE FUNCTION public.pgr_child_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _emp uuid;
BEGIN
  SELECT empresa_id INTO _emp FROM public.pgr_documentos WHERE id = NEW.pgr_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'PGR inexistente'; END IF;
  NEW.empresa_id := _emp;
  IF TG_TABLE_NAME = 'pgr_inventario_itens' THEN
    NEW.classificacao := public.pgr_classificar_risco(NEW.severidade, NEW.probabilidade);
    NEW.classificacao_inicial := public.pgr_classificar_risco(
      NEW.severidade_inicial, NEW.probabilidade_inicial);
    NEW.classificacao_residual := public.pgr_classificar_risco(
      NEW.severidade_residual, NEW.probabilidade_residual);
    NEW.necessita_acao := COALESCE(
      NEW.classificacao IN ('moderado','substancial','intoleravel'), false);
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill: itens já existentes ficam com o estado correto. Não se inventa
-- cenário inicial nem residual — eles permanecem nulos até avaliação real.
ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_justificativa;

UPDATE public.pgr_inventario_itens
   SET avaliacao_estado = CASE
         WHEN classificacao IS NULL THEN 'nao_avaliado'
         ELSE 'avaliado'
       END;

ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_justificativa;
