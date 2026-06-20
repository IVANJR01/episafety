
-- ============================================================
-- FASE 5 — Audit log imutável
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  action text NOT NULL,              -- 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | custom
  entity_type text NOT NULL,
  entity_id text,
  empresa_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx     ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx      ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_empresa_idx     ON public.audit_log (empresa_id);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin lê. Mesma empresa lê só o que é da própria empresa.
CREATE POLICY audit_log_super_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY audit_log_company_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND public.is_in_user_company_tree(auth.uid(), empresa_id)
    AND (public.is_principal(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );

-- INSERT permitido só para registros do próprio usuário (eventos manuais de login/logout).
-- Triggers usam SECURITY DEFINER e bypass.
CREATE POLICY audit_log_self_insert ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE bloqueado (append-only) — sem CREATE POLICY = nega tudo,
-- mas explicito por segurança:
CREATE POLICY audit_log_no_update ON public.audit_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY audit_log_no_delete ON public.audit_log
  FOR DELETE TO authenticated USING (false);

-- Trigger genérico para registrar mudanças
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _empresa_id uuid;
  _entity_id text;
  _user_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  -- Tentar extrair empresa_id e id do row
  IF TG_OP = 'DELETE' THEN
    BEGIN _empresa_id := (to_jsonb(OLD) ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (to_jsonb(OLD) ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, old_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN _empresa_id := (to_jsonb(NEW) ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, old_data, new_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE -- INSERT
    BEGIN _empresa_id := (to_jsonb(NEW) ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (to_jsonb(NEW) ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, new_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

-- Aplicar trigger às tabelas críticas
DO $$
DECLARE t text;
DECLARE crit_tables text[] := ARRAY[
  'profiles','usuarios_liberados','user_roles','usuario_empresas',
  'funcionarios','entregas','epis','contratos','contrato_epis',
  'empresa_config','faturas'
];
BEGIN
  FOREACH t IN ARRAY crit_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- FASE 8 — Rate limiting
-- ============================================================

CREATE TABLE IF NOT EXISTS public.edge_rate_limit (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS edge_rate_limit_window_idx ON public.edge_rate_limit (window_start);

GRANT SELECT, INSERT, UPDATE ON public.edge_rate_limit TO service_role;
ALTER TABLE public.edge_rate_limit ENABLE ROW LEVEL SECURITY;
-- Sem policy = nenhum acesso para anon/authenticated (apenas service_role bypassa).

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _current_count integer;
BEGIN
  _window_start := date_trunc('second', now()) - (extract(epoch from now())::bigint % _window_seconds) * interval '1 second';

  INSERT INTO public.edge_rate_limit (key, window_start, count)
  VALUES (_key, _window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = public.edge_rate_limit.count + 1
  RETURNING count INTO _current_count;

  -- Cleanup janelas antigas (>1h) — operação barata oportunista
  DELETE FROM public.edge_rate_limit WHERE window_start < now() - interval '1 hour';

  RETURN _current_count <= _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- ============================================================
-- FASE 4 — Tabela de enforcement de MFA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mfa_enforcement (
  user_id uuid PRIMARY KEY,
  user_email text,
  grace_started_at timestamptz NOT NULL DEFAULT now(),
  grace_days integer NOT NULL DEFAULT 7,
  enforced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mfa_enforcement TO authenticated;
GRANT ALL ON public.mfa_enforcement TO service_role;
ALTER TABLE public.mfa_enforcement ENABLE ROW LEVEL SECURITY;

CREATE POLICY mfa_self_read ON public.mfa_enforcement
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY mfa_self_upsert ON public.mfa_enforcement
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY mfa_self_update ON public.mfa_enforcement
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER mfa_enforcement_updated_at
  BEFORE UPDATE ON public.mfa_enforcement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper que diz se o usuário atual precisa de MFA e se ainda está em grace
CREATE OR REPLACE FUNCTION public.mfa_required_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    -- Inicia grace agora
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
