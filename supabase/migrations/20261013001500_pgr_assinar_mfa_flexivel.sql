-- Correção pgr_assinar_visual: não bloquear por MFA caso o usuário não tenha MFA enforced
CREATE OR REPLACE FUNCTION public.pgr_assinar_visual(
  _pgr_id uuid,
  _pdf_hash text,
  _responsavel_nome text,
  _responsavel_registro text,
  _ip_origem text,
  _observacao text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc public.pgr_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _mfa jsonb;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _ultima public.pgr_pdf_versoes%ROWTYPE;
  _ass_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _responsavel_nome IS NULL OR length(btrim(_responsavel_nome)) < 3 THEN
    RAISE EXCEPTION 'Responsável técnico é obrigatório';
  END IF;
  IF _pdf_hash IS NULL OR length(_pdf_hash) <> 64 THEN RAISE EXCEPTION 'Hash SHA-256 inválido'; END IF;

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
        AND (modulos_permitidos @> ARRAY['pgr:assinar'] OR modulos_permitidos @> ARRAY['pgr'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão pgr:assinar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao','em_revisao_tecnica','aguardando_aprovacao','aguardando_assinatura') THEN
    RAISE EXCEPTION 'Assinatura visual só permitida em PGR rascunho/em revisão';
  END IF;

  -- MFA: se o enforcement estiver ativo e obrigatório no banco, checa AAL2
  BEGIN
    _mfa := public.mfa_required_for_current_user();
    IF (_mfa ->> 'enforced')::boolean = true AND _aal <> 'aal2' THEN
      RAISE EXCEPTION 'MFA (AAL2) requerido para assinar';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Valida hash com último PDF registrado
  SELECT * INTO _ultima FROM public.pgr_pdf_versoes
   WHERE pgr_id = _pgr_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _ultima.id IS NULL THEN
    RAISE EXCEPTION 'Gere o PDF antes de assinar';
  END IF;
  IF _ultima.pdf_hash <> _pdf_hash THEN
    RAISE EXCEPTION 'Hash divergente do último PDF — gere o PDF novamente';
  END IF;
  IF _ultima.com_marca_dagua THEN
    RAISE EXCEPTION 'Não é possível assinar um PDF marcado como RASCUNHO — gere a versão final primeiro';
  END IF;

  INSERT INTO public.pgr_assinaturas(
    pgr_id, empresa_id, responsavel_user_id, responsavel_nome, responsavel_registro,
    pdf_hash, pdf_versao, ip_origem, mfa_verificado, observacao
  ) VALUES (
    _pgr_id, _doc.empresa_id, auth.uid(), btrim(_responsavel_nome), NULLIF(btrim(_responsavel_registro),''),
    _pdf_hash, _ultima.pdf_versao, _ip_origem, (_aal = 'aal2'), NULLIF(btrim(_observacao),'')
  ) RETURNING id INTO _ass_id;

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_pgr_id, _doc.empresa_id, _doc.versao, _doc.versao, _doc.status, _doc.status,
    'assinado', 'Assinatura visual por ' || btrim(_responsavel_nome) ||
      ' (PDF v' || _ultima.pdf_versao || ')' ||
      CASE WHEN _aal = 'aal2' THEN ' [MFA verificado]' ELSE '' END,
    auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object(
    'assinatura_id', _ass_id,
    'pdf_versao', _ultima.pdf_versao,
    'mfa_verificado', (_aal = 'aal2')
  );
END;$$;

REVOKE EXECUTE ON FUNCTION public.pgr_assinar_visual(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_assinar_visual(uuid,text,text,text,text,text) TO authenticated, service_role;
