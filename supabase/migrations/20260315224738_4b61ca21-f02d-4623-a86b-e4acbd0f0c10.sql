
-- Function to list EPIs from a specific filial (for principal users)
CREATE OR REPLACE FUNCTION public.get_filial_epis(_filial_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  _user_empresa_id uuid;
BEGIN
  -- Must be super_admin or principal
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      RETURN '[]'::jsonb;
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
$$;

-- Function to transfer EPI stock between units
CREATE OR REPLACE FUNCTION public.transfer_epi_stock(
  _source_empresa_id uuid,
  _dest_empresa_id uuid,
  _source_epi_id uuid,
  _quantidade integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_empresa_id uuid;
  _source_epi RECORD;
  _dest_epi_id uuid;
BEGIN
  -- Validate quantity
  IF _quantidade <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantidade deve ser maior que zero');
  END IF;

  -- Must be super_admin or principal
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
    END IF;
    -- Verify both units belong to the user's company
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

  -- Get source EPI info
  SELECT * INTO _source_epi FROM epis WHERE id = _source_epi_id AND empresa_id = _source_empresa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado na origem');
  END IF;

  -- Check stock
  IF _source_epi.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_epi.estoque);
  END IF;

  -- Find or create matching EPI in destination (match by CA if available, otherwise by name)
  IF _source_epi.ca IS NOT NULL AND _source_epi.ca != '' THEN
    SELECT id INTO _dest_epi_id FROM epis WHERE empresa_id = _dest_empresa_id AND ca = _source_epi.ca LIMIT 1;
  END IF;
  IF _dest_epi_id IS NULL THEN
    SELECT id INTO _dest_epi_id FROM epis WHERE empresa_id = _dest_empresa_id AND nome = _source_epi.nome LIMIT 1;
  END IF;

  -- If no matching EPI in destination, create one
  IF _dest_epi_id IS NULL THEN
    INSERT INTO epis (nome, ca, categoria, descricao, fabricante, aprovado_para, validade, estoque, estoque_minimo, valor, empresa_id, created_by)
    VALUES (_source_epi.nome, _source_epi.ca, _source_epi.categoria, _source_epi.descricao, _source_epi.fabricante, _source_epi.aprovado_para, _source_epi.validade, 0, _source_epi.estoque_minimo, _source_epi.valor, _dest_empresa_id, auth.uid())
    RETURNING id INTO _dest_epi_id;
  END IF;

  -- Transfer: decrease source, increase destination
  UPDATE epis SET estoque = estoque - _quantidade WHERE id = _source_epi_id;
  UPDATE epis SET estoque = estoque + _quantidade WHERE id = _dest_epi_id;

  RETURN jsonb_build_object('success', true, 'message', 'Transferência realizada com sucesso');
END;
$$;
