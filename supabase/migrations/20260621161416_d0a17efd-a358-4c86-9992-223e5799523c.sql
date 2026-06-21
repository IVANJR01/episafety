-- Responsáveis ambientais (expansão)
ALTER TABLE public.ppp_responsaveis_ambientais
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS conselho text,
  ADD COLUMN IF NOT EXISTS conselho_uf text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Responsáveis médicos (expansão)
ALTER TABLE public.ppp_responsaveis_medicos
  ADD COLUMN IF NOT EXISTS uf_crm text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- Exames referenciados (expansão)
ALTER TABLE public.ppp_exames_referenciados
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS aptidao text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Versões de PDF (expansão)
ALTER TABLE public.ppp_pdf_versoes
  ADD COLUMN IF NOT EXISTS pdf_versao integer,
  ADD COLUMN IF NOT EXISTS com_marca_dagua boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_no_momento text,
  ADD COLUMN IF NOT EXISTS versao_ppp_snapshot integer,
  ADD COLUMN IF NOT EXISTS drive_path text,
  ADD COLUMN IF NOT EXISTS nome_arquivo text,
  ADD COLUMN IF NOT EXISTS tamanho_bytes integer,
  ADD COLUMN IF NOT EXISTS pdf_hash text;

UPDATE public.ppp_pdf_versoes SET pdf_hash = sha256 WHERE pdf_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ppp_pdf_versoes_ppp_versao_idx
  ON public.ppp_pdf_versoes (ppp_id, pdf_versao);

-- Assinaturas visuais (expansão)
ALTER TABLE public.ppp_assinaturas
  ADD COLUMN IF NOT EXISTS pdf_versao_id uuid,
  ADD COLUMN IF NOT EXISTS pdf_versao integer,
  ADD COLUMN IF NOT EXISTS pdf_hash text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_registro text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS ip_origem text;

-- RPC: registrar versão de PDF
CREATE OR REPLACE FUNCTION public.ppp_pdf_registrar(
  _ppp_id uuid,
  _drive_file_id text,
  _drive_view_link text,
  _drive_path text,
  _nome_arquivo text,
  _tamanho_bytes integer,
  _pdf_hash text,
  _com_marca_dagua boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid; _versao int; _status text; _prox int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;

  SELECT empresa_id, versao, status INTO _emp, _versao, _status
    FROM public.ppp_documentos WHERE id = _ppp_id;
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'PPP não encontrado';
  END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _emp)) THEN
    RAISE EXCEPTION 'Sem acesso a este PPP' USING ERRCODE='42501';
  END IF;
  IF _status IN ('substituido','arquivado') THEN
    RAISE EXCEPTION 'PPP % não permite gerar nova versão de PDF', _status;
  END IF;

  SELECT COALESCE(MAX(pdf_versao),0)+1 INTO _prox
    FROM public.ppp_pdf_versoes WHERE ppp_id = _ppp_id;

  INSERT INTO public.ppp_pdf_versoes (
    ppp_id, empresa_id, tipo, sha256, drive_id, drive_link,
    pdf_versao, com_marca_dagua, status_no_momento, versao_ppp_snapshot,
    drive_path, nome_arquivo, tamanho_bytes, pdf_hash,
    gerado_em, gerado_por
  ) VALUES (
    _ppp_id, _emp,
    CASE WHEN _com_marca_dagua THEN 'rascunho' ELSE 'final' END,
    _pdf_hash, _drive_file_id, _drive_view_link,
    _prox, _com_marca_dagua, _status, _versao,
    _drive_path, _nome_arquivo, _tamanho_bytes, _pdf_hash,
    now(), auth.uid()
  );

  INSERT INTO public.ppp_revisoes (ppp_id, empresa_id, acao, descricao, created_by)
    VALUES (_ppp_id, _emp, 'pdf_gerado',
      'PDF v'||_prox||' ('||CASE WHEN _com_marca_dagua THEN 'rascunho' ELSE 'final' END||') hash '||left(_pdf_hash,12),
      auth.uid());

  RETURN jsonb_build_object('pdf_versao', _prox, 'status', _status);
END;
$$;

REVOKE ALL ON FUNCTION public.ppp_pdf_registrar(uuid,text,text,text,text,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ppp_pdf_registrar(uuid,text,text,text,text,integer,text,boolean) TO authenticated;

-- RPC: assinar visual (exige MFA AAL2 + PDF final sem marca d'água)
CREATE OR REPLACE FUNCTION public.ppp_assinar_visual(
  _ppp_id uuid,
  _pdf_hash text,
  _responsavel_nome text,
  _responsavel_registro text,
  _ip_origem text,
  _observacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid; _status text; _aal text; _ver_id uuid; _ver int; _com_marca boolean; _email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;

  _aal := COALESCE((auth.jwt() ->> 'aal'), '');
  IF _aal <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) obrigatório para assinar' USING ERRCODE='42501';
  END IF;

  SELECT empresa_id, status INTO _emp, _status
    FROM public.ppp_documentos WHERE id = _ppp_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'PPP não encontrado'; END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _emp)) THEN
    RAISE EXCEPTION 'Sem acesso a este PPP' USING ERRCODE='42501';
  END IF;

  SELECT id, pdf_versao, com_marca_dagua INTO _ver_id, _ver, _com_marca
    FROM public.ppp_pdf_versoes
   WHERE ppp_id = _ppp_id AND pdf_hash = _pdf_hash
   ORDER BY pdf_versao DESC LIMIT 1;

  IF _ver_id IS NULL THEN
    RAISE EXCEPTION 'PDF não encontrado para o hash informado';
  END IF;
  IF _com_marca THEN
    RAISE EXCEPTION 'Não é permitido assinar PDF em rascunho/marca d''água';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.ppp_assinaturas (
    ppp_id, empresa_id, nome, papel, auth_aal,
    assinado_em, assinado_por,
    pdf_versao_id, pdf_versao, pdf_hash,
    responsavel_nome, responsavel_registro, observacao, user_email, ip_origem
  ) VALUES (
    _ppp_id, _emp, _responsavel_nome, 'responsavel_tecnico', _aal,
    now(), auth.uid(),
    _ver_id, _ver, _pdf_hash,
    _responsavel_nome, _responsavel_registro, _observacao, _email, _ip_origem
  );

  INSERT INTO public.ppp_revisoes (ppp_id, empresa_id, acao, descricao, created_by)
    VALUES (_ppp_id, _emp, 'pdf_assinado',
      'Assinatura visual em PDF v'||_ver||' por '||_responsavel_nome,
      auth.uid());

  RETURN jsonb_build_object('ok', true, 'pdf_versao', _ver);
END;
$$;

REVOKE ALL ON FUNCTION public.ppp_assinar_visual(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ppp_assinar_visual(uuid,text,text,text,text,text) TO authenticated;