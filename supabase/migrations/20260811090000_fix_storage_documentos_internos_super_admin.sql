-- =====================================================================
-- Bucket `documentos-internos`: Super Admin não passava pela RLS
--
-- Sintoma: anexar documento no Dossiê devolvia
--   new row violates row-level security policy
--
-- O erro NÃO vinha de internal_documents nem de internal_document_versions
-- — essas já reconhecem is_super_admin. Vinha do upload do arquivo, em
-- storage.objects. Confirmado consultando o banco: as duas policies do
-- bucket aceitavam apenas (a) a pasta do arquivo estar em
-- get_user_empresa_ids(email), ou (b) has_role(auth.uid(),'admin').
--
-- O dono da conta tem papel 'super_admin' (não 'admin') e nenhum vínculo em
-- usuario_empresas — get_user_empresa_ids devolve vazio para ele. Nenhum dos
-- dois ramos passava, e o arquivo era recusado.
--
-- Mesmo defeito já corrigido em obras (20260809140000) e nas tabelas do
-- Dossiê (20260809110000): o certo é public.is_super_admin().
--
-- Continua sem policy de UPDATE e de DELETE, de propósito: é a garantia
-- estrutural de que renovar documento nunca sobrescreve o arquivo antigo.
--
-- Já aplicada no banco de produção nesta sessão; fica aqui para o histórico
-- e para qualquer ambiente novo.
-- =====================================================================

DROP POLICY IF EXISTS "docint_read" ON storage.objects;
CREATE POLICY "docint_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-internos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT x::text FROM unnest(public.get_user_empresa_ids(auth.jwt() ->> 'email')) x
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "docint_write" ON storage.objects;
CREATE POLICY "docint_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-internos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT x::text FROM unnest(public.get_user_empresa_ids(auth.jwt() ->> 'email')) x
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
  )
);
