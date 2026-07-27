-- ============================================================================
-- FASE 3.5/3.6 — Inventário aponta para o Núcleo Mestre + fim do sentinela "N.A"
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ghe_ges -> sst_ges (convivência, não substituição)
-- ---------------------------------------------------------------------------
-- pgr_inventario_itens.ghe_id referencia ghe_ges (hierarquia legada), enquanto o
-- Núcleo Mestre novo é sst_ges. Duas hierarquias vivas apontando para o mesmo
-- conceito é a raiz das divergências entre PGR, PCMSO, LTCAT e PPP.
--
-- OPÇÃO ADOTADA: backfill com ghe_id MANTIDO como fallback permanente.
-- Não se remove o legado nesta fase. Motivo: funcionarios.ghe_id -> ghe_ges e o
-- módulo ASO/RH ainda dependem dele, e PGRs já emitidos referenciam esses ids.
-- O backfill é seguro porque o espelhamento de GES grava o MESMO id nas duas
-- tabelas (ver saveGesMutation em useNucleoMestreSst) — ges_id e ghe_id apontam
-- para a mesma entidade, apenas em cadastros distintos.
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS ges_id uuid REFERENCES public.sst_ges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funcao_sst_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pgr_inventario_itens.ges_id IS
  'GES no Núcleo Mestre (sst_ges). Fonte preferencial. Quando nulo, usar ghe_id (legado).';
COMMENT ON COLUMN public.pgr_inventario_itens.ghe_id IS
  'LEGADO: GES em ghe_ges. Mantido como fallback permanente — funcionarios.ghe_id e o módulo ASO/RH ainda dependem dele.';

ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens DISABLE TRIGGER trg_pgr_inv_justificativa;

-- Só preenche onde existe correspondência real em sst_ges; nada é inventado.
UPDATE public.pgr_inventario_itens i
   SET ges_id = i.ghe_id
 WHERE i.ges_id IS NULL
   AND i.ghe_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.sst_ges g WHERE g.id = i.ghe_id);

UPDATE public.pgr_inventario_itens i
   SET funcao_sst_id = i.funcao_id
 WHERE i.funcao_sst_id IS NULL
   AND i.funcao_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.sst_funcoes f WHERE f.id = i.funcao_id);

-- ---------------------------------------------------------------------------
-- 2) Fim do sentinela "N.A"
-- ---------------------------------------------------------------------------
-- O formulário do inventário gravava a string literal "N.A" em todo campo de
-- texto deixado em branco. Isso mascara informação faltante: não distingue
-- "não aplicável" de "não avaliado" nem de "não informado", e faz um campo vazio
-- parecer preenchido em qualquer auditoria ou relatório.
--
-- O estado real passa a viver em avaliacao_estado (criada na Fase 3.1); os campos
-- de texto voltam a ser NULL quando não há informação.
-- Função auxiliar: anula APENAS o sentinela, preservando o texto real como foi
-- digitado. Comparar em maiúsculas e gravar o resultado da comparação destruiria
-- a capitalização de todos os campos.
CREATE OR REPLACE FUNCTION public.pgr_nullif_na(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = 'public' AS $$
  SELECT CASE
    WHEN _v IS NULL THEN NULL
    WHEN upper(btrim(_v)) IN ('N.A','N.A.','N/A','NA','') THEN NULL
    ELSE _v
  END
$$;

UPDATE public.pgr_inventario_itens SET
  descricao_ambiente = public.pgr_nullif_na(descricao_ambiente),
  setor              = public.pgr_nullif_na(setor),
  processo           = public.pgr_nullif_na(processo),
  tipo_agente        = public.pgr_nullif_na(tipo_agente),
  fonte_geradora     = public.pgr_nullif_na(fonte_geradora),
  lesoes             = public.pgr_nullif_na(lesoes),
  limite_tolerancia  = public.pgr_nullif_na(limite_tolerancia),
  intensidade        = public.pgr_nullif_na(intensidade),
  tempo_exposicao    = public.pgr_nullif_na(tempo_exposicao),
  tecnica_utilizada  = public.pgr_nullif_na(tecnica_utilizada),
  epi                = public.pgr_nullif_na(epi),
  atenuacao          = public.pgr_nullif_na(atenuacao)
WHERE public.pgr_nullif_na(descricao_ambiente) IS DISTINCT FROM descricao_ambiente
   OR public.pgr_nullif_na(setor)              IS DISTINCT FROM setor
   OR public.pgr_nullif_na(processo)           IS DISTINCT FROM processo
   OR public.pgr_nullif_na(tipo_agente)        IS DISTINCT FROM tipo_agente
   OR public.pgr_nullif_na(fonte_geradora)     IS DISTINCT FROM fonte_geradora
   OR public.pgr_nullif_na(lesoes)             IS DISTINCT FROM lesoes
   OR public.pgr_nullif_na(limite_tolerancia)  IS DISTINCT FROM limite_tolerancia
   OR public.pgr_nullif_na(intensidade)        IS DISTINCT FROM intensidade
   OR public.pgr_nullif_na(tempo_exposicao)    IS DISTINCT FROM tempo_exposicao
   OR public.pgr_nullif_na(tecnica_utilizada)  IS DISTINCT FROM tecnica_utilizada
   OR public.pgr_nullif_na(epi)                IS DISTINCT FROM epi
   OR public.pgr_nullif_na(atenuacao)          IS DISTINCT FROM atenuacao;

ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_child_guard;
ALTER TABLE public.pgr_inventario_itens ENABLE TRIGGER trg_pgr_inv_justificativa;

CREATE INDEX IF NOT EXISTS pgr_inv_ges_idx
  ON public.pgr_inventario_itens (ges_id) WHERE ges_id IS NOT NULL;
