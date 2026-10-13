-- Criação oficial do bucket sst-documentos em storage.buckets
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sst-documentos',
  'sst-documentos',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf', 'application/xml', 'text/xml', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/xml', 'text/xml', 'application/octet-stream'];

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sst_doc_select_tenant" ON storage.objects;
CREATE POLICY "sst_doc_select_tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      AND (
        public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
        OR (split_part(name, '/', 1))::uuid = public.get_user_empresa_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "sst_doc_insert_tenant" ON storage.objects;
CREATE POLICY "sst_doc_insert_tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sst-documentos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      AND (
        public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
        OR (split_part(name, '/', 1))::uuid = public.get_user_empresa_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "sst_doc_update_tenant" ON storage.objects;
CREATE POLICY "sst_doc_update_tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      AND (
        public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
        OR (split_part(name, '/', 1))::uuid = public.get_user_empresa_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "sst_doc_delete_tenant" ON storage.objects;
CREATE POLICY "sst_doc_delete_tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      (split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      AND (
        public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
        OR (split_part(name, '/', 1))::uuid = public.get_user_empresa_id(auth.uid())
      )
    )
  )
);

COMMIT;
