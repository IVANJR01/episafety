-- Drop existing policies
DROP POLICY IF EXISTS "Users can view conferences in their company tree" ON public.conferencias_estoque;
DROP POLICY IF EXISTS "Users can insert conferences" ON public.conferencias_estoque;
DROP POLICY IF EXISTS "Users can update conferences" ON public.conferencias_estoque;
DROP POLICY IF EXISTS "Users can view conference items" ON public.conferencia_itens;
DROP POLICY IF EXISTS "Users can insert conference items" ON public.conferencia_itens;
DROP POLICY IF EXISTS "Users can update conference items" ON public.conferencia_itens;

-- Recreate with contract-bound user support
CREATE POLICY "Users can view conferences in their company tree"
ON public.conferencias_estoque FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR is_principal(auth.uid())
  OR is_in_user_company_tree(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1 FROM usuarios_liberados ul
    WHERE ul.email = (auth.jwt() ->> 'email')
    AND ul.contrato_id = conferencias_estoque.contrato_id
    AND ul.ativo = true
  )
);

CREATE POLICY "Users can insert conferences"
ON public.conferencias_estoque FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_principal(auth.uid())
  OR is_in_user_company_tree(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1 FROM usuarios_liberados ul
    WHERE ul.email = (auth.jwt() ->> 'email')
    AND ul.contrato_id = conferencias_estoque.contrato_id
    AND ul.ativo = true
  )
);

CREATE POLICY "Users can update conferences"
ON public.conferencias_estoque FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR is_principal(auth.uid())
  OR is_in_user_company_tree(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1 FROM usuarios_liberados ul
    WHERE ul.email = (auth.jwt() ->> 'email')
    AND ul.contrato_id = conferencias_estoque.contrato_id
    AND ul.ativo = true
  )
);

-- Conference items: allow access if user can access the parent conference
CREATE POLICY "Users can view conference items"
ON public.conferencia_itens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conferencias_estoque c
    WHERE c.id = conferencia_itens.conferencia_id
    AND (
      is_super_admin(auth.uid())
      OR is_principal(auth.uid())
      OR is_in_user_company_tree(auth.uid(), c.empresa_id)
      OR EXISTS (
        SELECT 1 FROM usuarios_liberados ul
        WHERE ul.email = (auth.jwt() ->> 'email')
        AND ul.contrato_id = c.contrato_id
        AND ul.ativo = true
      )
    )
  )
);

CREATE POLICY "Users can insert conference items"
ON public.conferencia_itens FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conferencias_estoque c
    WHERE c.id = conferencia_itens.conferencia_id
    AND (
      is_super_admin(auth.uid())
      OR is_principal(auth.uid())
      OR is_in_user_company_tree(auth.uid(), c.empresa_id)
      OR EXISTS (
        SELECT 1 FROM usuarios_liberados ul
        WHERE ul.email = (auth.jwt() ->> 'email')
        AND ul.contrato_id = c.contrato_id
        AND ul.ativo = true
      )
    )
  )
);

CREATE POLICY "Users can update conference items"
ON public.conferencia_itens FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conferencias_estoque c
    WHERE c.id = conferencia_itens.conferencia_id
    AND (
      is_super_admin(auth.uid())
      OR is_principal(auth.uid())
      OR is_in_user_company_tree(auth.uid(), c.empresa_id)
      OR EXISTS (
        SELECT 1 FROM usuarios_liberados ul
        WHERE ul.email = (auth.jwt() ->> 'email')
        AND ul.contrato_id = c.contrato_id
        AND ul.ativo = true
      )
    )
  )
);