-- P0 #6: RPC server-side para audit log de mapeamentos S-2240 (substitui insert direto do cliente)
CREATE OR REPLACE FUNCTION public.s2240_registrar_mapeamento_audit(
  _empresa_id uuid,
  _agente text,
  _codigo_t24 text,
  _status text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _empresa_id IS NULL THEN RAISE EXCEPTION 'empresa_id obrigatório'; END IF;
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), _empresa_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para auditar mapeamentos desta empresa';
  END IF;
  INSERT INTO public.audit_log(empresa_id, tabela, acao, dados_novos, user_id)
  VALUES (
    _empresa_id,
    'esocial_s2240_mapeamentos',
    'upsert',
    jsonb_build_object(
      'agente', _agente,
      'codigo_t24', _codigo_t24,
      'status', _status
    ),
    auth.uid()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.s2240_registrar_mapeamento_audit(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.s2240_registrar_mapeamento_audit(uuid,text,text,text) TO authenticated;

-- P0 #7: S-2210 — XML completo nunca mais no banco. Apenas metadados + Drive BYOK.
ALTER TABLE public.esocial_eventos_s2210
  ADD COLUMN IF NOT EXISTS xml_drive_id text,
  ADD COLUMN IF NOT EXISTS xml_drive_link text,
  ADD COLUMN IF NOT EXISTS xml_tamanho_bytes integer,
  ADD COLUMN IF NOT EXISTS xml_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS xml_gerado_por uuid;

-- Wipe qualquer XML antigo persistido
UPDATE public.esocial_eventos_s2210
   SET xml_tamanho_bytes = COALESCE(xml_tamanho_bytes, length(xml_gerado)),
       xml_gerado = NULL,
       xml_assinado_simulado = NULL
 WHERE xml_gerado IS NOT NULL OR xml_assinado_simulado IS NOT NULL;

-- Redige histórico que ainda contenha xml inline
UPDATE public.esocial_eventos_historico
   SET metadados = COALESCE(metadados, '{}'::jsonb)
                   - 'xml_gerado' - 'xml_assinado_simulado'
                   || jsonb_build_object('xml_redacted', true)
 WHERE metadados ? 'xml_gerado' OR metadados ? 'xml_assinado_simulado';

-- Remove triggers/funções dependentes para poder dropar as colunas
DROP FUNCTION IF EXISTS public.esocial_registrar_xml(uuid, text, text, text);

ALTER TABLE public.esocial_eventos_s2210 DROP COLUMN IF EXISTS xml_gerado;
ALTER TABLE public.esocial_eventos_s2210 DROP COLUMN IF EXISTS xml_assinado_simulado;

-- Novo RPC: registra apenas metadados + referência ao Drive
CREATE OR REPLACE FUNCTION public.esocial_registrar_xml_meta(
  _evento_id uuid,
  _hash text,
  _versao_layout text,
  _tamanho_bytes integer,
  _drive_file_id text,
  _drive_link text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _evt RECORD; _cat RECORD;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _novo_status public.esocial_evento_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _hash IS NULL OR length(_hash) <> 64 THEN RAISE EXCEPTION 'Hash SHA-256 inválido (64 hex)'; END IF;
  IF _drive_file_id IS NULL OR length(_drive_file_id) < 5 THEN RAISE EXCEPTION 'drive_file_id obrigatório'; END IF;
  IF _tamanho_bytes IS NULL OR _tamanho_bytes < 50 THEN RAISE EXCEPTION 'tamanho_bytes inválido'; END IF;

  SELECT * INTO _evt FROM public.esocial_eventos_s2210 WHERE id = _evento_id;
  IF _evt.id IS NULL THEN RAISE EXCEPTION 'Evento eSocial não encontrado'; END IF;
  SELECT id, empresa_id, status INTO _cat FROM public.cat_comunicacoes WHERE id = _evt.cat_id;
  IF _cat.id IS NULL THEN RAISE EXCEPTION 'CAT vinculada inexistente'; END IF;
  IF _cat.empresa_id IS DISTINCT FROM _evt.empresa_id THEN RAISE EXCEPTION 'Inconsistência de empresa entre CAT e evento'; END IF;
  IF _cat.status = 'cancelada' THEN RAISE EXCEPTION 'CAT cancelada — XML bloqueado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _evt.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para gerar XML desta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['cat:esocial'] OR modulos_permitidos @> ARRAY['cat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão cat:esocial requerida'; END IF;
  END IF;

  IF _evt.status IN ('aceito') THEN RAISE EXCEPTION 'Evento já aceito — gere retificação'; END IF;
  IF _evt.status = 'excluido' THEN RAISE EXCEPTION 'Evento marcado para exclusão'; END IF;

  _novo_status := CASE _evt.tp_amb::text
    WHEN 'producao' THEN 'homologacao_stub'::public.esocial_evento_status
    ELSE 'validado_stub'::public.esocial_evento_status
  END;

  UPDATE public.esocial_eventos_s2210
     SET xml_hash_sha256 = _hash,
         versao_layout = COALESCE(_versao_layout, versao_layout),
         xml_drive_id = _drive_file_id,
         xml_drive_link = _drive_link,
         xml_tamanho_bytes = _tamanho_bytes,
         xml_gerado_em = now(),
         xml_gerado_por = auth.uid(),
         dh_processamento = now(),
         assinatura_simulada = false,
         status = _novo_status,
         ultimo_erro_resumo = NULL,
         updated_at = now()
   WHERE id = _evento_id;

  RETURN jsonb_build_object(
    'success', true, 'evento_id', _evento_id, 'status', _novo_status,
    'hash', _hash, 'drive_file_id', _drive_file_id, 'tamanho_bytes', _tamanho_bytes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.esocial_registrar_xml_meta(uuid,text,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esocial_registrar_xml_meta(uuid,text,text,integer,text,text) TO authenticated;

-- Ajusta esocial_registrar_download para não referenciar mais xml_gerado
CREATE OR REPLACE FUNCTION public.esocial_registrar_download(_evento_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _evt RECORD; _email text := lower(COALESCE(auth.jwt() ->> 'email','')); _has_perm boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _evt FROM public.esocial_eventos_s2210 WHERE id = _evento_id;
  IF _evt.id IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _evt.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['cat:esocial'] OR modulos_permitidos @> ARRAY['cat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão cat:esocial requerida'; END IF;
  END IF;
  INSERT INTO public.esocial_eventos_historico(
    evento_id, empresa_id, acao, status_anterior, status_novo,
    xml_hash_sha256, metadados, user_id, user_email
  ) VALUES (
    _evt.id, _evt.empresa_id, 'consulta_simulada'::public.esocial_acao_hist,
    _evt.status, _evt.status, _evt.xml_hash_sha256,
    jsonb_build_object(
      'acao','download_xml',
      'tamanho_bytes', COALESCE(_evt.xml_tamanho_bytes,0),
      'drive_file_id', _evt.xml_drive_id
    ),
    auth.uid(), NULLIF(_email,'')
  );
END;
$$;

-- P0 #5: aso_medicos — remove exposição global (empresa_id IS NULL) para não-super-admin
DROP POLICY IF EXISTS aso_medicos_isolation_select ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_isolation_write ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_empresa_update ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_empresa_delete ON public.aso_medicos;

CREATE POLICY aso_medicos_isolation_select ON public.aso_medicos
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.is_in_user_company_tree(auth.uid(), empresa_id))
  );

CREATE POLICY aso_medicos_isolation_insert ON public.aso_medicos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.is_in_user_company_tree(auth.uid(), empresa_id))
  );

CREATE POLICY aso_medicos_isolation_update ON public.aso_medicos
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.is_in_user_company_tree(auth.uid(), empresa_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.is_in_user_company_tree(auth.uid(), empresa_id))
  );

CREATE POLICY aso_medicos_isolation_delete ON public.aso_medicos
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (empresa_id IS NOT NULL AND public.is_in_user_company_tree(auth.uid(), empresa_id))
  );