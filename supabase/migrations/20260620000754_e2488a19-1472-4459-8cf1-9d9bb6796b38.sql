
-- ============================================================
-- FASE 1 — Endurecimento de RLS e SECURITY DEFINER
-- ============================================================

-- 1) aso_numeracao: substituir policy permissiva por scope de empresa
DROP POLICY IF EXISTS aso_num_authenticated ON public.aso_numeracao;

CREATE POLICY aso_num_select ON public.aso_numeracao
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY aso_num_insert ON public.aso_numeracao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY aso_num_update ON public.aso_numeracao
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- 2) Revogar EXECUTE de anon em TODAS as funções SECURITY DEFINER do schema public
--    (mantém para authenticated apenas onde necessário; trigger functions: revoga geral)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- 3) Funções de trigger não devem ter execute pra authenticated tampouco
REVOKE EXECUTE ON FUNCTION public.adjust_epi_stock() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_substituicao_epi() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_epi_stock() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_contrato_stock_on_entrega_delete() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_contrato_stock_on_entrega() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_empresa_id() FROM authenticated;

-- 4) Helpers usados em RLS PRECISAM permanecer executáveis por authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_principal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_in_user_company_tree(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_same_company_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_empresa_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_empresa_ids(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_parent_empresa_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_funcionario_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_contrato_target_for_entrega(uuid, uuid, uuid) TO authenticated;

-- 5) RPCs chamadas direto pelo client: manter para authenticated, bloqueado para anon (já feito acima)
GRANT EXECUTE ON FUNCTION public.gerar_numero_aso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidated_epi_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filial_epis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_epi_stock(uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_epi_to_contract(uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_epi_between_contracts(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_conferencia_estoque(uuid, uuid, uuid, text, jsonb, text) TO authenticated;

-- 6) Hardening: adicionar checagem auth.uid() IS NOT NULL no topo das RPCs sensíveis
CREATE OR REPLACE FUNCTION public.gerar_numero_aso(_empresa_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ano int := EXTRACT(YEAR FROM now())::int;
  _seq int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _empresa_id)) THEN
    RAISE EXCEPTION 'Sem permissão para gerar número de ASO desta empresa';
  END IF;

  INSERT INTO public.aso_numeracao (empresa_id, ano, ultimo_seq)
  VALUES (_empresa_id, _ano, 1)
  ON CONFLICT (empresa_id, ano) DO UPDATE
    SET ultimo_seq = public.aso_numeracao.ultimo_seq + 1
  RETURNING ultimo_seq INTO _seq;
  RETURN 'ASO-' || _ano::text || '-' || lpad(_seq::text, 4, '0');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gerar_numero_aso(uuid) TO authenticated;
