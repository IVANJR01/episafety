-- ============================================================================
-- FASE 0 — Unificação da classificação de risco do PGR (escala de 5 níveis)
-- ============================================================================
-- PROBLEMA CORRIGIDO
-- Existiam TRÊS escalas divergentes convivendo no sistema:
--   1. SQL  public.pgr_classificar_risco : >=20 critico, >=12 alto, >=6 moderado, else baixo
--   2. TS   classificarRisco()           : <=4 baixo, <=9 moderado, <=16 alto, >16 critico
--   3. TS   classificarRiscoPGR()        : 1-3 / 4-8 / 9-12 / 13-15 / 16-25
-- Consequência: para nivel_risco = 10 o banco gravava "moderado" enquanto a matriz
-- desenhada na tela e no PDF pintava "alto"; para 18 o banco gravava "alto" e o PDF
-- imprimia "crítico". O documento emitido divergia do dado armazenado.
--
-- DECISÃO
-- Passa a valer uma única escala — a de 5 níveis usada nos documentos reais de PGR:
--   1-3 Trivial | 4-8 Tolerável | 9-12 Moderado | 13-15 Substancial | 16-25 Intolerável
--
-- A coluna deixa de ser ENUM e passa a ser TEXT com CHECK. Isso é intencional:
-- na Fase 2 a matriz vira versionada (sst_matriz_*) e os nomes das classes passam a
-- vir de dados, não de um tipo fixo do banco.
--
-- Migration aditiva/reversível: nenhuma coluna é removida, nenhum dado é apagado.
-- ============================================================================

-- 1) ENUM -> TEXT ------------------------------------------------------------
ALTER TABLE public.pgr_inventario_itens
  ALTER COLUMN classificacao TYPE text USING classificacao::text;

-- 2) Função única de classificação (5 níveis) --------------------------------
-- CREATE OR REPLACE não altera o tipo de retorno; é preciso remover antes.
DROP FUNCTION IF EXISTS public.pgr_classificar_risco(int, int);

CREATE FUNCTION public.pgr_classificar_risco(_sev int, _prob int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE
    -- Sem avaliação não se inventa classe: retorna NULL ("não avaliado"),
    -- em vez de rebaixar silenciosamente para a menor classe.
    WHEN _sev IS NULL OR _prob IS NULL THEN NULL
    WHEN _sev NOT BETWEEN 1 AND 5 OR _prob NOT BETWEEN 1 AND 5 THEN NULL
    WHEN (_sev * _prob) <= 3  THEN 'trivial'
    WHEN (_sev * _prob) <= 8  THEN 'toleravel'
    WHEN (_sev * _prob) <= 12 THEN 'moderado'
    WHEN (_sev * _prob) <= 15 THEN 'substancial'
    ELSE 'intoleravel'
  END
$$;

COMMENT ON FUNCTION public.pgr_classificar_risco(int, int) IS
  'Escala única do PGR (5 níveis): 1-3 trivial, 4-8 toleravel, 9-12 moderado, 13-15 substancial, 16-25 intoleravel. Retorna NULL quando severidade/probabilidade não foram avaliadas.';

-- 3) Guard de filhos: recalcular classificação e necessita_acao ---------------
-- necessita_acao passa a marcar "moderado" e acima (nivel_risco >= 9).
-- Antes o corte era nivel_risco >= 12; a faixa foi ampliada porque as classes
-- antigas 'alto'/'critico' deixaram de existir e 9-12 (moderado) exige tratamento
-- documentado no plano de ação. É uma ampliação de cobertura, nunca redução.
CREATE OR REPLACE FUNCTION public.pgr_child_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _emp uuid;
BEGIN
  SELECT empresa_id INTO _emp FROM public.pgr_documentos WHERE id = NEW.pgr_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'PGR inexistente'; END IF;
  NEW.empresa_id := _emp;
  IF TG_TABLE_NAME = 'pgr_inventario_itens' THEN
    NEW.classificacao := public.pgr_classificar_risco(NEW.severidade, NEW.probabilidade);
    NEW.necessita_acao := COALESCE(
      NEW.classificacao IN ('moderado','substancial','intoleravel'), false);
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Backfill dos itens já existentes ----------------------------------------
-- Os triggers de guard são suspensos apenas durante o backfill: eles recalculariam
-- exatamente os mesmos valores, e trg_pgr_inv_justificativa poderia abortar a
-- migration por causa de dados legados anteriores àquela regra.
ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_justificativa;

UPDATE public.pgr_inventario_itens
   SET classificacao  = public.pgr_classificar_risco(severidade, probabilidade),
       necessita_acao = COALESCE(
         public.pgr_classificar_risco(severidade, probabilidade)
           IN ('moderado','substancial','intoleravel'), false);

ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_justificativa;

-- 5) Trava de integridade ----------------------------------------------------
ALTER TABLE public.pgr_inventario_itens
  DROP CONSTRAINT IF EXISTS pgr_inv_classificacao_chk;
ALTER TABLE public.pgr_inventario_itens
  ADD CONSTRAINT pgr_inv_classificacao_chk
  CHECK (classificacao IS NULL OR classificacao IN
    ('trivial','toleravel','moderado','substancial','intoleravel'));

COMMENT ON COLUMN public.pgr_inventario_itens.classificacao IS
  'Classe de risco na escala de 5 níveis. Calculada pelo trigger a partir de severidade x probabilidade; NULL = não avaliado.';

-- 6) O ENUM antigo fica órfão de propósito -----------------------------------
-- public.pgr_risco_classe não é removido: migrations anteriores o referenciam e
-- removê-lo tornaria o histórico irreproduzível. Nenhuma coluna o utiliza mais.
COMMENT ON TYPE public.pgr_risco_classe IS
  'OBSOLETO desde 2026-07-27. Substituído pela escala de 5 níveis em texto. Não usar em novas colunas.';
