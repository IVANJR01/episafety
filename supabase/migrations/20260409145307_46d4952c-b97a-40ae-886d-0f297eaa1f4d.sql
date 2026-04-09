CREATE POLICY "Users read own funcionario"
ON public.funcionarios FOR SELECT
TO authenticated
USING (user_id = auth.uid());