-- =====================================================================
-- `obras`: RLS que reconhece Super Admin e não estoura no meio
--
-- Sintoma: com o usuário logado como Super Admin, salvar em Cadastro de
-- Local devolvia
--   new row violates row-level security policy for table "obras"
--
-- Foram encontrados DOIS defeitos, os dois reproduzidos em Postgres 16:
--
-- (1) Super Admin não era reconhecido.
--     `public.is_super_admin()` confere UMA via — user_roles.role =
--     'super_admin'. Já `checkSuperAdmin`, em AuthContext.tsx, aceita três:
--       a) a RPC is_super_admin;
--       b) user_roles.role em ('super_admin','superadmin','admin');
--       c) usuarios_liberados.is_principal = true para o e-mail.
--     Quem é Super Admin por (b) ou (c) aparece como SUPER na tela e mesmo
--     assim era recusado pela RLS.
--     Obs.: o enum app_role tem 'admin','tecnico','usuario','super_admin' —
--     'superadmin' não existe como rótulo, então a comparação é em texto
--     (role::text), que não estoura com rótulo inexistente.
--
-- (2) A policy consultava `public.profiles` direto.
--     Quando o usuário não tem permissão de leitura em `profiles`, a
--     avaliação da policy ERRA em vez de dar falso — e um erro derruba o
--     comando inteiro, antes que a policy permissiva de Super Admin pudesse
--     valer. Reproduzido: "permission denied for table profiles" no meio do
--     INSERT, mesmo com a policy de Super Admin já instalada e valendo.
--
--     É por isso que o resto do banco resolve escopo por função
--     SECURITY DEFINER (get_user_empresa_ids, is_super_admin): a função lê
--     as tabelas de apoio com os privilégios de quem a define, então nem
--     falta de GRANT nem RLS de terceira tabela conseguem derrubar a policy.
--     Aqui todo o predicado passa a ser função; nenhuma tabela é lida direto.
--
-- Substitui as policies criadas em 20260808080000 e 20260809130000.
-- Idempotente.
-- =====================================================================


-- --------------------------------------------------------------------
-- Super Admin pelas mesmas três vias que o aplicativo usa
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin_ext(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text IN ('super_admin', 'superadmin', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email) = lower(coalesce(_email, ''))
        AND is_principal = true
    );
$$;


-- --------------------------------------------------------------------
-- Empresas que o perfil aponta — o que a policy antiga lia direto de
-- `profiles`, agora atrás de SECURITY DEFINER para não poder estourar.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.empresas_do_perfil(_user_id uuid, _email text)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT p.empresa_id), ARRAY[]::uuid[])
  FROM public.profiles p
  WHERE p.empresa_id IS NOT NULL
    AND (p.id = _user_id OR lower(p.email) = lower(coalesce(_email, '')));
$$;


-- REVOKE/GRANT por papel que pode não existir (banco restaurado, ambiente
-- local sem os papéis do Supabase) derrubaria a migration no meio. Cada um
-- só é aplicado se o papel estiver lá.
REVOKE EXECUTE ON FUNCTION public.is_super_admin_ext(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.empresas_do_perfil(uuid, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_super_admin_ext(uuid, text) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.empresas_do_perfil(uuid, text) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_super_admin_ext(uuid, text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.empresas_do_perfil(uuid, text) TO authenticated';
  END IF;
END $$;


-- --------------------------------------------------------------------
-- Policies: só funções, nenhuma tabela lida direto
-- --------------------------------------------------------------------
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  escopo TEXT := '('
    || 'empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> ''email''))'
    || ' OR empresa_id = ANY (public.empresas_do_perfil(auth.uid(), auth.jwt() ->> ''email''))'
    || ' OR public.is_super_admin(auth.uid())'
    || ' OR public.is_super_admin_ext(auth.uid(), auth.jwt() ->> ''email'')'
    || ')';
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras';
  EXECUTE format('CREATE POLICY "Obras select por empresa" ON public.obras FOR SELECT TO authenticated USING %s', escopo);

  EXECUTE 'DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras';
  EXECUTE format('CREATE POLICY "Obras insert por empresa" ON public.obras FOR INSERT TO authenticated WITH CHECK %s', escopo);

  EXECUTE 'DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras';
  EXECUTE format('CREATE POLICY "Obras update por empresa" ON public.obras FOR UPDATE TO authenticated USING %s WITH CHECK %s', escopo, escopo);

  EXECUTE 'DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras';
  EXECUTE format('CREATE POLICY "Obras delete por empresa" ON public.obras FOR DELETE TO authenticated USING %s', escopo);
END $$;

-- A policy separada de Super Admin de 20260809130000 fica redundante: o
-- escopo acima já a contém. Sai para não haver duas regras dizendo o mesmo.
DROP POLICY IF EXISTS "Super admin full access obras" ON public.obras;
