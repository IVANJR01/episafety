-- =====================================================================
-- RESOLVE O ERRO DO CADASTRO DE LOCAL — rode INTEIRO no SQL Editor
--
--   Erro: new row violates row-level security policy for table "obras"
--
-- O SQL Editor roda como dono do banco, então nada aqui é bloqueado.
-- Pode rodar mais de uma vez: nada duplica e nada é apagado.
--
-- Foram DOIS defeitos, os dois reproduzidos e corrigidos em Postgres 16:
--
--  1) Super Admin não era reconhecido. is_super_admin() confere só
--     user_roles.role='super_admin', mas o aplicativo também aceita papel
--     'admin' e is_principal em usuarios_liberados.
--
--  2) A regra de permissão lia a tabela `profiles` direto. Sem permissão
--     nessa tabela, a regra ERRA em vez de dar falso — e o erro derruba o
--     comando inteiro, antes mesmo de a regra de Super Admin poder valer.
--     Era isto que fazia o erro continuar depois da primeira correção.
--
-- Agora todo o predicado é função SECURITY DEFINER: nem falta de permissão
-- nem RLS de outra tabela conseguem derrubar a regra.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE 1 — Grava no banco os 15 locais que hoje só existem no código
-- ---------------------------------------------------------------------

WITH novos (empresa_id, nome, codigo, endereco, cidade, uf, status, observacoes) AS (
  VALUES
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'SE 69 KV BARROCAS', 'OBR-001', 'Subestação Barrocas', 'Barrocas', 'RN', 'ATIVA', 'Subestação 69 kV Barrocas — CG3 Engenharia'),
  ('814c58d9-17c9-4e18-8d19-9d0e07210834'::uuid, 'SE 69 KV ESTREITO', 'OBR-002', 'Subestação Estreito', 'Estreito', 'RN', 'ATIVA', 'Subestação 69 kV Estreito — CG3 Engenharia / RN'),
  ('814c58d9-17c9-4e18-8d19-9d0e07210834'::uuid, 'SE JARDIM DE PIRANHAS', 'OBR-003', 'Subestação Jardim de Piranhas', 'Jardim de Piranhas', 'RN', 'ATIVA', 'Subestação Jardim de Piranhas — CG3 Engenharia / RN'),
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'ALOJAMENTO - ALTO RODRIGUES', 'OBR-004', 'Alojamento Alto Rodrigues', 'Alto Rodrigues', 'RN', 'ATIVA', 'Alojamento Operacional Neoenergia'),
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'ALOJAMENTO - MOSSORO', 'OBR-005', 'Alojamento Mossoró', 'Mossoró', 'RN', 'ATIVA', 'Alojamento Operacional Mossoró'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'CASTANHÃO', 'OBR-G01', 'Unidade Castanhão', 'Iracema', 'CE', 'ATIVA', 'Unidade Operacional Castanhão'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'ALTO SANTO', 'OBR-G02', 'Unidade Alto Santo', 'Alto Santo', 'CE', 'ATIVA', 'Unidade Operacional Alto Santo'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'POTIRETAMA', 'OBR-G03', 'Unidade Potiretama', 'Potiretama', 'CE', 'ATIVA', 'Unidade Operacional Potiretama'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'BORDADO', 'OBR-G04', 'Setor de Bordado', 'Iracema', 'CE', 'ATIVA', 'Setor de Bordado G91'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'ESTAMPARIA', 'OBR-G05', 'Setor de Estamparia', 'Iracema', 'CE', 'ATIVA', 'Setor de Estamparia G91'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'COSTURA', 'OBR-L01', 'Setor de Costura', NULL, NULL, 'ATIVA', 'Setor de Costura'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'PASSADORIA', 'OBR-L02', 'Setor de Passadoria', NULL, NULL, 'ATIVA', 'Setor de Passadoria'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'MÁQ. TAQ / PASSADORIA', 'OBR-L03', 'Setor Máquinas Taquete / Passadoria', NULL, NULL, 'ATIVA', 'Setor de Máquinas Taquete'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'ESTAMPARIA', 'OBR-L04', 'Setor de Estamparia', NULL, NULL, 'ATIVA', 'Setor de Estamparia'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'TECELAGEM', 'OBR-L05', 'Setor de Tecelagem', NULL, NULL, 'ATIVA', 'Setor de Tecelagem')
)
INSERT INTO public.obras (empresa_id, nome, codigo, endereco, cidade, uf, status, observacoes)
SELECT n.empresa_id, n.nome, n.codigo, n.endereco, n.cidade, n.uf, n.status, n.observacoes
FROM novos n
WHERE NOT EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.empresa_id = n.empresa_id
    AND lower(trim(o.nome)) = lower(trim(n.nome))
);


-- ---------------------------------------------------------------------
-- PARTE 2 — Corrige a permissão (é o que faz o erro parar)
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- PARTE 3 — Confira o resultado
-- ---------------------------------------------------------------------

-- Os locais gravados:
SELECT o.codigo, o.nome, o.cidade, o.uf, o.status
FROM public.obras o ORDER BY o.codigo;

-- Inspeções que apontam para obra inexistente (0 = nada a fazer):
SELECT count(*) AS inspecoes_sem_obra_valida
FROM public.conformidades c
LEFT JOIN public.obras o ON o.id = c.obra_id
WHERE c.obra_id IS NOT NULL AND o.id IS NULL;
