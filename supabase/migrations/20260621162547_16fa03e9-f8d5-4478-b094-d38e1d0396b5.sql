
-- ============================================================================
-- PPP - Parte 6: RPC ppp_publicar (validações fortes + MFA AAL2)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ppp_publicar(_ppp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _doc public.ppp_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _has_perm boolean := false;
  _periodo_count int;
  _exp_count int;
  _resp_amb_count int;
  _ultima public.ppp_pdf_versoes%ROWTYPE;
  _assin int;
  _exp_sem_per int;
  _esp_sem_fund int;
  _inconc_sem_just int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _aal <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) obrigatório para publicar PPP';
  END IF;

  SELECT * INTO _doc FROM public.ppp_documentos WHERE id = _ppp_id FOR UPDATE;
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'PPP não encontrado';
  END IF;

  -- Permissão: super_admin / principal ou ppp:revisar dentro da árvore da empresa
  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email) = _email AND ativo = true
        AND (modulos_permitidos @> ARRAY['ppp:revisar'] OR modulos_permitidos @> ARRAY['ppp'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN
      RAISE EXCEPTION 'Permissão ppp:revisar requerida';
    END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'Apenas PPP em rascunho ou em revisão pode ser publicado (status: %)', _doc.status;
  END IF;

  -- Histórico laboral: >=1 período
  SELECT count(*) INTO _periodo_count FROM public.ppp_periodos WHERE ppp_id = _ppp_id;
  IF _periodo_count = 0 THEN
    RAISE EXCEPTION 'É obrigatório pelo menos 1 período laboral cadastrado';
  END IF;

  -- Exposições: >=1 exposição OU justificativa técnica explícita nas observações
  SELECT count(*) INTO _exp_count FROM public.ppp_exposicoes WHERE ppp_id = _ppp_id;
  IF _exp_count = 0 THEN
    IF COALESCE(length(btrim(_doc.observacoes)), 0) < 20 THEN
      RAISE EXCEPTION 'Sem exposições cadastradas — registre ao menos 1 exposição OU descreva justificativa técnica (>=20 caracteres) no campo Observações do PPP';
    END IF;
  END IF;

  -- Todas as exposições devem estar vinculadas a um período
  SELECT count(*) INTO _exp_sem_per
    FROM public.ppp_exposicoes
   WHERE ppp_id = _ppp_id AND periodo_id IS NULL;
  IF _exp_sem_per > 0 THEN
    RAISE EXCEPTION '% exposição(ões) sem período laboral vinculado', _exp_sem_per;
  END IF;

  -- Conclusões "especial_*" exigem fundamento_legal
  SELECT count(*) INTO _esp_sem_fund
    FROM public.ppp_exposicoes
   WHERE ppp_id = _ppp_id
     AND COALESCE(conclusao_previdenciaria,'') LIKE 'especial_%'
     AND COALESCE(length(btrim(fundamento_legal)),0) < 5;
  IF _esp_sem_fund > 0 THEN
    RAISE EXCEPTION '% exposição(ões) com conclusão especial sem fundamento legal', _esp_sem_fund;
  END IF;

  -- Conclusões inconclusivas exigem justificativa
  SELECT count(*) INTO _inconc_sem_just
    FROM public.ppp_exposicoes
   WHERE ppp_id = _ppp_id
     AND conclusao_previdenciaria = 'inconclusivo'
     AND COALESCE(length(btrim(justificativa)),0) < 5;
  IF _inconc_sem_just > 0 THEN
    RAISE EXCEPTION '% exposição(ões) inconclusiva(s) sem justificativa técnica', _inconc_sem_just;
  END IF;

  -- Responsável ambiental obrigatório (>=1)
  SELECT count(*) INTO _resp_amb_count FROM public.ppp_responsaveis_ambientais WHERE ppp_id = _ppp_id;
  IF _resp_amb_count = 0 THEN
    RAISE EXCEPTION 'É obrigatório pelo menos 1 Responsável Ambiental';
  END IF;

  -- PDF final atualizado (sem marca d'água, gerado após última edição)
  SELECT * INTO _ultima FROM public.ppp_pdf_versoes
   WHERE ppp_id = _ppp_id ORDER BY pdf_versao DESC LIMIT 1;
  IF _ultima.id IS NULL THEN
    RAISE EXCEPTION 'Publicação requer PDF gerado';
  END IF;
  IF COALESCE(_ultima.com_marca_dagua, true) THEN
    RAISE EXCEPTION 'Publicação requer PDF final (sem marca d''água)';
  END IF;
  IF _ultima.gerado_em < _doc.conteudo_atualizado_em THEN
    RAISE EXCEPTION 'PDF desatualizado — regenere após as últimas alterações';
  END IF;

  -- Assinatura visual obrigatória sobre o hash do PDF final atual
  SELECT count(*) INTO _assin
    FROM public.ppp_assinaturas
   WHERE ppp_id = _ppp_id AND pdf_hash = _ultima.sha256;
  IF _assin = 0 THEN
    RAISE EXCEPTION 'Publicação requer assinatura visual sobre o PDF v% (hash atual)', _ultima.pdf_versao;
  END IF;

  -- Marca versão vigente anterior do mesmo funcionário como substituida
  UPDATE public.ppp_documentos
     SET status = 'substituido'::public.ppp_status,
         updated_at = now(), updated_by = auth.uid()
   WHERE empresa_id = _doc.empresa_id
     AND funcionario_id = _doc.funcionario_id
     AND status = 'vigente'
     AND id <> _ppp_id;

  -- Promove para vigente
  UPDATE public.ppp_documentos
     SET status = 'vigente'::public.ppp_status,
         publicado_em = now(),
         publicado_por = auth.uid(),
         data_emissao = COALESCE(data_emissao, current_date),
         updated_at = now(),
         updated_by = auth.uid()
   WHERE id = _ppp_id;

  -- Log append-only
  INSERT INTO public.ppp_revisoes(
    ppp_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, motivo, acao, descricao,
    user_id, user_email, created_by
  ) VALUES (
    _ppp_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, 'vigente'::public.ppp_status,
    'Publicação do PPP — PDF v' || _ultima.pdf_versao,
    'publicacao',
    'PPP publicado como vigente; versão anterior (se houver) marcada como substituída.',
    auth.uid(), NULLIF(_email,''), auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'ppp_id', _ppp_id,
    'versao', _doc.versao,
    'pdf_versao', _ultima.pdf_versao
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ppp_publicar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ppp_publicar(uuid) TO authenticated, service_role;

-- Índices auxiliares para o Dashboard PPP
CREATE INDEX IF NOT EXISTS ppp_documentos_empresa_status_idx
  ON public.ppp_documentos (empresa_id, status);
CREATE INDEX IF NOT EXISTS ppp_documentos_funcionario_idx
  ON public.ppp_documentos (empresa_id, funcionario_id);
CREATE INDEX IF NOT EXISTS ppp_exposicoes_ppp_idx
  ON public.ppp_exposicoes (ppp_id);
CREATE INDEX IF NOT EXISTS ppp_pdf_versoes_ppp_idx
  ON public.ppp_pdf_versoes (ppp_id, pdf_versao DESC);
CREATE INDEX IF NOT EXISTS ppp_assinaturas_ppp_hash_idx
  ON public.ppp_assinaturas (ppp_id, pdf_hash);
