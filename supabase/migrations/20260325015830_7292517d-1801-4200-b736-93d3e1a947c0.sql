DROP POLICY IF EXISTS "Contract user read contratos" ON public.contratos;

CREATE POLICY "Contract user read contratos"
ON public.contratos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios_liberados ul
    WHERE lower(ul.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND ul.contrato_id = contratos.id
      AND ul.ativo = true
  )
);