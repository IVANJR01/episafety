-- Allow filial users to read EPIs from parent company (matriz)
CREATE POLICY "Tenant read epis from parent company"
  ON public.epis FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );