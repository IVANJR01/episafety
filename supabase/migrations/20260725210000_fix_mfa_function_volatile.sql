-- Corrige mfa_required_for_current_user(): estava STABLE mas faz INSERT em mfa_enforcement,
-- causando "ERROR: INSERT is not allowed in a non-volatile function" e retornando HTTP 400
-- para todos os usuarios logados. Precisa ser VOLATILE por causa do INSERT.

CREATE OR REPLACE FUNCTION public.mfa_required_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email   text := lower(COALESCE(auth.jwt() ->> 'email', ''));
  _is_super boolean;
  _is_principal boolean;
  _is_admin boolean;
  _required boolean;
  _rec public.mfa_enforcement%ROWTYPE;
  _grace_until timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('required', false);
  END IF;

  _is_super := public.is_super_admin(_user_id);
  _is_principal := public.is_principal(_user_id);
  _is_admin := public.has_role(_user_id, 'admin');
  _required := _is_super OR _is_principal OR _is_admin;

  IF NOT _required THEN
    RETURN jsonb_build_object('required', false);
  END IF;

  SELECT * INTO _rec FROM public.mfa_enforcement WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.mfa_enforcement (user_id, user_email)
    VALUES (_user_id, _email)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO _rec;
    IF _rec.user_id IS NULL THEN
      SELECT * INTO _rec FROM public.mfa_enforcement WHERE user_id = _user_id;
    END IF;
  END IF;

  _grace_until := _rec.grace_started_at + (_rec.grace_days || ' days')::interval;
  RETURN jsonb_build_object(
    'required', true,
    'grace_until', _grace_until,
    'enforced', now() >= _grace_until,
    'grace_days_remaining', GREATEST(0, EXTRACT(EPOCH FROM (_grace_until - now()))::int / 86400)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_required_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_required_for_current_user() TO authenticated;
