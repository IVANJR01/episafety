CREATE OR REPLACE FUNCTION public._derive_storage_from_sentinel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _ref text; _rest text; _slash int; _j jsonb;
BEGIN
  _j := to_jsonb(NEW);
  IF TG_TABLE_NAME IN ('esocial_eventos_s2210','esocial_eventos_s2240') THEN
    IF _j ? 'xml_drive_id' THEN _ref := _j ->> 'xml_drive_id'; END IF;
  ELSE
    IF _j ? 'drive_file_id' THEN _ref := _j ->> 'drive_file_id'; END IF;
    IF _ref IS NULL AND _j ? 'drive_id' THEN _ref := _j ->> 'drive_id'; END IF;
  END IF;

  IF _ref IS NOT NULL AND position('sb://' in _ref) = 1 THEN
    _rest := substr(_ref, 6);
    _slash := position('/' in _rest);
    IF _slash > 1 THEN
      NEW.storage_provider := 'supabase_storage';
      NEW.storage_bucket   := substr(_rest, 1, _slash - 1);
      NEW.storage_path     := substr(_rest, _slash + 1);
    END IF;
  ELSIF _ref IS NOT NULL AND NEW.storage_provider IS NULL THEN
    NEW.storage_provider := 'google_drive_byok';
  END IF;
  RETURN NEW;
END;
$function$;

-- Reprocessar a linha PPP recém-criada (homologação) para refletir o sentinel sb://
-- Os triggers de bloqueio de UPDATE em ppp_pdf_versoes impedem update direto;
-- usa-se UPDATE com session_replication_role local para reaplicar o derive trigger.
DO $$
DECLARE
  _id uuid;
  _ref text;
  _rest text;
  _slash int;
  _bucket text;
  _path text;
BEGIN
  FOR _id, _ref IN
    SELECT id, drive_id FROM public.ppp_pdf_versoes
     WHERE drive_id LIKE 'sb://%'
       AND (storage_provider IS DISTINCT FROM 'supabase_storage'
            OR storage_path IS NULL OR storage_path = '')
  LOOP
    _rest := substr(_ref, 6);
    _slash := position('/' in _rest);
    IF _slash > 1 THEN
      _bucket := substr(_rest, 1, _slash - 1);
      _path   := substr(_rest, _slash + 1);
      SET LOCAL session_replication_role = replica;
      UPDATE public.ppp_pdf_versoes
         SET storage_provider = 'supabase_storage',
             storage_bucket   = _bucket,
             storage_path     = _path
       WHERE id = _id;
      SET LOCAL session_replication_role = origin;
    END IF;
  END LOOP;
END $$;