CREATE POLICY "Auth update usuarios_liberados"
ON public.usuarios_liberados
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);