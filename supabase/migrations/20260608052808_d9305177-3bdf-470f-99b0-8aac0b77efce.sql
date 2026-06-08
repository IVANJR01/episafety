-- 1. LOCAIS DE EMISSÃO ASO
DROP POLICY IF EXISTS "locais_emissao_select" ON public.locais_emissao_aso;
DROP POLICY IF EXISTS "locais_emissao_insert" ON public.locais_emissao_aso;
DROP POLICY IF EXISTS "locais_emissao_update" ON public.locais_emissao_aso;
DROP POLICY IF EXISTS "locais_emissao_delete" ON public.locais_emissao_aso;

CREATE POLICY "locais_emissao_isolation_select" ON public.locais_emissao_aso FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "locais_emissao_isolation_insert" ON public.locais_emissao_aso FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "locais_emissao_isolation_update" ON public.locais_emissao_aso FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "locais_emissao_isolation_delete" ON public.locais_emissao_aso FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- 2. CATÁLOGO DE EXAMES ASO
DROP POLICY IF EXISTS "aso_cat_empresa_all" ON public.aso_exames_catalogo;
DROP POLICY IF EXISTS "aso_cat_super_admin" ON public.aso_exames_catalogo;

CREATE POLICY "aso_cat_isolation_select" ON public.aso_exames_catalogo FOR SELECT TO authenticated
USING (empresa_id IS NULL OR is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "aso_cat_isolation_write" ON public.aso_exames_catalogo FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
