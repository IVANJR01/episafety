-- ============================================================================
-- FASE 3.3/3.4 — Medições quantitativas e hierarquia de controles
-- ============================================================================
-- Dois problemas de modelagem no inventário atual:
--
-- 1. MEDIÇÕES — pgr_inventario_itens tem medicao_valor/medicao_unidade como
--    escalar único. Um mesmo agente costuma ter várias medições (pontos, datas,
--    jornadas distintas), e a NR-01 pede fonte do limite, técnica, instrumento e
--    responsável. Tudo isso não cabe em uma coluna numérica.
--
-- 2. CONTROLES — controles_existentes é text[]: uma lista de frases soltas. Não
--    dá para saber se a medida é eliminação, EPC ou EPI, e portanto não dá para
--    aplicar a hierarquia de medidas de controle (NR-01 1.5.4.4.3), nem para
--    impedir que EPI seja tratado como controle suficiente por si só.
--
-- As colunas antigas são MANTIDAS: continuam alimentando as telas e o PDF atuais
-- e passam a funcionar como resumo do registro mais recente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Medições / avaliações quantitativas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_avaliacao_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  inventario_item_id uuid NOT NULL REFERENCES public.pgr_inventario_itens(id) ON DELETE CASCADE,

  tipo_avaliacao text NOT NULL DEFAULT 'quantitativa',
  data_avaliacao date,
  responsavel_nome text,
  responsavel_registro text,

  ponto_amostragem text,
  tecnica text,
  instrumento text,
  instrumento_certificado text,
  instrumento_calibracao_validade date,

  resultado numeric,
  unidade text,
  incerteza numeric,
  limite_valor text,
  limite_fonte text,
  excedente boolean,

  jornada_considerada text,
  parecer_tecnico text,
  laudo_url text,
  validade_ate date,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_avaliacao_medicoes
  DROP CONSTRAINT IF EXISTS pgr_med_tipo_chk;
ALTER TABLE public.pgr_avaliacao_medicoes
  ADD CONSTRAINT pgr_med_tipo_chk CHECK (tipo_avaliacao IN (
    'qualitativa','quantitativa','semiquantitativa','ergonomica'
  ));

-- Resultado numérico sem unidade é dado inútil e não auditável.
ALTER TABLE public.pgr_avaliacao_medicoes
  DROP CONSTRAINT IF EXISTS pgr_med_unidade_chk;
ALTER TABLE public.pgr_avaliacao_medicoes
  ADD CONSTRAINT pgr_med_unidade_chk CHECK (
    resultado IS NULL OR (unidade IS NOT NULL AND length(btrim(unidade)) > 0)
  );

COMMENT ON TABLE public.pgr_avaliacao_medicoes IS
  'Medições e avaliações por item de inventário. Substitui o par escalar medicao_valor/medicao_unidade, que só comportava um resultado por risco.';
COMMENT ON COLUMN public.pgr_avaliacao_medicoes.limite_fonte IS
  'Norma ou referência de onde veio o limite (ex.: NR-15 Anexo 1, ACGIH TLV). Exigido para rastreabilidade da avaliação quantitativa.';

CREATE INDEX IF NOT EXISTS pgr_med_item_idx
  ON public.pgr_avaliacao_medicoes (inventario_item_id, data_avaliacao DESC);

DROP TRIGGER IF EXISTS trg_pgr_med_child_guard ON public.pgr_avaliacao_medicoes;
CREATE TRIGGER trg_pgr_med_child_guard
  BEFORE INSERT OR UPDATE ON public.pgr_avaliacao_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();

DROP TRIGGER IF EXISTS trg_pgr_med_updated_at ON public.pgr_avaliacao_medicoes;
CREATE TRIGGER trg_pgr_med_updated_at
  BEFORE UPDATE ON public.pgr_avaliacao_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_avaliacao_medicoes TO authenticated;
GRANT ALL ON public.pgr_avaliacao_medicoes TO service_role;
ALTER TABLE public.pgr_avaliacao_medicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgr_med_select ON public.pgr_avaliacao_medicoes;
CREATE POLICY pgr_med_select ON public.pgr_avaliacao_medicoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_med_insert ON public.pgr_avaliacao_medicoes;
CREATE POLICY pgr_med_insert ON public.pgr_avaliacao_medicoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_med_update ON public.pgr_avaliacao_medicoes;
CREATE POLICY pgr_med_update ON public.pgr_avaliacao_medicoes FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_med_delete ON public.pgr_avaliacao_medicoes;
CREATE POLICY pgr_med_delete ON public.pgr_avaliacao_medicoes FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- ---------------------------------------------------------------------------
-- Controles existentes, classificados pela hierarquia de medidas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_risco_controles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  inventario_item_id uuid NOT NULL REFERENCES public.pgr_inventario_itens(id) ON DELETE CASCADE,

  -- Hierarquia da NR-01 1.5.4.4.3, da mais eficaz para a menos eficaz
  hierarquia text NOT NULL,
  descricao text NOT NULL,
  implementado boolean NOT NULL DEFAULT true,
  data_implantacao date,
  eficacia text,
  observacao text,

  -- Específicos de EPI
  epi_ca text,
  epi_validade date,
  epi_periodicidade_troca text,
  epi_fator_protecao text,
  epi_treinamento_realizado boolean,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_risco_controles
  DROP CONSTRAINT IF EXISTS pgr_ctrl_hierarquia_chk;
