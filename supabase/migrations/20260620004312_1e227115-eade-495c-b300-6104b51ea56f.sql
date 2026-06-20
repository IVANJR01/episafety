
-- =========================================================
-- STORAGE HARDENING — PHASE A
-- Sensitive buckets: inspecoes, conformidades, videos-treinamento, fotos-reconhecimento
-- Path convention enforced: '<empresa_id_uuid>/...'
-- =========================================================

-- Drop any prior permissive policies we may have created for these buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'sensitive_buckets_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;

-- Helper: extract first path segment as uuid (returns NULL when invalid)
CREATE OR REPLACE FUNCTION public.storage_path_empresa_id(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _seg text;
  _id uuid;
BEGIN
  IF _name IS NULL THEN RETURN NULL; END IF;
  _seg := split_part(_name, '/', 1);
  IF _seg IS NULL OR _seg = '' THEN RETURN NULL; END IF;
  BEGIN
    _id := _seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.storage_path_empresa_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_path_empresa_id(text) TO authenticated, service_role;

-- SELECT: only authenticated users from the same company tree (or super_admin / principal)
CREATE POLICY "sensitive_buckets_select_tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('inspecoes','conformidades','videos-treinamento','fotos-reconhecimento')
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR (
      public.storage_path_empresa_id(name) IS NOT NULL
      AND public.is_in_user_company_tree(auth.uid(), public.storage_path_empresa_id(name))
    )
  )
);

-- INSERT: same rule + path MUST start with a valid tenant uuid
CREATE POLICY "sensitive_buckets_insert_tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('inspecoes','conformidades','videos-treinamento','fotos-reconhecimento')
  AND public.storage_path_empresa_id(name) IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), public.storage_path_empresa_id(name))
  )
);

-- UPDATE
CREATE POLICY "sensitive_buckets_update_tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('inspecoes','conformidades','videos-treinamento','fotos-reconhecimento')
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR (
      public.storage_path_empresa_id(name) IS NOT NULL
      AND public.is_in_user_company_tree(auth.uid(), public.storage_path_empresa_id(name))
    )
  )
)
WITH CHECK (
  bucket_id IN ('inspecoes','conformidades','videos-treinamento','fotos-reconhecimento')
  AND public.storage_path_empresa_id(name) IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), public.storage_path_empresa_id(name))
  )
);

-- DELETE
CREATE POLICY "sensitive_buckets_delete_tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('inspecoes','conformidades','videos-treinamento','fotos-reconhecimento')
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR (
      public.storage_path_empresa_id(name) IS NOT NULL
      AND public.is_in_user_company_tree(auth.uid(), public.storage_path_empresa_id(name))
    )
  )
);

-- Explicitly: NO policy is created for role `anon` on these buckets,
-- so anonymous SELECT / LIST / INSERT is denied by default once the bucket is private.
