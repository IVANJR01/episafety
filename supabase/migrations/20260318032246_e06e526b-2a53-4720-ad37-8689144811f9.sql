
-- Allow parent company users to see entregas from their filiais
CREATE POLICY "Tenant read entregas from filiais"
ON public.entregas
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM empresa_config
    WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
  )
);

-- Allow parent company users to see contrato_epis_movimentacoes from their filiais
CREATE POLICY "Tenant read contrato_mov from filiais"
ON public.contrato_epis_movimentacoes
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM empresa_config
    WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
  )
);

-- Allow parent company users to see contrato_epis from their filiais
CREATE POLICY "Tenant read contrato_epis from filiais"
ON public.contrato_epis
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT id FROM empresa_config
    WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
  )
);
