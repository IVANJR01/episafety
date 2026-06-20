
CREATE OR REPLACE FUNCTION public.pgr_publicar(_pgr_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc public.pgr_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false; _ant_id uuid;
  _ultima public.pgr_pdf_versoes%ROWTYPE;
  _mfa jsonb;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _inv_total int;
  _inv_alto_crit int;
  _acoes_ativas int;
  _assin_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _doc FROM public.pgr_documentos WHERE id = _pgr_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['pgr:revisar'] OR modulos_permitidos @> ARRAY['pgr'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão pgr:revisar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR não está em estado publicável';
  END IF;

  -- MFA obrigatório quando exigido pela política
  _mfa := public.mfa_required_for_current_user();
  IF (_mfa ->> 'required')::boolean = true AND _aal <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) requerido para publicar';
  END IF;

  -- Inventário preenchido
  SELECT count(*) INTO _inv_total
    FROM public.pgr_inventario_itens WHERE pgr_id = _pgr_id;
  IF _inv_total = 0 THEN
    RAISE EXCEPTION 'Publicação requer inventário de riscos preenchido';
  END IF;

  -- Riscos alto/crítico exigem ao menos 1 ação ativa
  SELECT count(*) INTO _inv_alto_crit
    FROM public.pgr_inventario_itens
   WHERE pgr_id = _pgr_id AND classificacao IN ('alto','critico');
  IF _inv_alto_crit > 0 THEN
    SELECT count(*) INTO _acoes_ativas
      FROM public.pgr_acoes
     WHERE pgr_id = _pgr_id AND status <> 'cancelada';
    IF _acoes_ativas = 0 THEN
      RAISE EXCEPTION 'Publicação requer ao menos 1 ação vinculada (existem riscos alto/crítico)';
    END IF;
  END IF;

  -- PDF final atualizado
  SELECT * INTO _ultima FROM public.pgr_pdf_versoes
   WHERE pgr_id = _pgr_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _ultima.id IS NULL THEN
    RAISE EXCEPTION 'Publicação requer PDF gerado';
  END IF;
  IF _ultima.com_marca_dagua THEN
    RAISE EXCEPTION 'Publicação requer PDF final (sem marca d''água RASCUNHO)';
  END IF;
  IF _ultima.gerado_em < _doc.conteudo_atualizado_em THEN
    RAISE EXCEPTION 'PDF desatualizado — regenere após as últimas alterações';
  END IF;

  -- Se há responsável técnico preenchido, exige assinatura visual da versão atual do PDF
  IF _doc.responsavel_tecnico_id IS NOT NULL OR COALESCE(btrim(_doc.resp_tec_nome),'') <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pgr_assinaturas
       WHERE pgr_id = _pgr_id
         AND pdf_versao = _ultima.pdf_versao
         AND pdf_hash = _ultima.pdf_hash
    ) INTO _assin_ok;
    IF NOT _assin_ok THEN
      RAISE EXCEPTION 'Publicação requer assinatura visual do PDF v% pelo responsável técnico', _ultima.pdf_versao;
    END IF;
  END IF;

  UPDATE public.pgr_documentos
     SET status = 'substituido'::public.pgr_status, updated_at = now()
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id
     AND status = 'vigente'::public.pgr_status
     AND id <> _doc.id
   RETURNING id INTO _ant_id;

  UPDATE public.pgr_documentos
     SET status = 'vigente'::public.pgr_status,
         data_emissao = COALESCE(data_emissao, CURRENT_DATE),
         updated_at = now()
   WHERE id = _pgr_id;

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_pgr_id, _doc.empresa_id, _doc.versao, _doc.versao, _doc.status,
    'vigente'::public.pgr_status, 'publicar',
    CASE WHEN _ant_id IS NOT NULL THEN 'Substitui PGR anterior ' || _ant_id::text END,
    auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object('success', true, 'pgr_id', _pgr_id,
    'substituiu', _ant_id, 'pdf_versao', _ultima.pdf_versao);
END;$$;
REVOKE EXECUTE ON FUNCTION public.pgr_publicar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_publicar(uuid) TO authenticated, service_role;
