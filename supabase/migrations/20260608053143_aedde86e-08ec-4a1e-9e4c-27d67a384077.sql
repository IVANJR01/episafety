-- Remove a política global permissiva para Principals que causava mistura de dados
DROP POLICY IF EXISTS "asos_principal" ON public.asos;
DROP POLICY IF EXISTS "Principal read funcionarios company tree" ON public.funcionarios;
DROP POLICY IF EXISTS "Principal update funcionarios company tree" ON public.funcionarios;
DROP POLICY IF EXISTS "Principal insert funcionarios company tree" ON public.funcionarios;
DROP POLICY IF EXISTS "Principal delete funcionarios company tree" ON public.funcionarios;
DROP POLICY IF EXISTS "aso_medicos_principal" ON public.aso_medicos;

-- Garante que todas as tabelas críticas usem a função is_in_user_company_tree 
-- que respeita o vínculo específico do usuário logado.

-- Reforça a política de ASOS
DROP POLICY IF EXISTS "asos_isolation_select" ON public.asos;
CREATE POLICY "asos_isolation_select" ON public.asos FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- Reforça a política de Funcionários
DROP POLICY IF EXISTS "funcionarios_isolation_all" ON public.funcionarios;
CREATE POLICY "funcionarios_isolation_all" ON public.funcionarios FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- Garante que o catálogo de exames também esteja isolado
DROP POLICY IF EXISTS "aso_cat_isolation_select" ON public.aso_exames_catalogo;
CREATE POLICY "aso_cat_isolation_select" ON public.aso_exames_catalogo FOR SELECT TO authenticated
USING (empresa_id IS NULL OR is_super_admin(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
