
-- Allow contract users to read entregas for employees in their contract
CREATE POLICY "Tenant read entregas by contract"
ON public.entregas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM funcionarios f
    JOIN usuarios_liberados ul ON ul.contrato_id = f.contrato_id
    WHERE f.id = entregas.funcionario_id
      AND lower(ul.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      AND ul.ativo = true
  )
);

-- Allow contract users to insert entregas for employees in their contract
CREATE POLICY "Tenant insert entregas by contract"
ON public.entregas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM funcionarios f
    JOIN usuarios_liberados ul ON ul.contrato_id = f.contrato_id
    WHERE f.id = entregas.funcionario_id
      AND lower(ul.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      AND ul.ativo = true
  )
);

-- Allow contract users to update entregas for employees in their contract
CREATE POLICY "Tenant update entregas by contract"
ON public.entregas FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM funcionarios f
    JOIN usuarios_liberados ul ON ul.contrato_id = f.contrato_id
    WHERE f.id = entregas.funcionario_id
      AND lower(ul.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      AND ul.ativo = true
  )
);
