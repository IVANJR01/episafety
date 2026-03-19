
-- Update the Tenant read policy to include company tree for users who have cadastro_empresas or cadastro_usuarios permissions
DROP POLICY IF EXISTS "Tenant read usuarios_liberados" ON public.usuarios_liberados;

CREATE POLICY "Tenant read usuarios_liberados"
ON public.usuarios_liberados
FOR SELECT
USING (
  is_in_user_company_tree(auth.uid(), empresa_id)
);
