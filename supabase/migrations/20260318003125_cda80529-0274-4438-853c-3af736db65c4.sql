-- Allow filial users to read funcionarios from parent company (matriz)
-- This ensures employees created by the Principal at the matriz level
-- are visible to all filial/unit users
CREATE POLICY "Tenant read funcionarios from parent company"
  ON public.funcionarios FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );
