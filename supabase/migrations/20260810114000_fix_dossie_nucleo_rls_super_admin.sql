-- Corrige as policies do núcleo do Dossiê Digital (migration 20260808000000)
-- A checagem de admin estava usando `public.has_role(..., 'admin')` o que falhava
-- para Super Admins (is_super_admin) que não tinham vínculo explícito na `usuario_empresas`.
-- O correto é usar `public.is_super_admin(auth.uid())`, conforme já corrigido
-- para as outras tabelas na migration 20260809110000.

DO $$
DECLARE
  t TEXT;
  escopo TEXT := '(empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> ''email'')) OR public.is_super_admin(auth.uid()))';
BEGIN
  -- 1. internal_document_types
  t := 'internal_document_types';
  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING %s', t, t, escopo);

  -- 2. internal_documents
  t := 'internal_documents';
  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING %s', t, t, escopo);
  -- (sem delete)

  -- 3. internal_document_versions
  t := 'internal_document_versions';
  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING %s', t, t, escopo);
  EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
  EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t, t, escopo);
  -- (sem update, sem delete)

END $$;
