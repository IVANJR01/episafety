
-- ============================================================================
-- Supabase Storage privado para homologação: bucket sst-documentos
-- - Mantém Google Drive BYOK como opcional via empresa_config.storage_provider
-- - Coexistência: novos PDFs/XMLs vão para Supabase; antigos seguem no Drive
-- - Sentinel "sb://<bucket>/<path>" no campo *drive*_id preenche storage_*
-- ============================================================================

-- 1) Provider escolhido por empresa (default: supabase_storage)
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase_storage';

-- 2) Colunas storage_* nas 6 tabelas de PDFs/XMLs (aditivas, nullable)
ALTER TABLE public.pgr_pdf_versoes
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'google_drive_byok',
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.ltcat_pdf_versoes
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'google_drive_byok',
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.ppp_pdf_versoes
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'google_drive_byok',
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.cat_anexos
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'google_drive_byok',
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.esocial_eventos_s2210
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.esocial_eventos_s2240
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 3) Função de derivação a partir do sentinel "sb://<bucket>/<path>"
CREATE OR REPLACE FUNCTION public._derive_storage_from_sentinel()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _ref text;
  _rest text;
  _slash int;
BEGIN
  -- Campo de referência muda por tabela: *_drive_id ou drive_file_id ou xml_drive_id
  _ref := COALESCE(
    CASE WHEN TG_TABLE_NAME IN ('esocial_eventos_s2210','esocial_eventos_s2240')
         THEN NEW.xml_drive_id ELSE NULL END,
    CASE WHEN TG_TABLE_NAME NOT IN ('esocial_eventos_s2210','esocial_eventos_s2240')
         THEN NEW.drive_file_id ELSE NULL END
  );

  IF _ref IS NOT NULL AND position('sb://' in _ref) = 1 THEN
    _rest := substr(_ref, 6); -- bucket/...
    _slash := position('/' in _rest);
    IF _slash > 1 THEN
      NEW.storage_provider := 'supabase_storage';
      NEW.storage_bucket   := substr(_rest, 1, _slash - 1);
      NEW.storage_path     := substr(_rest, _slash + 1);
    END IF;
  ELSIF _ref IS NOT NULL THEN
    -- Drive ID puro
    IF NEW.storage_provider IS NULL THEN
      NEW.storage_provider := 'google_drive_byok';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.pgr_pdf_versoes;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.pgr_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.ltcat_pdf_versoes;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.ltcat_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.ppp_pdf_versoes;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.ppp_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.cat_anexos;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.cat_anexos
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.esocial_eventos_s2210;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.esocial_eventos_s2210
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

DROP TRIGGER IF EXISTS trg_storage_sentinel ON public.esocial_eventos_s2240;
CREATE TRIGGER trg_storage_sentinel BEFORE INSERT OR UPDATE ON public.esocial_eventos_s2240
  FOR EACH ROW EXECUTE FUNCTION public._derive_storage_from_sentinel();

-- 4) RLS no bucket privado sst-documentos
-- Path obrigatório: <empresa_id>/...  → autorizado se empresa está na árvore do usuário
DROP POLICY IF EXISTS "sst_doc_select_tenant" ON storage.objects;
CREATE POLICY "sst_doc_select_tenant"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sst-documentos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "sst_doc_insert_tenant" ON storage.objects;
CREATE POLICY "sst_doc_insert_tenant"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sst-documentos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "sst_doc_update_tenant" ON storage.objects;
CREATE POLICY "sst_doc_update_tenant"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sst-documentos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "sst_doc_delete_tenant" ON storage.objects;
CREATE POLICY "sst_doc_delete_tenant"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sst-documentos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );

-- anon: sem nenhuma policy → sem acesso
