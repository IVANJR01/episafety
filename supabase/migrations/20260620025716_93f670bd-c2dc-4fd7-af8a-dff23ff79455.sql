
-- ============================================================
-- PGR Parte 5: PDF técnico interno + versionamento + assinatura visual
-- ============================================================

-- 1) Coluna para detectar conteúdo alterado após geração do PDF
ALTER TABLE public.pgr_documentos
  ADD COLUMN IF NOT EXISTS conteudo_atualizado_em timestamptz NOT NULL DEFAULT now();

-- 2) Trigger: atualiza conteudo_atualizado_em quando dados (não-PDF) mudam
CREATE OR REPLACE FUNCTION public.pgr_doc_touch_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.versao IS DISTINCT FROM OLD.versao
        OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
        OR NEW.responsavel_tecnico_id IS DISTINCT FROM OLD.responsavel_tecnico_id
        OR NEW.resp_tec_nome IS DISTINCT FROM OLD.resp_tec_nome
        OR NEW.resp_tec_registro IS DISTINCT FROM OLD.resp_tec_registro
        OR NEW.metodologia_avaliacao IS DISTINCT FROM OLD.metodologia_avaliacao
        OR NEW.escopo IS DISTINCT FROM OLD.escopo
        OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
        OR NEW.data_vigencia_inicio IS DISTINCT FROM OLD.data_vigencia_inicio
        OR NEW.data_vigencia_fim IS DISTINCT FROM OLD.data_vigencia_fim) THEN
      NEW.conteudo_atualizado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_pgr_doc_touch ON public.pgr_documentos;
CREATE TRIGGER trg_pgr_doc_touch BEFORE UPDATE ON public.pgr_documentos
  FOR EACH ROW EXECUTE FUNCTION public.pgr_doc_touch_content();

-- 3) Trigger: filhos (inventário, ações, evidências) marcam conteúdo do PGR como alterado
CREATE OR REPLACE FUNCTION public.pgr_child_touch_doc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pgr uuid;
BEGIN
  _pgr := COALESCE(NEW.pgr_id, OLD.pgr_id);
  IF _pgr IS NOT NULL THEN
    UPDATE public.pgr_documentos
       SET conteudo_atualizado_em = now()
     WHERE id = _pgr;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
DROP TRIGGER IF EXISTS trg_pgr_inv_touch ON public.pgr_inventario_itens;
CREATE TRIGGER trg_pgr_inv_touch AFTER INSERT OR UPDATE OR DELETE ON public.pgr_inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_touch_doc();
DROP TRIGGER IF EXISTS trg_pgr_acao_touch ON public.pgr_acoes;
CREATE TRIGGER trg_pgr_acao_touch AFTER INSERT OR UPDATE OR DELETE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_touch_doc();
DROP TRIGGER IF EXISTS trg_pgr_evid_touch ON public.pgr_acao_evidencias;
CREATE TRIGGER trg_pgr_evid_touch AFTER INSERT OR UPDATE OR DELETE ON public.pgr_acao_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_touch_doc();

-- 4) Tabela: pgr_pdf_versoes
CREATE TABLE IF NOT EXISTS public.pgr_pdf_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  pgr_versao int NOT NULL,
  pdf_versao int NOT NULL,
  pdf_hash text NOT NULL,
  drive_file_id text NOT NULL,
  drive_view_link text,
  drive_path text,
  nome_arquivo text,
  tamanho_bytes bigint,
  status_no_momento public.pgr_status NOT NULL,
  com_marca_dagua boolean NOT NULL DEFAULT false,
  gerado_por uuid REFERENCES auth.users(id),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pgr_id, pdf_versao)
);
GRANT SELECT, INSERT ON public.pgr_pdf_versoes TO authenticated;
GRANT ALL ON public.pgr_pdf_versoes TO service_role;
ALTER TABLE public.pgr_pdf_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_pdfv_select ON public.pgr_pdf_versoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_pdfv_insert ON public.pgr_pdf_versoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
-- Append-only
CREATE OR REPLACE FUNCTION public.pgr_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'pgr_pdf_versoes é append-only'; END;$$;
CREATE TRIGGER trg_pgr_pdfv_block_upd BEFORE UPDATE ON public.pgr_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_pdfv_block_mutations();
CREATE TRIGGER trg_pgr_pdfv_block_del BEFORE DELETE ON public.pgr_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_pdfv_block_mutations();
CREATE INDEX IF NOT EXISTS idx_pgr_pdfv_pgr ON public.pgr_pdf_versoes (pgr_id, pdf_versao DESC);

