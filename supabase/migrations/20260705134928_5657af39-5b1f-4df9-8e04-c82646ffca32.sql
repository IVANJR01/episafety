-- =====================================================================
-- LTCAT RLS v4: apenas is_active_empresa (Super Admin também limitado)
-- + coluna snapshot_json em ppp_pdf_versoes para PPP imutável
-- =====================================================================

-- ---------- ltcat_documentos ----------
DROP POLICY IF EXISTS ltcat_doc_select ON public.ltcat_documentos;
DROP POLICY IF EXISTS ltcat_doc_insert ON public.ltcat_documentos;
DROP POLICY IF EXISTS ltcat_doc_update ON public.ltcat_documentos;
DROP POLICY IF EXISTS ltcat_doc_delete ON public.ltcat_documentos;

CREATE POLICY ltcat_doc_select_v4 ON public.ltcat_documentos
  FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_doc_insert_v4 ON public.ltcat_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_doc_update_v4 ON public.ltcat_documentos
  FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_doc_delete_v4 ON public.ltcat_documentos
  FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_funcoes ----------
DROP POLICY IF EXISTS ltcat_func_all ON public.ltcat_funcoes;
CREATE POLICY ltcat_func_all_v4 ON public.ltcat_funcoes
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_agentes ----------
DROP POLICY IF EXISTS ltcat_ag_all ON public.ltcat_agentes;
CREATE POLICY ltcat_ag_all_v4 ON public.ltcat_agentes
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_grupos_homogeneos ----------
DROP POLICY IF EXISTS ltcat_ghe_all ON public.ltcat_grupos_homogeneos;
CREATE POLICY ltcat_ghe_all_v4 ON public.ltcat_grupos_homogeneos
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_avaliacoes ----------
DROP POLICY IF EXISTS ltcat_aval_all ON public.ltcat_avaliacoes;
CREATE POLICY ltcat_aval_all_v4 ON public.ltcat_avaliacoes
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_conclusoes ----------
DROP POLICY IF EXISTS ltcat_concl_all ON public.ltcat_conclusoes;
CREATE POLICY ltcat_concl_all_v4 ON public.ltcat_conclusoes
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_responsaveis_tecnicos ----------
DROP POLICY IF EXISTS ltcat_rt_all ON public.ltcat_responsaveis_tecnicos;
CREATE POLICY ltcat_rt_all_v4 ON public.ltcat_responsaveis_tecnicos
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_setores_avaliados ----------
DROP POLICY IF EXISTS ltcat_setor_all ON public.ltcat_setores_avaliados;
CREATE POLICY ltcat_setor_all_v4 ON public.ltcat_setores_avaliados
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_anexos ----------
DROP POLICY IF EXISTS ltcat_anx_all ON public.ltcat_anexos;
CREATE POLICY ltcat_anx_all_v4 ON public.ltcat_anexos
  FOR ALL TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_assinaturas ----------
DROP POLICY IF EXISTS ltcat_assin_select ON public.ltcat_assinaturas;
DROP POLICY IF EXISTS ltcat_assin_insert ON public.ltcat_assinaturas;
CREATE POLICY ltcat_assin_select_v4 ON public.ltcat_assinaturas
  FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_assin_insert_v4 ON public.ltcat_assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_pdf_versoes ----------
DROP POLICY IF EXISTS ltcat_pdfv_select ON public.ltcat_pdf_versoes;
DROP POLICY IF EXISTS ltcat_pdfv_insert ON public.ltcat_pdf_versoes;
CREATE POLICY ltcat_pdfv_select_v4 ON public.ltcat_pdf_versoes
  FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_pdfv_insert_v4 ON public.ltcat_pdf_versoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_revisoes ----------
DROP POLICY IF EXISTS ltcat_rev_select ON public.ltcat_revisoes;
DROP POLICY IF EXISTS ltcat_rev_insert ON public.ltcat_revisoes;
CREATE POLICY ltcat_rev_select_v4 ON public.ltcat_revisoes
  FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_rev_insert_v4 ON public.ltcat_revisoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- ltcat_catalogo_agentes ----------
-- Catálogo: entradas globais (empresa_id IS NULL) continuam legíveis por todos
-- autenticados; mutações escopadas por empresa ativa; super_admin mantém
-- capacidade de administrar apenas entradas globais.
DROP POLICY IF EXISTS ltcat_cat_select ON public.ltcat_catalogo_agentes;
DROP POLICY IF EXISTS ltcat_cat_mutate_empresa ON public.ltcat_catalogo_agentes;
DROP POLICY IF EXISTS ltcat_cat_mutate_super ON public.ltcat_catalogo_agentes;

CREATE POLICY ltcat_cat_select_v4 ON public.ltcat_catalogo_agentes
  FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_cat_mutate_empresa_v4 ON public.ltcat_catalogo_agentes
  FOR ALL TO authenticated
  USING (empresa_id IS NOT NULL AND public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (empresa_id IS NOT NULL AND public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY ltcat_cat_mutate_global_super_v4 ON public.ltcat_catalogo_agentes
  FOR ALL TO authenticated
  USING (empresa_id IS NULL AND public.is_super_admin(auth.uid()))
  WITH CHECK (empresa_id IS NULL AND public.is_super_admin(auth.uid()));

-- =====================================================================
-- SNAPSHOT IMUTÁVEL DO PPP EMITIDO
-- =====================================================================
ALTER TABLE public.ppp_pdf_versoes
  ADD COLUMN IF NOT EXISTS snapshot_json jsonb;

COMMENT ON COLUMN public.ppp_pdf_versoes.snapshot_json IS
  'Snapshot imutável dos dados do LTCAT/PPP no momento da emissão. Se o LTCAT mudar depois, o PPP emitido preserva o estado congelado aqui.';
