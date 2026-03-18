-- Allow users from parent company to read solicitacoes from filiais
CREATE POLICY "Tenant read solicitacoes_epi from filiais"
ON public.solicitacoes_epi FOR SELECT TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
));

-- Allow users from parent company to update solicitacoes from filiais (approve/reject)
CREATE POLICY "Tenant update solicitacoes_epi from filiais"
ON public.solicitacoes_epi FOR UPDATE TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE empresa_pai_id = get_user_empresa_id(auth.uid())
));