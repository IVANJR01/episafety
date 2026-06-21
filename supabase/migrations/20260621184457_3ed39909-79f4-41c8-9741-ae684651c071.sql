
-- ============================================================
-- eSocial S-2240 — Parte 3: RPCs server-side (audit/ocorrência/xml meta)
-- Sem XML completo no audit_log. Sem envio real. Sem ICP-Brasil.
-- ============================================================

-- Verificação central de tenant para o evento (reutilizável)
CREATE OR REPLACE FUNCTION public.s2240_assert_tenant(_evento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.esocial_eventos_s2240 WHERE id = _evento_id;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Evento S-2240 não encontrado';
  END IF;
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), v_emp)
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao evento S-2240 (outro tenant)';
  END IF;
  RETURN v_emp;
END;$$;

REVOKE ALL ON FUNCTION public.s2240_assert_tenant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.s2240_assert_tenant(uuid) TO authenticated;

-- ----------------------------------------------------------------
-- RPC: registrar ocorrência (append-only, sem XML completo)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.s2240_registrar_ocorrencia(
  _evento_id uuid,
  _tipo public.esocial_s2240_ocorrencia_tipo,
  _resultado public.esocial_s2240_ocorrencia_resultado,
  _mensagens jsonb DEFAULT '[]'::jsonb,
  _xml_sha256 text DEFAULT NULL,
  _erro_resumido text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_id uuid;
  v_msg jsonb;
BEGIN
  v_emp := public.s2240_assert_tenant(_evento_id);

  -- normaliza para jsonb array e remove campos potencialmente grandes
  v_msg := COALESCE(_mensagens, '[]'::jsonb);
  IF jsonb_typeof(v_msg) <> 'array' THEN
    v_msg := jsonb_build_array(v_msg);
  END IF;

  INSERT INTO public.esocial_s2240_ocorrencias(
    evento_id, empresa_id, tipo, resultado, mensagens, xml_sha256, erro_resumido, user_id
  ) VALUES (
    _evento_id, v_emp, _tipo, _resultado, v_msg, _xml_sha256,
    NULLIF(LEFT(COALESCE(_erro_resumido,''), 500), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;$$;

REVOKE ALL ON FUNCTION public.s2240_registrar_ocorrencia(uuid, public.esocial_s2240_ocorrencia_tipo, public.esocial_s2240_ocorrencia_resultado, jsonb, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.s2240_registrar_ocorrencia(uuid, public.esocial_s2240_ocorrencia_tipo, public.esocial_s2240_ocorrencia_resultado, jsonb, text, text) TO authenticated;

-- ----------------------------------------------------------------
-- RPC: registrar audit log do S-2240 (sem XML completo)
-- Campos aceitos no _metadados: { resumo, agentes_total, pendencias_t24,
--    erros, alertas, drive_id, drive_link, versao_layout, periodo_id, ... }
-- Quaisquer campos serão truncados/sanitizados.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.s2240_registrar_audit(
  _action text,
  _evento_id uuid,
  _ppp_id uuid DEFAULT NULL,
  _funcionario_id uuid DEFAULT NULL,
  _hash text DEFAULT NULL,
  _status public.esocial_s2240_status DEFAULT NULL,
  _metadados jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_id uuid;
  v_meta jsonb;
  v_email text;
BEGIN
  v_emp := public.s2240_assert_tenant(_evento_id);

  -- sanitiza metadados (proibido carregar XML completo)
  v_meta := COALESCE(_metadados, '{}'::jsonb)
    - 'xml' - 'xml_completo' - 'xml_raw' - 'payload' - 'body';

  -- adiciona campos resumidos
  v_meta := v_meta
    || jsonb_build_object(
      'status', _status::text,
      'hash_sha256', _hash,
      'evento_id', _evento_id,
      'ppp_id', _ppp_id,
      'funcionario_id', _funcionario_id
    );

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log(
    user_id, user_email, action, entity_type, entity_id, empresa_id, new_data
  ) VALUES (
    auth.uid(), v_email,
    'S2240:' || COALESCE(_action,'acao'),
    'esocial_eventos_s2240',
    _evento_id::text,
    v_emp,
    v_meta
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;$$;

REVOKE ALL ON FUNCTION public.s2240_registrar_audit(text, uuid, uuid, uuid, text, public.esocial_s2240_status, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.s2240_registrar_audit(text, uuid, uuid, uuid, text, public.esocial_s2240_status, jsonb) TO authenticated;

-- ----------------------------------------------------------------
-- RPC: registrar metadados do XML técnico/stub no evento.
-- Banco guarda hash, bytes, drive_id, drive_link, gerado_em, gerado_por.
-- Não recebe o XML completo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.s2240_registrar_xml_meta(
  _evento_id uuid,
  _xml_sha256 text,
  _tamanho_bytes integer,
  _drive_id text,
  _drive_link text,
  _status public.esocial_s2240_status DEFAULT 'validado_stub'::public.esocial_s2240_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
BEGIN
  v_emp := public.s2240_assert_tenant(_evento_id);

  IF _xml_sha256 IS NULL OR length(_xml_sha256) < 32 THEN
    RAISE EXCEPTION 'Hash SHA-256 obrigatório';
  END IF;

  UPDATE public.esocial_eventos_s2240
  SET
    xml_sha256 = _xml_sha256,
    xml_tamanho_bytes = COALESCE(_tamanho_bytes, 0),
    xml_drive_id = _drive_id,
    xml_drive_link = _drive_link,
    xml_gerado_em = now(),
    xml_gerado_por = auth.uid(),
    status = _status,
    updated_at = now()
  WHERE id = _evento_id;
END;$$;

REVOKE ALL ON FUNCTION public.s2240_registrar_xml_meta(uuid, text, integer, text, text, public.esocial_s2240_status) FROM public;
GRANT EXECUTE ON FUNCTION public.s2240_registrar_xml_meta(uuid, text, integer, text, text, public.esocial_s2240_status) TO authenticated;
