
-- ============================================================
-- PARTE 4 — Validação local S-2210 + segurança do XML
-- ============================================================

-- 1) AUDIT LOG: jamais gravar XML completo
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _empresa_id uuid;
  _entity_id text;
  _user_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
  _old jsonb;
  _new jsonb;
  _sensitive text[] := ARRAY['xml_gerado','xml_assinado_simulado'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'esocial_eventos_s2210' THEN
      _old := _old
        - 'xml_gerado' - 'xml_assinado_simulado'
        || jsonb_build_object(
          'xml_redacted', true,
          'xml_size', COALESCE(length(_old->>'xml_gerado'),0),
          'xml_hash', _old->>'xml_hash_sha256'
        );
    END IF;
    BEGIN _empresa_id := (_old ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (_old ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, old_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, _old);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'esocial_eventos_s2210' THEN
      _old := _old - 'xml_gerado' - 'xml_assinado_simulado'
        || jsonb_build_object('xml_redacted', true, 'xml_size', COALESCE(length(_old->>'xml_gerado'),0), 'xml_hash', _old->>'xml_hash_sha256');
      _new := _new - 'xml_gerado' - 'xml_assinado_simulado'
        || jsonb_build_object('xml_redacted', true, 'xml_size', COALESCE(length(_new->>'xml_gerado'),0), 'xml_hash', _new->>'xml_hash_sha256');
    END IF;
    BEGIN _empresa_id := (_new ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (_new ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, old_data, new_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, _old, _new);
    RETURN NEW;
  ELSE -- INSERT
    _new := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'esocial_eventos_s2210' THEN
      _new := _new - 'xml_gerado' - 'xml_assinado_simulado'
        || jsonb_build_object('xml_redacted', true, 'xml_size', COALESCE(length(_new->>'xml_gerado'),0), 'xml_hash', _new->>'xml_hash_sha256');
    END IF;
    BEGIN _empresa_id := (_new ->> 'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN _empresa_id := NULL; END;
    _entity_id := (_new ->> 'id');
    INSERT INTO public.audit_log (user_id, user_email, action, entity_type, entity_id, empresa_id, new_data)
    VALUES (auth.uid(), NULLIF(_user_email, ''), TG_OP, TG_TABLE_NAME, _entity_id, _empresa_id, _new);
    RETURN NEW;
  END IF;
END;
$$;

-- 2) Catálogos: codigo_esocial (mapeamento oficial)
ALTER TABLE public.cat_partes_atingidas    ADD COLUMN IF NOT EXISTS codigo_esocial text;
ALTER TABLE public.cat_agentes_causadores  ADD COLUMN IF NOT EXISTS codigo_esocial text;
ALTER TABLE public.cat_naturezas_lesao     ADD COLUMN IF NOT EXISTS codigo_esocial text;
ALTER TABLE public.cat_situacoes_geradoras ADD COLUMN IF NOT EXISTS codigo_esocial text;

-- 3) Eventos S-2210: retificação encadeada + campos antes fixos
ALTER TABLE public.esocial_eventos_s2210
  ADD COLUMN IF NOT EXISTS evento_origem_id uuid REFERENCES public.esocial_eventos_s2210(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hrs_trab_antes_acid smallint,
  ADD COLUMN IF NOT EXISTS iniciat_cat smallint,
  ADD COLUMN IF NOT EXISTS ultima_validacao_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_esocial_evt_origem ON public.esocial_eventos_s2210(evento_origem_id);

-- 4) CAT: campos antes fixos no XML
ALTER TABLE public.cat_comunicacoes
  ADD COLUMN IF NOT EXISTS hrs_trab_antes_acid smallint,
  ADD COLUMN IF NOT EXISTS iniciat_cat smallint;

COMMENT ON COLUMN public.cat_comunicacoes.iniciat_cat IS
  'Iniciativa CAT (eSocial Tabela 10): 1 empregador, 2 ordem judicial, 3 determinação órgão fiscalizador';
COMMENT ON COLUMN public.cat_comunicacoes.hrs_trab_antes_acid IS
  'Horas trabalhadas antes do acidente (HHMM como inteiro). NULL = não informado.';

-- 5) RPC: registrar ocorrências de validação + atualizar status
CREATE OR REPLACE FUNCTION public.esocial_registrar_ocorrencias(
  _evento_id uuid,
  _ocorrencias jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _evt RECORD;
  _cat RECORD;
  _has_perm boolean := false;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _item jsonb;
  _tem_erro boolean := false;
  _total_erros int := 0;
  _total_alertas int := 0;
  _novo_status public.esocial_evento_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _evt FROM public.esocial_eventos_s2210 WHERE id = _evento_id;
  IF _evt.id IS NULL THEN RAISE EXCEPTION 'Evento eSocial não encontrado'; END IF;

  SELECT id, empresa_id, status INTO _cat FROM public.cat_comunicacoes WHERE id = _evt.cat_id;
  IF _cat.id IS NULL OR _cat.empresa_id IS DISTINCT FROM _evt.empresa_id THEN
    RAISE EXCEPTION 'Inconsistência empresa/CAT';
  END IF;
  IF _cat.status = 'cancelada' THEN
    RAISE EXCEPTION 'CAT cancelada — validação bloqueada';
  END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _evt.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['cat:esocial'] OR modulos_permitidos @> ARRAY['cat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão cat:esocial requerida'; END IF;
  END IF;

  IF _evt.status IN ('aceito','excluido') THEN
    RAISE EXCEPTION 'Evento % — validação bloqueada', _evt.status;
  END IF;

  -- limpa ocorrências anteriores (revalidação)
  DELETE FROM public.esocial_retorno_ocorrencias WHERE evento_id = _evento_id;

  IF jsonb_typeof(_ocorrencias) = 'array' THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_ocorrencias) LOOP
      INSERT INTO public.esocial_retorno_ocorrencias(
        evento_id, empresa_id, tipo, codigo, descricao, localizacao, origem
      ) VALUES (
        _evento_id,
        _evt.empresa_id,
        CASE WHEN COALESCE(_item->>'tipo','erro') = 'erro' THEN 1 ELSE 2 END,
        COALESCE(_item->>'codigo','VAL-LOCAL'),
        COALESCE(_item->>'mensagem', _item->>'descricao', ''),
        _item->>'campo',
        COALESCE(_item->>'origem','validacao_local')
      );
      IF (_item->>'tipo') = 'erro' THEN
        _tem_erro := true; _total_erros := _total_erros + 1;
      ELSE
        _total_alertas := _total_alertas + 1;
      END IF;
    END LOOP;
  END IF;

  IF _tem_erro THEN
    _novo_status := 'rejeitado'::public.esocial_evento_status;
  ELSIF _evt.xml_gerado IS NULL OR length(_evt.xml_gerado) < 50 THEN
    _novo_status := 'pendente'::public.esocial_evento_status;
  ELSIF _evt.tp_amb::text = 'producao' THEN
    _novo_status := 'homologacao_stub'::public.esocial_evento_status;
  ELSE
    _novo_status := 'validado_stub'::public.esocial_evento_status;
  END IF;

  UPDATE public.esocial_eventos_s2210
     SET status = _novo_status,
         ultima_validacao_em = now(),
         ultimo_erro_resumo = CASE WHEN _tem_erro
              THEN _total_erros::text || ' erro(s), ' || _total_alertas::text || ' alerta(s)'
              ELSE NULL END,
         updated_at = now()
   WHERE id = _evento_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', _novo_status,
    'total_erros', _total_erros,
    'total_alertas', _total_alertas
  );
END;
$$;

-- 6) RPC: iniciar retificação sem mutar evento aceito
CREATE OR REPLACE FUNCTION public.esocial_iniciar_retificacao(_evento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _orig RECORD;
  _novo_id uuid;
  _has_perm boolean := false;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _orig FROM public.esocial_eventos_s2210 WHERE id = _evento_id;
  IF _orig.id IS NULL THEN RAISE EXCEPTION 'Evento original não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _orig.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['cat:esocial'] OR modulos_permitidos @> ARRAY['cat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão cat:esocial requerida'; END IF;
  END IF;

  IF _orig.status NOT IN ('aceito','validado_stub','homologacao_stub','simulado') THEN
    RAISE EXCEPTION 'Apenas eventos consolidados podem ser retificados';
  END IF;

  INSERT INTO public.esocial_eventos_s2210(
    cat_id, empresa_id, versao_layout, ind_retif, nr_recibo_origem,
    tp_amb, status, evento_origem_id, hrs_trab_antes_acid, iniciat_cat,
    created_by, updated_by
  ) VALUES (
    _orig.cat_id, _orig.empresa_id, _orig.versao_layout,
    'retificacao'::public.esocial_ind_retif,
    COALESCE(_orig.nr_recibo_simulado, _orig.nr_recibo_origem),
    _orig.tp_amb, 'pendente'::public.esocial_evento_status,
    _orig.id, _orig.hrs_trab_antes_acid, _orig.iniciat_cat,
    auth.uid(), auth.uid()
  ) RETURNING id INTO _novo_id;

  -- marca o original como "retificar" (sem alterar XML/hash)
  UPDATE public.esocial_eventos_s2210
     SET status = 'retificar'::public.esocial_evento_status, updated_at = now()
   WHERE id = _orig.id AND status <> 'aceito';

  RETURN jsonb_build_object('success', true, 'novo_evento_id', _novo_id, 'origem_id', _orig.id);
END;
$$;

-- 7) RPC: registrar download do XML (audit em historico, sem XML)
CREATE OR REPLACE FUNCTION public.esocial_registrar_download(_evento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _evt RECORD;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
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
    jsonb_build_object('acao','download_xml','tamanho_bytes', COALESCE(length(_evt.xml_gerado),0)),
    auth.uid(), NULLIF(_email,'')
  );
END;
$$;
