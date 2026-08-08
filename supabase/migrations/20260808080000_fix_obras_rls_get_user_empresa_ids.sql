-- =====================================================================
-- Corrige RLS de `obras` — "new row violates row-level security policy"
--
-- Reportado nesta sessão: criar obra direto do seletor em Inspeções
-- (ObraCombobox → criarObra em src/lib/obras.ts, que já grava
-- empresa_id certo no INSERT) falhava com violação de RLS, mesmo a
-- listagem de obras da mesma empresa funcionando normalmente.
--
-- Histórico encontrado nas migrations antigas (todas de 2026-07-04):
-- a primeira versão da policy (20260704153126) comparava
-- usuario_empresas direto com JOIN em auth.users, o que já tinha sido
-- corrigido duas vezes (20260704154529, 20260704160334) até chegar no
-- padrão que o resto do sistema usa: get_user_empresa_ids(email do
-- JWT), que cobre usuario_empresas E usuarios_liberados de uma vez.
--
-- A ÚLTIMA dessas correções (20260704160334) já está certa — mas as
-- migrations aplicadas no banco hoje começam em 20260719 (série
-- "restore_episafety_NNN", da reconstrução depois da suspensão da
-- Lovable Cloud documentada em docs/lovable-forensic/). Não dá para
-- confirmar sem acesso ao banco se aquela correção de 07-04 sobreviveu
-- à reconstrução ou se ficou de fora. Reaplicar aqui é seguro de
-- qualquer forma: DROP POLICY IF EXISTS + CREATE POLICY, idempotente,
-- mesmo se a versão certa já estiver valendo.
-- =====================================================================

DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

CREATE POLICY "Obras select por empresa" ON public.obras
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras insert por empresa" ON public.obras
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras update por empresa" ON public.obras
FOR UPDATE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras delete por empresa" ON public.obras
FOR DELETE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
