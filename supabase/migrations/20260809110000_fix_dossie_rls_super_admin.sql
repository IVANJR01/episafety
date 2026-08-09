-- Corrige as policies do Dossiê Digital (migration 20260808090000)
-- A checagem de admin estava usando `public.has_role(..., 'admin')` o que falhava
-- para Super Admins (is_super_admin) que não tinham vínculo explícito na `usuario_empresas`.
-- O correto é usar `public.is_super_admin(auth.uid())`.

DO $$
DECLARE
  t TEXT;
  escopo TEXT := '(empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> ''email'')) OR public.is_super_admin(auth.uid()))';
BEGIN
  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles','document_alerts','document_audit_events']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING %s', t, t, escopo);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t, t, escopo);
  END LOOP;

  -- UPDATE
  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles','document_alerts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING %s', t, t, escopo);
  END LOOP;

  -- DELETE
  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING %s', t, t, escopo);
  END LOOP;
END $$;