-- 5) RPC: registrar PDF gerado
CREATE OR REPLACE FUNCTION public.pgr_pdf_registrar(
  _pgr_id uuid,
  _drive_file_id text,
  _drive_view_link text,
  _drive_path text,
  _nome_arquivo text,
  _tamanho_bytes bigint,
  _pdf_hash text,
  _com_marca_dagua boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc public.pgr_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _next int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _pdf_hash IS NULL OR length(_pdf_hash) <> 64 THEN RAISE EXCEPTION 'Hash SHA-256 inválido (64 hex)'; END IF;
  IF _drive_file_id IS NULL OR length(_drive_file_id) < 5 THEN RAISE EXCEPTION 'drive_file_id inválido'; END IF;

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
        AND (modulos_permitidos @> ARRAY['pgr:exportar']
             OR modulos_permitidos @> ARRAY['pgr:editar']
             OR modulos_permitidos @> ARRAY['pgr:revisar']
             OR modulos_permitidos @> ARRAY['pgr'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão pgr:exportar requerida'; END IF;
  END IF;

  IF _doc.status IN ('substituido','arquivado') THEN
    RAISE EXCEPTION 'PGR % — não é permitido gerar nova versão de PDF', _doc.status;
  END IF;

  SELECT COALESCE(MAX(pdf_versao),0)+1 INTO _next
    FROM public.pgr_pdf_versoes WHERE pgr_id = _pgr_id;

  INSERT INTO public.pgr_pdf_versoes(
    pgr_id, empresa_id, pgr_versao, pdf_versao, pdf_hash,
    drive_file_id, drive_view_link, drive_path, nome_arquivo, tamanho_bytes,
    status_no_momento, com_marca_dagua, gerado_por
  ) VALUES (
    _pgr_id, _doc.empresa_id, _doc.versao, _next, _pdf_hash,
    _drive_file_id, _drive_view_link, _drive_path, _nome_arquivo, _tamanho_bytes,
    _doc.status, COALESCE(_com_marca_dagua, false), auth.uid()
  );

  UPDATE public.pgr_documentos
     SET pdf_hash = _pdf_hash,
         pdf_drive_view_link = _drive_view_link,
         pdf_gerado_em = now()
   WHERE id = _pgr_id;

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_pgr_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, _doc.status, 'pdf_gerado',
    'PDF v' || _next || ' (hash ' || left(_pdf_hash,12) || '…)' ||
      CASE WHEN _com_marca_dagua THEN ' [RASCUNHO]' ELSE '' END,
    auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object('success', true, 'pdf_versao', _next, 'hash', _pdf_hash);
END;$$;
REVOKE EXECUTE ON FUNCTION public.pgr_pdf_registrar(uuid,text,text,text,text,bigint,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_pdf_registrar(uuid,text,text,text,text,bigint,text,boolean) TO authenticated, service_role;

-- 6) RPC: assinar visualmente o PGR
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

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'Assinatura visual só permitida em PGR rascunho/em revisão';
  END IF;

  -- MFA obrigatório
  _mfa := public.mfa_required_for_current_user();
  IF (_mfa ->> 'required')::boolean = true AND _aal <> 'aal2' THEN
    RAISE EXCEPTION 'MFA (AAL2) requerido para assinar';
  END IF;

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
    _pgr_id, _doc.empresa_id, auth.uid(), btrim(_responsavel_nome), NULLIF(btrim(COALESCE(_responsavel_registro,'')),''),
    _pdf_hash, _ultima.pdf_versao, _ip_origem, true,
    NULLIF(_observacao,'')
  );

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova,
    status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_pgr_id, _doc.empresa_id, _doc.versao, _doc.versao,
    _doc.status, _doc.status, 'assinatura_visual',
    'Assinatura visual por ' || _responsavel_nome || ' (PDF v' || _ultima.pdf_versao || ')',
    auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object('success', true, 'pdf_versao', _ultima.pdf_versao);
END;$$;
REVOKE EXECUTE ON FUNCTION public.pgr_assinar_visual(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_assinar_visual(uuid,text,text,text,text,text) TO authenticated, service_role;

-- 7) Atualiza pgr_publicar: exige PDF final atualizado (sem marca d'água e gerado após última alteração de conteúdo)
CREATE OR REPLACE FUNCTION public.pgr_publicar(_pgr_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc public.pgr_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false; _ant_id uuid;
  _ultima public.pgr_pdf_versoes%ROWTYPE;
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

  -- Exige PDF final atualizado
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

-- 8) RPC pública (autenticada) de validação interna do PDF/QR
CREATE OR REPLACE FUNCTION public.pgr_validar_interno(_pgr_id uuid, _pdf_versao int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc public.pgr_documentos%ROWTYPE;
  _v   public.pgr_pdf_versoes%ROWTYPE;
  _ultima public.pgr_pdf_versoes%ROWTYPE;
  _emp_nome text; _unidade_nome text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _doc FROM public.pgr_documentos WHERE id = _pgr_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _doc.empresa_id)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT nome INTO _emp_nome FROM public.empresa_config WHERE id = _doc.empresa_id;
  IF _doc.unidade_id IS NOT NULL THEN
    SELECT nome INTO _unidade_nome FROM public.empresa_config WHERE id = _doc.unidade_id;
  END IF;

  SELECT * INTO _ultima FROM public.pgr_pdf_versoes
   WHERE pgr_id = _pgr_id ORDER BY pdf_versao DESC LIMIT 1;

  IF _pdf_versao IS NOT NULL THEN
    SELECT * INTO _v FROM public.pgr_pdf_versoes
     WHERE pgr_id = _pgr_id AND pdf_versao = _pdf_versao;
  ELSE
    _v := _ultima;
  END IF;

  RETURN jsonb_build_object(
    'pgr_id', _doc.id,
    'empresa_nome', _emp_nome,
    'unidade_nome', _unidade_nome,
    'versao', _doc.versao,
    'status', _doc.status,
    'data_vigencia_inicio', _doc.data_vigencia_inicio,
    'data_vigencia_fim', _doc.data_vigencia_fim,
    'resp_tec_nome', _doc.resp_tec_nome,
    'resp_tec_registro', _doc.resp_tec_registro,
    'conteudo_atualizado_em', _doc.conteudo_atualizado_em,
    'pdf', CASE WHEN _v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'pdf_versao', _v.pdf_versao,
      'pdf_hash', _v.pdf_hash,
      'gerado_em', _v.gerado_em,
      'com_marca_dagua', _v.com_marca_dagua,
      'status_no_momento', _v.status_no_momento,
      'drive_view_link', _v.drive_view_link
    ) END,
    'pdf_desatualizado', COALESCE(_ultima.gerado_em < _doc.conteudo_atualizado_em, true),
    'eh_versao_vigente', (_doc.status = 'vigente'),
    'eh_ultima_pdf', COALESCE(_v.id = _ultima.id, false)
  );
END;$$;
REVOKE EXECUTE ON FUNCTION public.pgr_validar_interno(uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_validar_interno(uuid,int) TO authenticated, service_role;
