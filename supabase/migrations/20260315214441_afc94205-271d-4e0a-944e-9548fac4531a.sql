-- Allow authenticated users to INSERT filiais/obras/setores linked to their own empresa
CREATE POLICY "Tenant insert filiais"
ON public.empresa_config
FOR INSERT
TO authenticated
WITH CHECK (empresa_pai_id = get_user_empresa_id(auth.uid()));

-- Allow users to READ filiais of their own empresa
CREATE POLICY "Tenant read filiais"
ON public.empresa_config
FOR SELECT
TO authenticated
USING (empresa_pai_id = get_user_empresa_id(auth.uid()));

-- Allow users to UPDATE filiais of their own empresa
CREATE POLICY "Tenant update filiais"
ON public.empresa_config
FOR UPDATE
TO authenticated
USING (empresa_pai_id = get_user_empresa_id(auth.uid()));

-- Allow users to DELETE filiais of their own empresa
CREATE POLICY "Tenant delete filiais"
ON public.empresa_config
FOR DELETE
TO authenticated
USING (empresa_pai_id = get_user_empresa_id(auth.uid()));