DROP POLICY IF EXISTS "pgr_textos select" ON public.pgr_textos;
DROP POLICY IF EXISTS "pgr_textos insert" ON public.pgr_textos;
DROP POLICY IF EXISTS "pgr_textos update" ON public.pgr_textos;
DROP POLICY IF EXISTS "pgr_textos delete" ON public.pgr_textos;

CREATE POLICY "pgr_textos select" ON public.pgr_textos FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "pgr_textos insert" ON public.pgr_textos FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "pgr_textos update" ON public.pgr_textos FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "pgr_textos delete" ON public.pgr_textos FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
