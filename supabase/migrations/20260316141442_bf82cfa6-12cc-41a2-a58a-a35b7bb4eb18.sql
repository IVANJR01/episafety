
-- Allow authenticated users to read their own row in usuarios_liberados by email
CREATE POLICY "Users can read own email in usuarios_liberados"
ON public.usuarios_liberados
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
