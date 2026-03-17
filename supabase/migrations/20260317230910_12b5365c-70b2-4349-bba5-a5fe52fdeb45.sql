
-- Allow filial users to READ contratos where unidade_id = their empresa
CREATE POLICY "Tenant read contratos by unidade"
ON public.contratos FOR SELECT
TO authenticated
USING (unidade_id = get_user_empresa_id(auth.uid()));

-- Allow filial users to UPDATE contratos where unidade_id = their empresa
CREATE POLICY "Tenant update contratos by unidade"
ON public.contratos FOR UPDATE
TO authenticated
USING (unidade_id = get_user_empresa_id(auth.uid()));

-- Allow filial users to INSERT contratos where unidade_id = their empresa
CREATE POLICY "Tenant insert contratos by unidade"
ON public.contratos FOR INSERT
TO authenticated
WITH CHECK (unidade_id = get_user_empresa_id(auth.uid()));

-- contrato_epis: allow access when the contrato's unidade matches user empresa
CREATE POLICY "Tenant read contrato_epis by unidade"
ON public.contrato_epis FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant insert contrato_epis by unidade"
ON public.contrato_epis FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant update contrato_epis by unidade"
ON public.contrato_epis FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant delete contrato_epis by unidade"
ON public.contrato_epis FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

-- contrato_epis_movimentacoes: allow access when the contrato's unidade matches user empresa
CREATE POLICY "Tenant read contrato_epis_mov by unidade"
ON public.contrato_epis_movimentacoes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis_movimentacoes.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant insert contrato_epis_mov by unidade"
ON public.contrato_epis_movimentacoes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis_movimentacoes.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant update contrato_epis_mov by unidade"
ON public.contrato_epis_movimentacoes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis_movimentacoes.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "Tenant delete contrato_epis_mov by unidade"
ON public.contrato_epis_movimentacoes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_epis_movimentacoes.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);

-- contrato_responsaveis: allow access when the contrato's unidade matches user empresa
CREATE POLICY "Tenant read contrato_resp by unidade"
ON public.contrato_responsaveis FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = contrato_responsaveis.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  )
);