ALTER TABLE public.pgr_risco_controles
  ADD CONSTRAINT pgr_ctrl_hierarquia_chk CHECK (hierarquia IN (
    'eliminacao',
    'substituicao',
    'engenharia_epc',
    'administrativa',
    'treinamento_procedimento',
    'epi',
    'monitoramento_saude',
    'preparacao_emergencia'
  ));

ALTER TABLE public.pgr_risco_controles
  DROP CONSTRAINT IF EXISTS pgr_ctrl_eficacia_chk;
ALTER TABLE public.pgr_risco_controles
  ADD CONSTRAINT pgr_ctrl_eficacia_chk CHECK (eficacia IS NULL OR eficacia IN (
    'nao_avaliada','ineficaz','parcialmente_eficaz','eficaz'
  ));

COMMENT ON TABLE public.pgr_risco_controles IS
  'Medidas de controle existentes por risco, classificadas na hierarquia da NR-01 1.5.4.4.3. Substitui o text[] controles_existentes, que não permitia distinguir EPC de EPI.';
COMMENT ON COLUMN public.pgr_risco_controles.hierarquia IS
  'Ordem de eficácia decrescente. EPI nunca é controle suficiente por si só — a avaliação do risco deve considerar a ausência de medidas superiores.';

CREATE INDEX IF NOT EXISTS pgr_ctrl_item_idx
  ON public.pgr_risco_controles (inventario_item_id, hierarquia);

DROP TRIGGER IF EXISTS trg_pgr_ctrl_child_guard ON public.pgr_risco_controles;
CREATE TRIGGER trg_pgr_ctrl_child_guard
  BEFORE INSERT OR UPDATE ON public.pgr_risco_controles
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();

DROP TRIGGER IF EXISTS trg_pgr_ctrl_updated_at ON public.pgr_risco_controles;
CREATE TRIGGER trg_pgr_ctrl_updated_at
  BEFORE UPDATE ON public.pgr_risco_controles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_risco_controles TO authenticated;
GRANT ALL ON public.pgr_risco_controles TO service_role;
ALTER TABLE public.pgr_risco_controles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgr_ctrl_select ON public.pgr_risco_controles;
CREATE POLICY pgr_ctrl_select ON public.pgr_risco_controles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_ctrl_insert ON public.pgr_risco_controles;
CREATE POLICY pgr_ctrl_insert ON public.pgr_risco_controles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_ctrl_update ON public.pgr_risco_controles;
CREATE POLICY pgr_ctrl_update ON public.pgr_risco_controles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
DROP POLICY IF EXISTS pgr_ctrl_delete ON public.pgr_risco_controles;
CREATE POLICY pgr_ctrl_delete ON public.pgr_risco_controles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- ---------------------------------------------------------------------------
-- Migração dos dados já existentes
-- ---------------------------------------------------------------------------
-- controles_existentes (text[]) vira uma linha por medida. A hierarquia não pode
-- ser adivinhada a partir de texto livre, então tudo entra como 'administrativa'
-- e fica pendente de reclassificação pelo técnico — marcado na observação para
-- que a revisão saiba exatamente o que precisa ser revisto.
INSERT INTO public.pgr_risco_controles
  (pgr_id, empresa_id, inventario_item_id, hierarquia, descricao, observacao)
SELECT i.pgr_id, i.empresa_id, i.id, 'administrativa', btrim(c.valor),
       'Migrado de controles_existentes — hierarquia precisa ser reclassificada.'
  FROM public.pgr_inventario_itens i
  CROSS JOIN LATERAL unnest(COALESCE(i.controles_existentes, ARRAY[]::text[])) AS c(valor)
 WHERE btrim(c.valor) <> ''
   AND upper(btrim(c.valor)) NOT IN ('N.A','N/A','NA')
   AND NOT EXISTS (
     SELECT 1 FROM public.pgr_risco_controles rc WHERE rc.inventario_item_id = i.id
   );

-- Medições escalares já registradas viram a primeira linha de medição.
INSERT INTO public.pgr_avaliacao_medicoes
  (pgr_id, empresa_id, inventario_item_id, tipo_avaliacao, resultado, unidade,
   limite_valor, excedente, tecnica, parecer_tecnico)
SELECT i.pgr_id, i.empresa_id, i.id,
       COALESCE(NULLIF(i.avaliacao_tipo::text,''), 'quantitativa'),
       i.medicao_valor, i.medicao_unidade,
       NULLIF(btrim(COALESCE(i.limite_tolerancia,'')), ''),
       i.excedente,
       NULLIF(btrim(COALESCE(i.tecnica_utilizada,'')), ''),
       'Migrado das colunas escalares do inventário.'
  FROM public.pgr_inventario_itens i
 WHERE i.medicao_valor IS NOT NULL
   AND COALESCE(btrim(i.medicao_unidade), '') <> ''
   AND NOT EXISTS (
     SELECT 1 FROM public.pgr_avaliacao_medicoes m WHERE m.inventario_item_id = i.id
   );

COMMENT ON COLUMN public.pgr_inventario_itens.controles_existentes IS
  'LEGADO: lista de medidas em texto livre. Preservado para as telas atuais; a fonte estruturada é pgr_risco_controles.';
COMMENT ON COLUMN public.pgr_inventario_itens.medicao_valor IS
  'LEGADO: resultado escalar único. Preservado como resumo; a fonte estruturada é pgr_avaliacao_medicoes.';
