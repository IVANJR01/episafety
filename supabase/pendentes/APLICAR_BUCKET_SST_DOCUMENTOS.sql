-- ============================================================================
-- Cria o bucket 'sst-documentos' para armazenamento seguro de PDFs/XMLs de SST
-- ============================================================================
-- PROBLEMA
--
-- Ao clicar em "Gerar PDF Oficial" no PGR (ou gerar LTCAT, PPP, eventos eSocial),
-- o sistema devolvia:
--
--   Falha no upload Supabase Storage: Bucket not found
--
-- A migration 20260622041627 criou as políticas de storage.objects para o
-- bucket 'sst-documentos', mas nunca criou o bucket na tabela storage.buckets.
-- É o mesmo caso que ocorreu anteriormente com 'company-logos' e
-- 'solicitacoes-materiais-imagens'.
--
-- SOLUÇÃO
--
-- 1. Criar o bucket 'sst-documentos' em storage.buckets (privado, limite 50 MB).
-- 2. Alinhar as policies aos padrões de acesso por empresa ativa (is_super_admin,
--    is_principal, is_in_user_company_tree, has_role admin e get_user_empresa_id).
--
-- Seguro rodar mais de uma vez (idempotente): ON CONFLICT DO UPDATE e
-- DROP POLICY IF EXISTS.
-- ============================================================================

BEGIN;

-- 1) Criação / atualização do bucket sst-documentos
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

-- 2) Habilitar RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3) Políticas de acesso (SELECT, INSERT, UPDATE, DELETE)
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
