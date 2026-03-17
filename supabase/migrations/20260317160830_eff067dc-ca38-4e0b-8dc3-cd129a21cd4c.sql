
CREATE OR REPLACE FUNCTION public.get_consolidated_epi_stock()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  _user_empresa_id uuid;
  _has_gestao boolean;
BEGIN
  -- Allow super_admin OR principal OR users with epis:gestao_estoque permission
  IF NOT is_super_admin(auth.uid()) THEN
    -- Check if user is principal
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      -- Check if user has epis:gestao_estoque permission
      SELECT EXISTS (
        SELECT 1 FROM usuarios_liberados
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (
          modulos_permitidos @> ARRAY['epis:gestao_estoque']
          OR modulos_permitidos @> ARRAY['epis']
        )
      ) INTO _has_gestao;

      IF NOT _has_gestao THEN
        RETURN '[]'::jsonb;
      END IF;
    END IF;
    -- Non-super-admin: only show their own company tree
    _user_empresa_id := get_user_empresa_id(auth.uid());
  END IF;

  SELECT jsonb_agg(parent_row)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'empresa_id', parent.id,
      'empresa_nome', parent.nome,
      'filiais', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'empresa_id', filial.id,
          'empresa_nome', filial.nome,
          'total_itens', COALESCE(es.total_itens, 0),
          'estoque_total', COALESCE(es.estoque_total, 0),
          'valor_total', COALESCE(es.valor_total, 0),
          'itens_baixo_estoque', COALESCE(es.itens_baixo_estoque, 0),
          'consumo_medio_mensal', COALESCE(cs.media_mensal, 0),
          'custo_medio_mensal', COALESCE(cs.custo_medio_mensal, 0)
        ) ORDER BY filial.nome)
        FROM empresa_config filial
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as total_itens,
            COALESCE(SUM(e.estoque), 0) as estoque_total,
            COALESCE(SUM(e.estoque * COALESCE(e.valor, 0)), 0) as valor_total,
            COUNT(*) FILTER (WHERE e.estoque <= e.estoque_minimo) as itens_baixo_estoque
          FROM epis e WHERE e.empresa_id = filial.id
        ) es ON true
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(ROUND(COUNT(*)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 1), 0) as media_mensal,
            COALESCE(ROUND(SUM(COALESCE(ep.valor, 0) * ent.quantidade)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 2), 0) as custo_medio_mensal
          FROM entregas ent
          JOIN epis ep ON ep.id = ent.epi_id
          WHERE ent.empresa_id = filial.id
            AND ent.tipo IN ('entrega', 'substituicao')
            AND ent.data >= (CURRENT_DATE - interval '12 months')
        ) cs ON true
        WHERE filial.empresa_pai_id = parent.id
      ), '[]'::jsonb)
    ) as parent_row
    FROM empresa_config parent
    WHERE parent.empresa_pai_id IS NULL
      AND (_user_empresa_id IS NULL OR parent.id = _user_empresa_id)
    ORDER BY parent.nome
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

-- Also update get_filial_epis to allow gestao_estoque users
CREATE OR REPLACE FUNCTION public.get_filial_epis(_filial_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  _user_empresa_id uuid;
  _has_gestao boolean;
BEGIN
  -- Must be super_admin, principal, or have epis:gestao_estoque
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      SELECT EXISTS (
        SELECT 1 FROM usuarios_liberados
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (
          modulos_permitidos @> ARRAY['epis:gestao_estoque']
          OR modulos_permitidos @> ARRAY['epis']
        )
      ) INTO _has_gestao;

      IF NOT _has_gestao THEN
        RETURN '[]'::jsonb;
      END IF;
    END IF;
    -- Verify the filial belongs to the user's company
    _user_empresa_id := get_user_empresa_id(auth.uid());
    IF NOT EXISTS (
      SELECT 1 FROM empresa_config
      WHERE id = _filial_id AND (empresa_pai_id = _user_empresa_id OR id = _user_empresa_id)
    ) THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'nome', e.nome,
    'ca', e.ca,
    'categoria', e.categoria,
    'estoque', e.estoque,
    'estoque_minimo', e.estoque_minimo,
    'valor', e.valor
  ) ORDER BY e.nome), '[]'::jsonb)
  INTO result
  FROM epis e
  WHERE e.empresa_id = _filial_id;

  RETURN result;
END;
$function$;

-- Also update transfer_epi_stock to allow gestao_estoque users
CREATE OR REPLACE FUNCTION public.transfer_epi_stock(_source_empresa_id uuid, _dest_empresa_id uuid, _source_epi_id uuid, _quantidade integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_empresa_id uuid;
  _source_epi RECORD;
  _dest_epi_id uuid;
  _has_gestao boolean;
BEGIN
  IF _quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;

  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      SELECT EXISTS (
        SELECT 1 FROM usuarios_liberados
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (
          modulos_permitidos @> ARRAY['epis:gestao_estoque']
          OR modulos_permitidos @> ARRAY['epis']
        )
      ) INTO _has_gestao;

      IF NOT _has_gestao THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
      END IF;
    END IF;
    _user_empresa_id := get_user_empresa_id(auth.uid());
    IF NOT EXISTS (
      SELECT 1 FROM empresa_config
      WHERE id = _source_empresa_id AND (empresa_pai_id = _user_empresa_id OR id = _user_empresa_id)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unidade de origem inválida');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM empresa_config
      WHERE id = _dest_empresa_id AND (empresa_pai_id = _user_empresa_id OR id = _user_empresa_id)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unidade de destino inválida');
    END IF;
  END IF;

  SELECT * INTO _source_epi FROM epis WHERE id = _source_epi_id AND empresa_id = _source_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado na origem');
  END IF;

  IF _source_epi.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_epi.estoque);
  END IF;

  IF _source_epi.ca IS NOT NULL AND _source_epi.ca != '' THEN
    SELECT id INTO _dest_epi_id FROM epis WHERE empresa_id = _dest_empresa_id AND ca = _source_epi.ca LIMIT 1;
  END IF;
  IF _dest_epi_id IS NULL THEN
    SELECT id INTO _dest_epi_id FROM epis WHERE empresa_id = _dest_empresa_id AND nome = _source_epi.nome LIMIT 1;
  END IF;

  IF _dest_epi_id IS NULL THEN
    INSERT INTO epis (nome, ca, categoria, descricao, fabricante, aprovado_para, validade, estoque, estoque_minimo, valor, empresa_id, created_by)
    VALUES (_source_epi.nome, _source_epi.ca, _source_epi.categoria, _source_epi.descricao, _source_epi.fabricante, _source_epi.aprovado_para, _source_epi.validade, 0, _source_epi.estoque_minimo, _source_epi.valor, _dest_empresa_id, auth.uid())
    RETURNING id INTO _dest_epi_id;
  END IF;

  UPDATE epis SET estoque = estoque - _quantidade WHERE id = _source_epi_id;
  UPDATE epis SET estoque = estoque + _quantidade WHERE id = _dest_epi_id;

  RETURN jsonb_build_object('success', true, 'message', 'Transferência realizada com sucesso');
END;
$function$;
