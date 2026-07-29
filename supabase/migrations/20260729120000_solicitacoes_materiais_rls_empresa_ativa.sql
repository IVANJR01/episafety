-- ============================================================================
-- Solicitação de Materiais — RLS alinhada ao padrão de empresa ativa
-- ============================================================================
-- PROBLEMA
--
-- Ao trocar a empresa ativa para uma que o usuário administra mas que não é a
-- do próprio profile, o insert falhava com:
--
--   new row violates row-level security policy for table "solicitacoes_materiais"
--
-- As policies desta tabela são de antes do modelo de empresa ativa. Elas só
-- reconhecem:
--   profiles.empresa_id (por id ou e-mail), get_user_empresa_ids(email),
--   has_role(auth.uid(), 'admin')
--
-- O Super Admin do sistema é `is_super_admin(uid)`, que NÃO é o mesmo que
-- has_role('admin'). Por isso ele enxergava a empresa no seletor, conseguia
-- listar (o SELECT passa por get_user_empresa_ids em alguns casos) e era
-- barrado só na hora de gravar.
--
-- SOLUÇÃO
--
-- Acrescentar o padrão que o resto do sistema já usa —
-- is_active_empresa(auth.uid(), empresa_id), que exige que a empresa seja a
-- ATIVA e que o usuário esteja autorizado nela (super admin incluído).
--
-- Os caminhos antigos continuam valendo: ninguém perde acesso que já tinha.
-- Isto é aditivo e reversível — recria policies, não toca em dado.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- CABEÇALHO
DROP POLICY IF EXISTS "Solmat select por empresa" ON public.solicitacoes_materiais;
CREATE POLICY "Solmat select por empresa" ON public.solicitacoes_materiais
FOR SELECT USING (
  public.is_active_empresa(auth.uid(), empresa_id)
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Solmat insert por empresa" ON public.solicitacoes_materiais;
CREATE POLICY "Solmat insert por empresa" ON public.solicitacoes_materiais
FOR INSERT WITH CHECK (
  public.is_active_empresa(auth.uid(), empresa_id)
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Solmat update por empresa" ON public.solicitacoes_materiais;
CREATE POLICY "Solmat update por empresa" ON public.solicitacoes_materiais
FOR UPDATE USING (
  public.is_active_empresa(auth.uid(), empresa_id)
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Solmat delete por empresa" ON public.solicitacoes_materiais;
CREATE POLICY "Solmat delete por empresa" ON public.solicitacoes_materiais
FOR DELETE USING (
  public.is_active_empresa(auth.uid(), empresa_id)
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ------------------------------------------------------------------- ITENS
-- Os itens seguem o cabeçalho: a autorização é a da solicitação a que pertencem.
DROP POLICY IF EXISTS "Solmat itens select por empresa" ON public.solicitacoes_materiais_itens;
CREATE POLICY "Solmat itens select por empresa" ON public.solicitacoes_materiais_itens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_materiais s
     WHERE s.id = solicitacao_id
       AND (
         public.is_active_empresa(auth.uid(), s.empresa_id)
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
         OR (s.empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
       )
  )
);

DROP POLICY IF EXISTS "Solmat itens insert por empresa" ON public.solicitacoes_materiais_itens;
CREATE POLICY "Solmat itens insert por empresa" ON public.solicitacoes_materiais_itens
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_materiais s
     WHERE s.id = solicitacao_id
       AND (
         public.is_active_empresa(auth.uid(), s.empresa_id)
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
         OR (s.empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
       )
  )
);

DROP POLICY IF EXISTS "Solmat itens update por empresa" ON public.solicitacoes_materiais_itens;
CREATE POLICY "Solmat itens update por empresa" ON public.solicitacoes_materiais_itens
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_materiais s
     WHERE s.id = solicitacao_id
       AND (
         public.is_active_empresa(auth.uid(), s.empresa_id)
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
         OR (s.empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
       )
  )
);

DROP POLICY IF EXISTS "Solmat itens delete por empresa" ON public.solicitacoes_materiais_itens;
CREATE POLICY "Solmat itens delete por empresa" ON public.solicitacoes_materiais_itens
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_materiais s
     WHERE s.id = solicitacao_id
       AND (
         public.is_active_empresa(auth.uid(), s.empresa_id)
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid()))
         OR (s.empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
         OR (s.empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
       )
  )
);

COMMIT;
