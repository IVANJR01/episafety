DROP POLICY IF EXISTS "locais_emissao_select" ON public.locais_emissao_aso;

CREATE POLICY "locais_emissao_select" ON public.locais_emissao_aso
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
    OR empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
  );