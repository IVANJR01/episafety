-- =====================================================================
-- document_access_log: Super Admin não conseguia registrar leitura
--
-- Mesma família de defeito do bucket e de obras: a policy reconhecia
-- administrador apenas por has_role(auth.uid(),'admin'), e quem é Super
-- Admin pelo papel 'super_admin' em user_roles não passava.
--
-- Aqui a falha era silenciosa — a tela chama registrarAcesso sem esperar
-- resposta —, então a trilha de "quem abriu qual documento" simplesmente não
-- gravava para esse usuário. Auditoria com buraco é pior que auditoria
-- nenhuma, porque parece completa.
--
-- A exigência `usuario_id = auth.uid()` no INSERT continua: cada um só
-- registra o próprio acesso, ninguém escreve log em nome de outro.
--
-- Já aplicada no banco de produção nesta sessão; fica aqui para o histórico
-- e para qualquer ambiente novo.
-- =====================================================================

DROP POLICY IF EXISTS "dal_insert" ON public.document_access_log;
CREATE POLICY "dal_insert" ON public.document_access_log
FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (
    empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "dal_select" ON public.document_access_log;
CREATE POLICY "dal_select" ON public.document_access_log
FOR SELECT TO authenticated
USING (
  empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> 'email'))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_super_admin(auth.uid())
);
