
-- Allow users linked to a contract (via usuarios_liberados) to read contrato_epis for their contract
CREATE POLICY "Contract user read contrato_epis"
ON public.contrato_epis
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_liberados ul
    WHERE ul.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND ul.contrato_id = contrato_epis.contrato_id
    AND ul.ativo = true
  )
);

-- Allow users linked to a contract to read contrato_epis_movimentacoes for their contract
CREATE POLICY "Contract user read contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_liberados ul
    WHERE ul.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND ul.contrato_id = contrato_epis_movimentacoes.contrato_id
    AND ul.ativo = true
  )
);

-- Allow users linked to a contract to read that contract
CREATE POLICY "Contract user read contratos"
ON public.contratos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_liberados ul
    WHERE ul.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND ul.contrato_id = contratos.id
    AND ul.ativo = true
  )
);
