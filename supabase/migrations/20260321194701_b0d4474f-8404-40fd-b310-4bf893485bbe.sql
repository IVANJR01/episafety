
-- Allow Principal users to read entregas by employee's company tree
-- (e.g., CG3 Principal can see entregas of CG3 employees even if empresa_id differs)
CREATE POLICY "Principal read entregas by employee company"
ON public.entregas FOR SELECT TO authenticated
USING (
  is_principal(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM funcionarios f
    WHERE f.id = entregas.funcionario_id
      AND is_in_user_company_tree(auth.uid(), f.empresa_id)
  )
);

-- Allow regular users to read entregas of employees in their company
CREATE POLICY "Tenant read entregas by employee"
ON public.entregas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM funcionarios f
    WHERE f.id = entregas.funcionario_id
      AND f.empresa_id = get_user_empresa_id(auth.uid())
  )
);
