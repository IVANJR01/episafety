
CREATE POLICY "company_logos_select_own_empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "company_logos_insert_own_empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "company_logos_update_own_empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

CREATE POLICY "company_logos_delete_own_empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);
