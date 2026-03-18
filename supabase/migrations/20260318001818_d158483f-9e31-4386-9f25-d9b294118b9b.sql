-- Allow filial users to read funcionarios where unidade_id matches their empresa_id
CREATE POLICY "Tenant read funcionarios by unidade"
  ON public.funcionarios FOR SELECT
  TO authenticated
  USING (unidade_id = get_user_empresa_id(auth.uid()));

-- Allow filial users to read epis where empresa_id matches their unidade (filial)
-- This is needed so they can see EPIs available for delivery
CREATE POLICY "Tenant read epis by unidade"
  ON public.epis FOR SELECT
  TO authenticated
  USING (empresa_id IN (
    SELECT id FROM empresa_config WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
    UNION ALL
    SELECT get_user_empresa_id(auth.uid())
  ));