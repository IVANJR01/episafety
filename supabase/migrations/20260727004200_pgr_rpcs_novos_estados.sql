-- ============================================================================
-- FASE 4.3 — RPCs alinhadas aos novos estados do Plano de Ação
-- ============================================================================
-- As duas RPCs de status ficaram para trás da conversão do enum para text:
--
--   pgr_acao_set_status
--     1. a whitelist listava só os 5 status antigos, rejeitando
--        programada/bloqueada/reprogramada;
--     2. fazia cast explícito para public.pgr_acao_status, o enum agora obsoleto,
--        que não conhece os valores novos;
--     3. declarava v_status_ant com o tipo do enum, o que quebraria ao ler uma
--        ação já gravada com um status novo.
--
--   pgr_marcar_atrasadas
--     1. mesmo cast para o enum obsoleto;
--     2. só considerava pendente/em_andamento — uma ação 'programada',
--        'bloqueada' ou 'reprogramada' com prazo vencido também está atrasada
--        e passava despercebida.
--
-- Sem esta correção o Kanban ofereceria estados que o banco recusaria em runtime.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pgr_acao_set_status(
  _acao_id uuid, _novo_status text, _motivo text DEFAULT NULL::text,
  _data_conclusao date DEFAULT NULL::date, _novo_prazo date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acao   public.pgr_acoes%ROWTYPE;
  v_pgr    public.pgr_documentos%ROWTYPE;
  v_email  text := lower(COALESCE(auth.jwt() ->> 'email',''));
  v_status_ant text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_acao FROM public.pgr_acoes WHERE id = _acao_id;
  IF v_acao.id IS NULL THEN RAISE EXCEPTION 'Ação não encontrada'; END IF;

  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = v_acao.pgr_id;
  IF NOT public.is_in_user_company_tree(auth.uid(), v_pgr.empresa_id)
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.is_principal(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR % — abra uma revisão para alterar o Plano de Ação', v_pgr.status;
  END IF;

  v_status_ant := v_acao.status;

  IF _novo_prazo IS NOT NULL THEN
    IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
      RAISE EXCEPTION 'Justificativa obrigatória para prorrogar prazo';
    END IF;
    -- Prorrogar passa a marcar a ação como reprogramada: o status precisa
    -- refletir que o prazo original não foi cumprido.
    UPDATE public.pgr_acoes
       SET prazo_original = COALESCE(prazo_original, prazo),
           prazo = _novo_prazo,
           motivo_prorrogacao = _motivo,
           status = CASE WHEN status IN ('concluida','cancelada')
                         THEN status ELSE 'reprogramada' END,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;
    INSERT INTO public.pgr_acao_historico(
      acao_id, pgr_id, empresa_id, status_anterior, status_novo,
      campo_alterado, valor_anterior, valor_novo, motivo, user_id, user_email
    ) VALUES (
      _acao_id, v_acao.pgr_id, v_acao.empresa_id, v_status_ant,
      (SELECT status FROM public.pgr_acoes WHERE id = _acao_id),
      'prazo', v_acao.prazo::text, _novo_prazo::text, _motivo, auth.uid(), NULLIF(v_email,'')
    );
    RETURN jsonb_build_object('success', true, 'acao', 'prorrogar', 'novo_prazo', _novo_prazo);
  END IF;

  IF _novo_status NOT IN ('pendente','programada','em_andamento','bloqueada',
                          'atrasada','reprogramada','concluida','cancelada') THEN
    RAISE EXCEPTION 'Status inválido: %', _novo_status;
  END IF;

  -- Bloquear também exige motivo: uma ação parada sem razão registrada é
  -- exatamente o que a revisão técnica precisa detectar.
  IF _novo_status = 'bloqueada' AND (_motivo IS NULL OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'Motivo obrigatório para bloquear a ação';
  END IF;

  IF _novo_status = 'concluida' THEN
    IF _data_conclusao IS NULL THEN
      RAISE EXCEPTION 'Data de conclusão obrigatória para concluir a ação';
    END IF;
    UPDATE public.pgr_acoes
       SET status = 'concluida',
           data_conclusao = _data_conclusao,
           concluida_por = auth.uid(),
           percentual_execucao = 100,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;

  ELSIF _novo_status = 'cancelada' THEN
    IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
      RAISE EXCEPTION 'Motivo obrigatório para cancelar a ação';
    END IF;
    UPDATE public.pgr_acoes
       SET status = 'cancelada',
           motivo_cancelamento = _motivo,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;

  ELSE
    UPDATE public.pgr_acoes
       SET status = _novo_status,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;
  END IF;

  INSERT INTO public.pgr_acao_historico(
    acao_id, pgr_id, empresa_id, status_anterior, status_novo,
    campo_alterado, valor_anterior, valor_novo, motivo, user_id, user_email
  ) VALUES (
    _acao_id, v_acao.pgr_id, v_acao.empresa_id, v_status_ant, _novo_status,
    'status', v_status_ant, _novo_status,
    CASE WHEN _novo_status IN ('cancelada','concluida','bloqueada') THEN _motivo ELSE NULL END,
    auth.uid(), NULLIF(v_email,'')
  );

  RETURN jsonb_build_object('success', true, 'status', _novo_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pgr_marcar_atrasadas(_pgr_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  WITH upd AS (
    UPDATE public.pgr_acoes a
       SET status = 'atrasada',
           updated_at = now()
     WHERE a.pgr_id = _pgr_id
       AND a.status IN ('pendente','programada','em_andamento','bloqueada','reprogramada')
       AND a.prazo IS NOT NULL
       AND a.prazo < CURRENT_DATE
       AND (public.is_super_admin(auth.uid())
            OR public.is_principal(auth.uid())
            OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))
    RETURNING a.id, a.empresa_id, a.pgr_id
  )
  INSERT INTO public.pgr_acao_historico(
    acao_id, pgr_id, empresa_id, status_anterior, status_novo,
    campo_alterado, motivo, user_id, user_email
  )
  SELECT id, pgr_id, empresa_id, NULL, 'atrasada',
         'status', 'Prazo vencido (auto)', auth.uid(), lower(COALESCE(auth.jwt() ->> 'email',''))
    FROM upd;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN COALESCE(v_n,0);
END;
$function$;
