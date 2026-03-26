-- Allow filial users to read their parent empresa (matriz)
CREATE POLICY "User read parent empresa"
ON public.empresa_config
FOR SELECT
USING (
  id IN (
    SELECT ec.empresa_pai_id
    FROM empresa_config ec
    WHERE ec.id = get_user_empresa_id(auth.uid())
    AND ec.empresa_pai_id IS NOT NULL
  )
);