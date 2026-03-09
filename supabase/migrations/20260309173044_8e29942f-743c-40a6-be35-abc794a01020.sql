
-- Allow super_admin to manage all profiles (update empresa_id)
CREATE POLICY "Super admin full access profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
