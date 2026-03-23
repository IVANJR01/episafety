-- Corrige a função de transferência entre matriz e unidade para garantir sincronização real do estoque destino
CREATE OR REPLACE FUNCTION public.transfer_epi_stock(
  _source_empresa_id uuid,
  _dest_empresa_id uuid,
  _source_epi_id uuid,
  _quantidade integer
)
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
  _parent_empresa_id uuid;
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

  SELECT id, nome, ca, categoria, estoque, estoque_minimo, valor, fabricante, descricao, aprovado_para, tamanho
  INTO _source_epi
  FROM epis
  WHERE id = _source_epi_id AND empresa_id = _source_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado na unidade de origem');
  END IF;

  IF _source_epi.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_epi.estoque);
  END IF;

  SELECT id INTO _dest_epi_id
  FROM epis
  WHERE empresa_id = _dest_empresa_id
    AND (
      (ca IS NOT NULL AND ca = _source_epi.ca)
      OR (ca IS NULL AND nome = _source_epi.nome)
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF _dest_epi_id IS NULL THEN
    INSERT INTO epis (
      nome, ca, categoria, estoque, estoque_minimo, valor,
      empresa_id, fabricante, descricao, aprovado_para, tamanho, created_by
    )
    VALUES (
      _source_epi.nome,
      _source_epi.ca,
      _source_epi.categoria,
      0,
      COALESCE(_source_epi.estoque_minimo, 0),
      _source_epi.valor,
      _dest_empresa_id,
      _source_epi.fabricante,
      _source_epi.descricao,
      _source_epi.aprovado_para,
      _source_epi.tamanho,
      auth.uid()
    )
    RETURNING id INTO _dest_epi_id;
  END IF;

  UPDATE epis
  SET estoque = estoque - _quantidade,
      updated_at = now()
  WHERE id = _source_epi_id;

  UPDATE epis
  SET estoque = COALESCE(estoque, 0) + _quantidade,
      updated_at = now()
  WHERE id = _dest_epi_id;

  SELECT COALESCE(empresa_pai_id, id) INTO _parent_empresa_id
  FROM empresa_config
  WHERE id = _source_empresa_id;

  INSERT INTO estoque_movimentacoes (
    empresa_origem_id, empresa_destino_id, epi_id, empresa_id,
    tipo, quantidade, valor_unitario, motivo, created_by
  ) VALUES (
    _source_empresa_id, _dest_empresa_id, _source_epi_id, _parent_empresa_id,
    'transferencia', _quantidade, COALESCE(_source_epi.valor, 0),
    'Transferência Interna entre unidades', auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transferência realizada com sucesso',
    'source_epi_id', _source_epi_id,
    'dest_epi_id', _dest_epi_id,
    'novo_estoque_origem', _source_epi.estoque - _quantidade
  );
END;
$function$;