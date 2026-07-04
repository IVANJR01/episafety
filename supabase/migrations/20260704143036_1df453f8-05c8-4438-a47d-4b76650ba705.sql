
ALTER TABLE public.conformidades
  ADD COLUMN IF NOT EXISTS foto_antes_path text,
  ADD COLUMN IF NOT EXISTS foto_depois_path text;

DROP POLICY IF EXISTS "Inspecoes fotos: select tenant" ON storage.objects;
DROP POLICY IF EXISTS "Inspecoes fotos: insert tenant" ON storage.objects;
DROP POLICY IF EXISTS "Inspecoes fotos: update tenant" ON storage.objects;
DROP POLICY IF EXISTS "Inspecoes fotos: delete tenant" ON storage.objects;

CREATE POLICY "Inspecoes fotos: select tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
      OR (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), (storage.foldername(name))[1]::uuid))
    )
  );

CREATE POLICY "Inspecoes fotos: insert tenant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspecoes-fotos'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
      OR (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), (storage.foldername(name))[1]::uuid))
    )
  );

CREATE POLICY "Inspecoes fotos: update tenant"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
      OR (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), (storage.foldername(name))[1]::uuid))
    )
  );

CREATE POLICY "Inspecoes fotos: delete tenant"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspecoes-fotos'
    AND (
      is_super_admin(auth.uid())
      OR (storage.foldername(name))[1]::uuid = get_user_empresa_id(auth.uid())
      OR (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), (storage.foldername(name))[1]::uuid))
    )
  );
