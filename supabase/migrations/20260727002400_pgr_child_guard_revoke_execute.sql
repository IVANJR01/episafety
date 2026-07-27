-- ============================================================================
-- Hardening: pgr_child_guard não deve ser chamável via RPC
-- ============================================================================
-- pgr_child_guard é uma função de TRIGGER com SECURITY DEFINER. Triggers são
-- disparados pelo próprio banco e não dependem do privilégio EXECUTE do chamador,
-- mas o EXECUTE concedido por padrão a anon/authenticated a expunha como endpoint
-- em /rest/v1/rpc/pgr_child_guard (apontado pelo advisor de segurança do Supabase).
--
-- Revogar fecha essa superfície sem afetar os triggers — verificado após aplicar.
--
-- NOTA: o mesmo padrão existe em ~135 outras funções SECURITY DEFINER do projeto,
-- anteriores a esta mudança. Não foram tocadas aqui: revogar em massa exige
-- verificar caso a caso quais são realmente usadas como RPC pelo frontend.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.pgr_child_guard() FROM anon, authenticated, PUBLIC;

COMMENT ON FUNCTION public.pgr_child_guard() IS
  'Trigger BEFORE das tabelas-filhas do PGR: deriva empresa_id do documento pai e recalcula as classificações de risco. EXECUTE revogado de anon/authenticated — não deve ser chamável via RPC.';
