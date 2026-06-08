-- Garante que as políticas de RLS sejam rigorosas quanto ao empresa_id
-- Remove políticas que possam ser muito permissivas e recria com foco total no isolamento

-- 1. ASOS
DROP POLICY IF EXISTS "Users can manage their company asos" ON public.asos;
DROP POLICY IF EXISTS "asos_empresa_select" ON public.asos;
DROP POLICY IF EXISTS "asos_empresa_insert" ON public.asos;
DROP POLICY IF EXISTS "asos_empresa_update" ON public.asos;
DROP POLICY IF EXISTS "asos_empresa_delete" ON public.asos;

CREATE POLICY "asos_isolation_select" ON public.asos FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "asos_isolation_insert" ON public.asos FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "asos_isolation_update" ON public.asos FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "asos_isolation_delete" ON public.asos FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- 2. FUNCIONARIOS (Reforço)
DROP POLICY IF EXISTS "Users can manage their own company data" ON public.funcionarios;
DROP POLICY IF EXISTS "Tenant read funcionarios" ON public.funcionarios;

CREATE POLICY "funcionarios_isolation_all" ON public.funcionarios FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- 3. ASO_MEDICOS (Garante que médicos vinculados a uma empresa não vazem para outras)
DROP POLICY IF EXISTS "aso_medicos_empresa_select" ON public.aso_medicos;
DROP POLICY IF EXISTS "aso_medicos_empresa_write" ON public.aso_medicos;

CREATE POLICY "aso_medicos_isolation_select" ON public.aso_medicos FOR SELECT TO authenticated
USING (empresa_id IS NULL OR is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "aso_medicos_isolation_write" ON public.aso_medicos FOR INSERT TO authenticated
WITH CHECK (empresa_id IS NULL OR is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
