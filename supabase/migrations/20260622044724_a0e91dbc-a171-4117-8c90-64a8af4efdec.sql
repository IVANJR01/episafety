CREATE OR REPLACE FUNCTION public._derive_storage_from_sentinel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _ref text; _rest text; _slash int;
BEGIN
  -- Resolve a referência sem acessar colunas que não existam na tabela atual.
  IF TG_TABLE_NAME IN ('esocial_eventos_s2210','esocial_eventos_s2240') THEN
    IF to_jsonb(NEW) ? 'xml_drive_id' THEN
      _ref := (to_jsonb(NEW) ->> 'xml_drive_id');
    END IF;
  ELSE
    IF to_jsonb(NEW) ? 'drive_file_id' THEN
      _ref := (to_jsonb(NEW) ->> 'drive_file_id');
    END IF;
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