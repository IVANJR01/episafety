-- Corrige a policy de leitura do próprio registro em usuarios_liberados.
-- A policy anterior consultava auth.users diretamente, o que causa erro de permissão.

DROP POLICY IF EXISTS "Users can read own email in usuarios_liberados" ON public.usuarios_liberados;

CREATE POLICY "Users can read own email in usuarios_liberados"
ON public.usuarios_liberados
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);