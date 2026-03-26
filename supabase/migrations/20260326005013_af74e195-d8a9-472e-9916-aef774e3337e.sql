
CREATE OR REPLACE FUNCTION public.transfer_epi_between_contracts(
  _source_contrato_id uuid,
  _dest_contrato_id uuid,
  _epi_id uuid,
  _quantidade integer,
  _motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _source_ce RECORD;
  _dest_ce RECORD;
  _source_contrato RECORD;
  _dest_contrato RECORD;
  _epi_record RECORD;
  _profile_nome text;
  _dest_ce_id uuid;
BEGIN
  -- Validate
  IF _quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;

  IF _source_contrato_id = _dest_contrato_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Origem e destino não podem ser iguais');
  END IF;

  -- Permission check
  IF NOT is_super_admin(auth.uid()) AND NOT is_principal(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND (
        modulos_permitidos @> ARRAY['epis:gestao_estoque']
        OR modulos_permitidos @> ARRAY['epis']
        OR modulos_permitidos @> ARRAY['estoque_contrato']
      )
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir EPIs');
    END IF;
  END IF;

  -- Verify contracts exist
  SELECT * INTO _source_contrato FROM contratos WHERE id = _source_contrato_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrato de origem não encontrado');
  END IF;

  SELECT * INTO _dest_contrato FROM contratos WHERE id = _dest_contrato_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrato de destino não encontrado');
  END IF;

  -- Check source has the EPI with enough stock
  SELECT * INTO _source_ce FROM contrato_epis WHERE contrato_id = _source_contrato_id AND epi_id = _epi_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado no contrato de origem');
  END IF;

  IF _source_ce.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_ce.estoque);
  END IF;

  -- Get EPI details
  SELECT * INTO _epi_record FROM epis WHERE id = _epi_id;

  -- Get user name
  SELECT nome INTO _profile_nome FROM profiles WHERE user_id = auth.uid() LIMIT 1;

  -- Subtract from source
  UPDATE contrato_epis SET estoque = estoque - _quantidade, updated_at = now()
  WHERE id = _source_ce.id;

  -- Add to destination (create if not exists)
  SELECT * INTO _dest_ce FROM contrato_epis WHERE contrato_id = _dest_contrato_id AND epi_id = _epi_id;
  IF FOUND THEN
    UPDATE contrato_epis SET estoque = estoque + _quantidade, updated_at = now()
    WHERE id = _dest_ce.id;
    _dest_ce_id := _dest_ce.id;
  ELSE
    INSERT INTO contrato_epis (contrato_id, epi_id, estoque, empresa_id, created_by)
    VALUES (_dest_contrato_id, _epi_id, _quantidade, _dest_contrato.empresa_id, auth.uid())
    RETURNING id INTO _dest_ce_id;
  END IF;

  -- Record movement: saída from source
  INSERT INTO contrato_epis_movimentacoes (contrato_epi_id, contrato_id, epi_id, empresa_id, tipo, quantidade, motivo, responsavel_nome, created_by)
  VALUES (
    _source_ce.id, _source_contrato_id, _epi_id,
    _source_contrato.empresa_id,
    'saida', _quantidade,
    'Transferência para ' || _dest_contrato.nome || COALESCE(' — ' || _motivo, ''),
    _profile_nome, auth.uid()
  );

  -- Record movement: entrada to destination
  INSERT INTO contrato_epis_movimentacoes (contrato_epi_id, contrato_id, epi_id, empresa_id, tipo, quantidade, motivo, responsavel_nome, created_by)
  VALUES (
    _dest_ce_id, _dest_contrato_id, _epi_id,
    _dest_contrato.empresa_id,
    'entrada', _quantidade,
    'Transferência de ' || _source_contrato.nome || COALESCE(' — ' || _motivo, ''),
    _profile_nome, auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'source_new_stock', _source_ce.estoque - _quantidade,
    'dest_contrato', _dest_contrato.nome
  );
END;
$$;
