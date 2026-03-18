-- Allow filial users to read entregas from parent company (matriz)
CREATE POLICY "Tenant read entregas from parent company"
  ON public.entregas FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );

-- Allow filial users to insert entregas with parent company empresa_id
CREATE POLICY "Tenant insert entregas from parent company"
  ON public.entregas FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );

-- Allow filial users to update entregas from parent company
CREATE POLICY "Tenant update entregas from parent company"
  ON public.entregas FOR UPDATE
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );

-- Allow filial users to delete entregas from parent company
CREATE POLICY "Tenant delete entregas from parent company"
  ON public.entregas FOR DELETE
  TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_pai_id FROM empresa_config WHERE id = get_user_empresa_id(auth.uid())
    )
  );
