
CREATE OR REPLACE FUNCTION public.esocial_registrar_xml(
  _evento_id uuid,
  _xml text,
  _hash text,
  _versao_layout text DEFAULT '1.3'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _evt RECORD;
  _cat RECORD;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _novo_status public.esocial_evento_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _xml IS NULL OR length(_xml) < 50 THEN
    RAISE EXCEPTION 'XML inválido';
  END IF;
  IF _hash IS NULL OR length(_hash) <> 64 THEN
    RAISE EXCEPTION 'Hash SHA-256 inválido (esperado 64 chars hex)';
  END IF;

  SELECT * INTO _evt FROM public.esocial_eventos_s2210 WHERE id = _evento_id;
  IF _evt.id IS NULL THEN
    RAISE EXCEPTION 'Evento eSocial não encontrado';
  END IF;

  SELECT id, empresa_id, status INTO _cat
  FROM public.cat_comunicacoes WHERE id = _evt.cat_id;
  IF _cat.id IS NULL THEN
    RAISE EXCEPTION 'CAT vinculada inexistente';
  END IF;
  IF _cat.empresa_id IS DISTINCT FROM _evt.empresa_id THEN
    RAISE EXCEPTION 'Inconsistência de empresa entre CAT e evento';
  END IF;
  IF _cat.status = 'cancelada' THEN
    RAISE EXCEPTION 'CAT cancelada — não é possível gerar XML S-2210';
  END IF;

  -- Permissão: super_admin / principal / cat:esocial dentro da árvore da empresa
  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _evt.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para gerar XML desta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email) = _email
        AND ativo = true
        AND (
          modulos_permitidos @> ARRAY['cat:esocial']
          OR modulos_permitidos @> ARRAY['cat']
        )
    ) INTO _has_perm;
    IF NOT _has_perm THEN
      RAISE EXCEPTION 'Permissão cat:esocial requerida';
    END IF;
  END IF;

  -- Bloqueia mutação após aceito (modelo de retificação criará evento novo)
  IF _evt.status IN ('aceito') THEN
    RAISE EXCEPTION 'Evento já aceito — gere um novo evento de retificação';
  END IF;
  IF _evt.status = 'excluido' THEN
    RAISE EXCEPTION 'Evento marcado para exclusão — não pode ser regerado';
  END IF;

  _novo_status := CASE _evt.tp_amb::text
    WHEN 'producao' THEN 'homologacao_stub'::public.esocial_evento_status
    ELSE 'validado_stub'::public.esocial_evento_status
  END;

  UPDATE public.esocial_eventos_s2210
     SET xml_gerado = _xml,
         xml_hash_sha256 = _hash,
         versao_layout = COALESCE(_versao_layout, versao_layout),
         dh_processamento = now(),
         assinatura_simulada = false,
         status = _novo_status,
         ultimo_erro_resumo = NULL,
         updated_at = now()
   WHERE id = _evento_id;

  RETURN jsonb_build_object(
    'success', true,
    'evento_id', _evento_id,
    'status', _novo_status,
    'hash', _hash,
    'tamanho_bytes', length(_xml)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.esocial_registrar_xml(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esocial_registrar_xml(uuid, text, text, text) TO authenticated;
