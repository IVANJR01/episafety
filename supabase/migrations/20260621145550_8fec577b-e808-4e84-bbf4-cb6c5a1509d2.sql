
-- LTCAT Parte 2: ajustes de hardening + vínculo com PGR
-- 1) Revogar EXECUTE de PUBLIC nas trigger functions SECURITY DEFINER do LTCAT
--    (mantêm-se internas — chamadas pelo executor de trigger, não por usuários).
REVOKE EXECUTE ON FUNCTION public.ltcat_doc_immutable_empresa() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_doc_touch_content()    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_child_guard()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_child_touch_doc()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_revisoes_block_mutations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_assin_block_mutations()    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_pdfv_block_mutations()     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_audit_trg()                FROM PUBLIC, anon;

-- Confirma revoke de anon nas RPCs (idempotente)
REVOKE EXECUTE ON FUNCTION public.ltcat_abrir_revisao(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ltcat_publicar(uuid)            FROM PUBLIC, anon;

-- 2) Vínculo opcional com PGR (mesma empresa)
ALTER TABLE public.ltcat_documentos
  ADD COLUMN IF NOT EXISTS pgr_id uuid
    REFERENCES public.pgr_documentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ltcat_doc_pgr ON public.ltcat_documentos(pgr_id);

-- Trigger garante que o PGR vinculado seja da mesma empresa
CREATE OR REPLACE FUNCTION public.ltcat_validate_pgr_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid;
BEGIN
  IF NEW.pgr_id IS NULL THEN RETURN NEW; END IF;
  SELECT empresa_id INTO _emp FROM public.pgr_documentos WHERE id = NEW.pgr_id;
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'PGR vinculado não encontrado';
  END IF;
  IF _emp <> NEW.empresa_id THEN
    RAISE EXCEPTION 'PGR vinculado pertence a outra empresa';
  END IF;
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_validate_pgr_empresa() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_ltcat_doc_validate_pgr ON public.ltcat_documentos;
CREATE TRIGGER trg_ltcat_doc_validate_pgr
  BEFORE INSERT OR UPDATE OF pgr_id, empresa_id ON public.ltcat_documentos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_validate_pgr_empresa();

-- 3) Atualização da revisão: copiar pgr_id também
CREATE OR REPLACE FUNCTION public.ltcat_abrir_revisao(_ltcat_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _nova_id uuid;
  _nova_versao integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo da revisão é obrigatório (mín. 5 caracteres)';
  END IF;

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
        AND (modulos_permitidos @> ARRAY['ltcat:revisar'] OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:revisar requerida'; END IF;
  END IF;

  IF _doc.status <> 'vigente' THEN
    RAISE EXCEPTION 'Apenas LTCAT vigente pode iniciar nova revisão (status atual: %)', _doc.status;
  END IF;

  SELECT COALESCE(MAX(versao),0)+1 INTO _nova_versao
    FROM public.ltcat_documentos
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id;

  INSERT INTO public.ltcat_documentos(
    empresa_id, unidade_id, pgr_id, versao, versao_pai_id, status, motivo_emissao,
    cnae, grau_risco, escopo, metodologia_geral, observacoes,
    data_vigencia_inicio, data_vigencia_fim, created_by, updated_by
  ) VALUES (
    _doc.empresa_id, _doc.unidade_id, _doc.pgr_id, _nova_versao, _doc.id, 'em_revisao'::public.ltcat_status,
    'revisao_periodica'::public.ltcat_motivo_emissao,
    _doc.cnae, _doc.grau_risco, _doc.escopo, _doc.metodologia_geral, _doc.observacoes,
    _doc.data_vigencia_inicio, _doc.data_vigencia_fim, auth.uid(), auth.uid()
  ) RETURNING id INTO _nova_id;

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova, motivo,
    status_anterior, status_novo, user_id, user_email
  ) VALUES (
    _nova_id, _doc.empresa_id, _doc.versao, _nova_versao, _motivo,
    _doc.status, 'em_revisao'::public.ltcat_status, auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'novo_ltcat_id', _nova_id, 'versao', _nova_versao);
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_abrir_revisao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_abrir_revisao(uuid, text) TO authenticated;
