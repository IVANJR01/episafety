
-- Fix: automatically sync empresa_id from usuarios_liberados to profiles on login
-- This trigger fires when a profile is created (on signup) and sets empresa_id
CREATE OR REPLACE FUNCTION public.sync_profile_empresa_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT ul.empresa_id INTO NEW.empresa_id
    FROM usuarios_liberados ul
    WHERE lower(ul.email) = lower(NEW.email)
    AND ul.empresa_id IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply on INSERT (new user signup)
CREATE TRIGGER trg_sync_profile_empresa_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_empresa_id();

-- Also apply on UPDATE when empresa_id is being set to null or stays null
CREATE TRIGGER trg_sync_profile_empresa_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (NEW.empresa_id IS NULL)
EXECUTE FUNCTION public.sync_profile_empresa_id();
