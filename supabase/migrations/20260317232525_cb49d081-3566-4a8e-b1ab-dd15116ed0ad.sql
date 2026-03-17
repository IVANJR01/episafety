
CREATE OR REPLACE FUNCTION public.transfer_epi_to_contract(
  _source_empresa_id uuid,
  _contrato_id uuid,
  _epi_id uuid,
  _quantidade integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_empresa_id uuid;
  _source_epi RECORD;
  _contrato RECORD;
  _contrato_epi_id uuid;
  _has_gestao boolean;
  _profile_nome text;
BEGIN
  IF _quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;

  -- Permission check: must be super_admin, principal, or have epis:gestao_estoque
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT is_principal(auth.uid()) THEN
      SELECT EXISTS (
        SELECT 1 FROM usuarios_liberados
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (
          modulos_permitidos @> ARRAY['epis:gestao_estoque']
          OR modulos_permitidos @> ARRAY['epis']
        )
      ) INTO _has_gestao;

      IF NOT _has_gestao THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir EPIs');
      END IF;
    END IF;

    -- Verify source unit is in user's company tree
    _user_empresa_id := get_user_empresa_id(auth.uid());
    IF NOT EXISTS (
      SELECT 1 FROM empresa_config
      WHERE id = _source_empresa_id AND (empresa_pai_id = _user_empresa_id OR id = _user_empresa_id)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unidade de origem inválida');
    END IF;
  END IF;

  -- Verify source EPI exists and has enough stock
  SELECT * INTO _source_epi FROM epis WHERE id = _epi_id AND empresa_id = _source_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado na unidade');
  END IF;

  IF _source_epi.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_epi.estoque);
  END IF;

  -- Verify contract exists
  SELECT * INTO _contrato FROM contratos WHERE id = _contrato_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrato não encontrado');
  END IF;

  -- Find or create contrato_epis record
  SELECT id INTO _contrato_epi_id
  FROM contrato_epis
  WHERE contrato_id = _contrato_id AND epi_id = _epi_id
  LIMIT 1;

  IF _contrato_epi_id IS NULL THEN
    INSERT INTO contrato_epis (contrato_id, epi_id, estoque, empresa_id, created_by)
    VALUES (_contrato_id, _epi_id, 0, _contrato.empresa_id, auth.uid())
    RETURNING id INTO _contrato_epi_id;
  END IF;

  -- Deduct from unit stock
  UPDATE epis SET estoque = estoque - _quantidade WHERE id = _epi_id;

  -- Add to contract stock
  UPDATE contrato_epis SET estoque = estoque + _quantidade WHERE id = _contrato_epi_id;

  -- Get user name for audit
  SELECT nome INTO _profile_nome FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  -- Record movimentação
  INSERT INTO contrato_epis_movimentacoes (
    contrato_epi_id, contrato_id, epi_id, empresa_id,
    tipo, quantidade, motivo, responsavel_nome, created_by
  ) VALUES (
    _contrato_epi_id, _contrato_id, _epi_id, _contrato.empresa_id,
    'entrada', _quantidade,
    'Transferência do estoque da unidade',
    COALESCE(_profile_nome, 'Sistema'),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Transferência realizada com sucesso',
    'novo_estoque_unidade', _source_epi.estoque - _quantidade,
    'contrato_epi_id', _contrato_epi_id
  );
END;
$$;
