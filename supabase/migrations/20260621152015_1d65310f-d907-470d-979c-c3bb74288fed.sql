
-- LTCAT Parte 5: PDF metadata + assinatura visual + validação interna

-- 1) Registrar PDF gerado
CREATE OR REPLACE FUNCTION public.ltcat_pdf_registrar(
  _ltcat_id uuid,
  _drive_file_id text,
  _drive_view_link text,
  _drive_path text,
  _nome_arquivo text,
  _tamanho_bytes bigint,
  _pdf_hash text,
  _com_marca_dagua boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _next int;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _pdf_hash IS NULL OR length(_pdf_hash) <> 64 THEN RAISE EXCEPTION 'Hash SHA-256 inválido (64 hex)'; END IF;
  IF _drive_file_id IS NULL OR length(_drive_file_id) < 5 THEN RAISE EXCEPTION 'drive_file_id inválido'; END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['ltcat:exportar']
             OR modulos_permitidos @> ARRAY['ltcat:editar']
             OR modulos_permitidos @> ARRAY['ltcat:revisar']
             OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:exportar requerida'; END IF;
  END IF;

  IF _doc.status IN ('substituido','arquivado') THEN
    RAISE EXCEPTION 'LTCAT % — não é permitido gerar nova versão de PDF', _doc.status;
  END IF;

  -- PDF final (sem marca) exige MFA
  IF NOT COALESCE(_com_marca_dagua,false) AND _aal <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) obrigatório para gerar PDF final do LTCAT';
  END IF;

  SELECT COALESCE(MAX(pdf_versao),0)+1 INTO _next
    FROM public.ltcat_pdf_versoes WHERE ltcat_id = _ltcat_id;

  INSERT INTO public.ltcat_pdf_versoes(
    ltcat_id, empresa_id, pdf_versao, pdf_hash,
    status_no_momento, com_marca_dagua,
    drive_file_id, drive_view_link, drive_path,
    nome_arquivo, tamanho_bytes, gerado_por
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _next, _pdf_hash,
    _doc.status, COALESCE(_com_marca_dagua,false),
    _drive_file_id, _drive_view_link, _drive_path,
    _nome_arquivo, _tamanho_bytes, auth.uid()
  );

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, motivo, user_id, user_email
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, _doc.status,
    'PDF v' || _next || ' (hash ' || left(_pdf_hash,12) || '…)' ||
      CASE WHEN COALESCE(_com_marca_dagua,false) THEN ' [RASCUNHO]' ELSE '' END,
    auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'pdf_versao', _next, 'hash', _pdf_hash);
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_pdf_registrar(uuid,text,text,text,text,bigint,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_pdf_registrar(uuid,text,text,text,text,bigint,text,boolean) TO authenticated, service_role;

-- 2) Assinar visualmente o LTCAT
CREATE OR REPLACE FUNCTION public.ltcat_assinar_visual(
  _ltcat_id uuid,
  _pdf_hash text,
  _responsavel_nome text,
  _responsavel_registro text,
  _ip_origem text,
  _observacao text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _ultima public.ltcat_pdf_versoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _aal <> 'aal2' THEN RAISE EXCEPTION 'MFA (AAL2) requerido para assinar'; END IF;
  IF _responsavel_nome IS NULL OR length(btrim(_responsavel_nome)) < 3 THEN
    RAISE EXCEPTION 'Responsável técnico é obrigatório';
  END IF;
  IF _pdf_hash IS NULL OR length(_pdf_hash) <> 64 THEN RAISE EXCEPTION 'Hash SHA-256 inválido'; END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['ltcat:assinar'] OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:assinar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'Assinatura visual só permitida em LTCAT rascunho/em revisão';
  END IF;

  SELECT * INTO _ultima FROM public.ltcat_pdf_versoes
   WHERE ltcat_id = _ltcat_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _ultima.id IS NULL THEN RAISE EXCEPTION 'Gere o PDF antes de assinar'; END IF;
  IF _ultima.pdf_hash <> _pdf_hash THEN
    RAISE EXCEPTION 'Hash divergente do último PDF — regenere o PDF';
  END IF;
  IF _ultima.com_marca_dagua THEN
    RAISE EXCEPTION 'Não é possível assinar PDF marcado como RASCUNHO — gere a versão final primeiro';
  END IF;

  INSERT INTO public.ltcat_assinaturas(
    ltcat_id, empresa_id, pdf_versao, pdf_hash,
    responsavel_nome, responsavel_registro,
    ip_origem, observacao, user_id, user_email
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _ultima.pdf_versao, _pdf_hash,
    btrim(_responsavel_nome), NULLIF(btrim(COALESCE(_responsavel_registro,'')),''),
    _ip_origem, NULLIF(_observacao,''), auth.uid(), NULLIF(_email,'')
  );

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, motivo, user_id, user_email
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, _doc.status,
    'Assinatura visual por ' || _responsavel_nome || ' (PDF v' || _ultima.pdf_versao || ')',
    auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'pdf_versao', _ultima.pdf_versao);
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_assinar_visual(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_assinar_visual(uuid,text,text,text,text,text) TO authenticated, service_role;

-- 3) Validação interna (consumida pela rota /ltcat/validar/:id)
CREATE OR REPLACE FUNCTION public.ltcat_validar_interno(_ltcat_id uuid, _pdf_versao int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _emp record;
  _uni record;
  _pdf public.ltcat_pdf_versoes%ROWTYPE;
  _rt text;
  _rt_reg text;
  _desatualizado boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  IF NOT (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _doc.empresa_id)) THEN
    RAISE EXCEPTION 'Fora do escopo da empresa';
  END IF;

  SELECT id, nome, cnpj INTO _emp FROM public.empresa_config WHERE id = _doc.empresa_id;
  IF _doc.unidade_id IS NOT NULL THEN
    SELECT id, nome INTO _uni FROM public.empresa_config WHERE id = _doc.unidade_id;
  END IF;

  IF _pdf_versao IS NOT NULL THEN
    SELECT * INTO _pdf FROM public.ltcat_pdf_versoes
     WHERE ltcat_id = _ltcat_id AND pdf_versao = _pdf_versao;
  ELSE
    SELECT * INTO _pdf FROM public.ltcat_pdf_versoes
     WHERE ltcat_id = _ltcat_id ORDER BY pdf_versao DESC LIMIT 1;
  END IF;

  IF _pdf.id IS NOT NULL THEN
    _desatualizado := _pdf.gerado_em < _doc.conteudo_atualizado_em;
  END IF;

  SELECT nome, registro_profissional INTO _rt, _rt_reg
    FROM public.ltcat_responsaveis_tecnicos
   WHERE ltcat_id = _ltcat_id ORDER BY ordem NULLS LAST, created_at LIMIT 1;

  RETURN jsonb_build_object(
    'id', _doc.id,
    'versao', _doc.versao,
    'status', _doc.status,
    'empresa_nome', _emp.nome,
    'empresa_cnpj', _emp.cnpj,
    'unidade_nome', _uni.nome,
    'data_vigencia_inicio', _doc.data_vigencia_inicio,
    'data_vigencia_fim', _doc.data_vigencia_fim,
    'resp_tec_nome', _rt,
    'resp_tec_registro', _rt_reg,
    'conteudo_atualizado_em', _doc.conteudo_atualizado_em,
    'pdf_desatualizado', _desatualizado,
    'pdf', CASE WHEN _pdf.id IS NULL THEN NULL ELSE jsonb_build_object(
      'pdf_versao', _pdf.pdf_versao,
      'pdf_hash', _pdf.pdf_hash,
      'status_no_momento', _pdf.status_no_momento,
      'com_marca_dagua', _pdf.com_marca_dagua,
      'drive_view_link', _pdf.drive_view_link,
      'gerado_em', _pdf.gerado_em
    ) END
  );
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_validar_interno(uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_validar_interno(uuid,int) TO authenticated, service_role;

-- 4) Atualiza ltcat_publicar: exige PDF final atualizado + assinatura visual quando há RT
CREATE OR REPLACE FUNCTION public.ltcat_publicar(_ltcat_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _rt_count int; _concl_count int; _agente_count int; _pendentes int;
  _ultima public.ltcat_pdf_versoes%ROWTYPE;
  _assin int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _aal <> 'aal2' THEN RAISE EXCEPTION 'MFA (AAL2) obrigatório para publicar LTCAT'; END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id FOR UPDATE;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['ltcat:revisar'] OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:revisar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'Apenas LTCAT em rascunho ou em revisão pode ser publicado (status: %)', _doc.status;
  END IF;

  SELECT count(*) INTO _rt_count FROM public.ltcat_responsaveis_tecnicos WHERE ltcat_id = _ltcat_id;
  IF _rt_count = 0 THEN RAISE EXCEPTION 'É obrigatório pelo menos 1 Responsável Técnico'; END IF;

  SELECT count(*) INTO _agente_count FROM public.ltcat_agentes WHERE ltcat_id = _ltcat_id;
  IF _agente_count = 0 THEN RAISE EXCEPTION 'É obrigatório pelo menos 1 agente nocivo cadastrado'; END IF;

  SELECT count(*) INTO _concl_count FROM public.ltcat_conclusoes WHERE ltcat_id = _ltcat_id;
  IF _concl_count = 0 THEN RAISE EXCEPTION 'É obrigatória ao menos 1 conclusão previdenciária'; END IF;

  SELECT count(*) INTO _pendentes
    FROM public.ltcat_conclusoes
   WHERE ltcat_id = _ltcat_id
     AND conclusao IN ('especial_15','especial_20','especial_25','inconclusivo')
     AND (justificativa IS NULL OR length(btrim(justificativa)) < 5);
  IF _pendentes > 0 THEN
    RAISE EXCEPTION '% conclusão(ões) sem justificativa técnica obrigatória', _pendentes;
  END IF;

  -- PDF final atualizado
  SELECT * INTO _ultima FROM public.ltcat_pdf_versoes
   WHERE ltcat_id = _ltcat_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _ultima.id IS NULL THEN RAISE EXCEPTION 'Publicação requer PDF gerado'; END IF;
  IF _ultima.com_marca_dagua THEN RAISE EXCEPTION 'Publicação requer PDF final (sem marca d''água RASCUNHO)'; END IF;
  IF _ultima.gerado_em < _doc.conteudo_atualizado_em THEN
    RAISE EXCEPTION 'PDF desatualizado — regenere após as últimas alterações';
  END IF;

  -- Assinatura visual quando há RT
  IF _rt_count > 0 THEN
    SELECT count(*) INTO _assin FROM public.ltcat_assinaturas
     WHERE ltcat_id = _ltcat_id AND pdf_hash = _ultima.pdf_hash;
    IF _assin = 0 THEN
      RAISE EXCEPTION 'Publicação requer assinatura visual do responsável técnico sobre o PDF v% (hash atual)', _ultima.pdf_versao;
    END IF;
  END IF;

  UPDATE public.ltcat_documentos
     SET status = 'substituido'::public.ltcat_status,
         updated_at = now(), updated_by = auth.uid()
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id
     AND status = 'vigente' AND id <> _ltcat_id;

  UPDATE public.ltcat_documentos
     SET status = 'vigente'::public.ltcat_status,
         publicado_em = now(), publicado_por = auth.uid(),
         data_emissao = COALESCE(data_emissao, current_date),
         updated_at = now(), updated_by = auth.uid()
   WHERE id = _ltcat_id;

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, motivo, user_id, user_email
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, 'vigente'::public.ltcat_status,
    'Publicação do LTCAT — PDF v' || _ultima.pdf_versao,
    auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'ltcat_id', _ltcat_id, 'versao', _doc.versao, 'pdf_versao', _ultima.pdf_versao);
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_publicar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_publicar(uuid) TO authenticated, service_role;
