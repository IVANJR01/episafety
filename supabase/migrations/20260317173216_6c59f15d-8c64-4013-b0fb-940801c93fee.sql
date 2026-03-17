-- Remove the dangerous anon policy that exposes all user emails, names, and permissions
DROP POLICY IF EXISTS "Anon can check email" ON public.usuarios_liberados;
