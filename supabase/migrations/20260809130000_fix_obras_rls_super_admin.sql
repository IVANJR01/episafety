-- =====================================================================
-- `obras`: Super Admin não passava pela RLS
--
-- Sintoma: Cadastro de Local mostrava os locais, mas Editar devolvia
--   new row violates row-level security policy for table "obras"
-- com o usuário logado como Super Admin, na empresa CG3 (75447c33…).
--
-- Causa: as policies de `obras` reconhecem administrador apenas por
-- `public.has_role(auth.uid(), 'admin')`. O aplicativo, porém, trata
-- como Super Admin quem passa em `public.is_super_admin()`, ou tem papel
-- 'super_admin'/'superadmin', ou é principal em `usuarios_liberados`
-- (ver checkSuperAdmin em src/contexts/AuthContext.tsx). Quem é Super
-- Admin por qualquer um desses caminhos — e não tem vínculo explícito
-- com aquela empresa em `usuario_empresas` — não satisfaz nenhum ramo da
-- policy, e o INSERT é recusado.
--
-- É o mesmo defeito que 20260809110000 já corrigiu nas tabelas do
-- Dossiê, e a mesma conclusão: o certo é `public.is_super_admin()`.
--
-- Correção no padrão que o resto do banco já usa desde 20260309165911,
-- onde empresa_config, epis, funcionarios e entregas ganharam cada uma a
-- sua policy de acesso total para Super Admin. `obras` ficou de fora.
--
-- Policies são somadas com OU: acrescentar esta não restringe ninguém
-- que já tinha acesso. Idempotente.
-- =====================================================================

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access obras" ON public.obras;
CREATE POLICY "Super admin full access obras" ON public.obras
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
