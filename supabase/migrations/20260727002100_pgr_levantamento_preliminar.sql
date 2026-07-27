-- ============================================================================
-- FASE 3.2 — Levantamento preliminar de perigos (Etapa 3)
-- ============================================================================
-- A NR-01 1.5.4.3 exige que o levantamento preliminar de perigos seja registrado
-- com sua ORIGEM, e 1.5.4.2 exige a participação dos trabalhadores. Hoje não há
-- onde guardar "de onde veio a informação", quem levantou, quando e com qual
-- evidência — o inventário nasce sem rastreabilidade.
--
-- Uma linha aqui = um perigo levantado em uma unidade de avaliação. Quando o
-- perigo evolui para avaliação de risco, inventario_item_id passa a apontar para
-- o item gerado; perigos descartados permanecem com a justificativa registrada,
-- que é justamente a evidência de que foram considerados e por que não entraram.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pgr_levantamento_preliminar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,

  -- Unidade de avaliação (todas opcionais: o levantamento pode ser por ambiente,
  -- por setor ou por GES, conforme o nível em que o perigo foi identificado)
  estabelecimento_id uuid REFERENCES public.sst_estabelecimentos(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ges_id uuid REFERENCES public.sst_ges(id) ON DELETE SET NULL,

  perigo_descricao text NOT NULL,
  grupo text,
  fonte_circunstancia text,

  -- Origem da informação (NR-01 1.5.4.3.1)
  origem text NOT NULL DEFAULT 'inspecao',
  origem_detalhe text,
  data_levantamento date NOT NULL DEFAULT current_date,
  responsavel_nome text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  evidencia_descricao text,
  evidencia_url text,

  -- Encaminhamento: tratar direto, aprofundar, ou não identificado (com motivo)
  tratamento text NOT NULL DEFAULT 'avaliacao_aprofundada',
  justificativa text,

  -- Sinalizadores exigidos pela Etapa 3
  perigo_emergente boolean NOT NULL DEFAULT false,
  mudanca_planejada text,
  interacao_contratante boolean NOT NULL DEFAULT false,

  -- Preenchido quando o perigo vira item do inventário
  inventario_item_id uuid REFERENCES public.pgr_inventario_itens(id) ON DELETE SET NULL,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_levantamento_preliminar
  DROP CONSTRAINT IF EXISTS pgr_lev_origem_chk;
ALTER TABLE public.pgr_levantamento_preliminar
  ADD CONSTRAINT pgr_lev_origem_chk CHECK (origem IN (
    'inspecao','entrevista','participacao_trabalhadores','cipa','aep',
    'laudo','medicao','acidente','doenca','fispq_fds',
    'inventario_anterior','requisito_legal','outro'
  ));

ALTER TABLE public.pgr_levantamento_preliminar
  DROP CONSTRAINT IF EXISTS pgr_lev_tratamento_chk;
ALTER TABLE public.pgr_levantamento_preliminar
  ADD CONSTRAINT pgr_lev_tratamento_chk CHECK (tratamento IN (
    'tratado_diretamente','avaliacao_aprofundada','nao_identificado'
  ));

-- "Não identificado" sem justificativa é exatamente o que a norma não aceita:
-- é preciso registrar POR QUE o perigo foi descartado.
ALTER TABLE public.pgr_levantamento_preliminar
  DROP CONSTRAINT IF EXISTS pgr_lev_justificativa_chk;
ALTER TABLE public.pgr_levantamento_preliminar
  ADD CONSTRAINT pgr_lev_justificativa_chk CHECK (
    tratamento <> 'nao_identificado'
    OR (justificativa IS NOT NULL AND length(btrim(justificativa)) >= 5)
  );

COMMENT ON TABLE public.pgr_levantamento_preliminar IS
  'Levantamento preliminar de perigos (NR-01 1.5.4.3): origem da informação, data, responsável e evidência. Perigos descartados permanecem registrados com justificativa.';
COMMENT ON COLUMN public.pgr_levantamento_preliminar.interacao_contratante IS
  'Marca risco de interação entre contratante e contratada, que exige alerta e tratativa conjunta.';

CREATE INDEX IF NOT EXISTS pgr_lev_pgr_idx ON public.pgr_levantamento_preliminar (pgr_id);
CREATE INDEX IF NOT EXISTS pgr_lev_item_idx ON public.pgr_levantamento_preliminar (inventario_item_id);
CREATE INDEX IF NOT EXISTS pgr_lev_pendente_idx
  ON public.pgr_levantamento_preliminar (pgr_id)
  WHERE tratamento = 'avaliacao_aprofundada' AND inventario_item_id IS NULL;

DROP TRIGGER IF EXISTS trg_pgr_lev_child_guard ON public.pgr_levantamento_preliminar;
CREATE TRIGGER trg_pgr_lev_child_guard
  BEFORE INSERT OR UPDATE ON public.pgr_levantamento_preliminar
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();

DROP TRIGGER IF EXISTS trg_pgr_lev_updated_at ON public.pgr_levantamento_preliminar;
CREATE TRIGGER trg_pgr_lev_updated_at
  BEFORE UPDATE ON public.pgr_levantamento_preliminar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_levantamento_preliminar TO authenticated;
GRANT ALL ON public.pgr_levantamento_preliminar TO service_role;
ALTER TABLE public.pgr_levantamento_preliminar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgr_lev_select ON public.pgr_levantamento_preliminar;
CREATE POLICY pgr_lev_select ON public.pgr_levantamento_preliminar FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_lev_insert ON public.pgr_levantamento_preliminar;
CREATE POLICY pgr_lev_insert ON public.pgr_levantamento_preliminar FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_lev_update ON public.pgr_levantamento_preliminar;
CREATE POLICY pgr_lev_update ON public.pgr_levantamento_preliminar FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_lev_delete ON public.pgr_levantamento_preliminar;
CREATE POLICY pgr_lev_delete ON public.pgr_levantamento_preliminar FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
