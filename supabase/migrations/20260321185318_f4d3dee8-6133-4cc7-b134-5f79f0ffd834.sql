
-- Table to track unit-level stock movements (transfers, adjustments)
CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_origem_id uuid REFERENCES public.empresa_config(id),
  empresa_destino_id uuid REFERENCES public.empresa_config(id),
  epi_id uuid REFERENCES public.epis(id) NOT NULL,
  empresa_id uuid REFERENCES public.empresa_config(id),
  tipo text NOT NULL DEFAULT 'transferencia',
  quantidade integer NOT NULL DEFAULT 0,
  valor_unitario numeric DEFAULT 0,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal read estoque_movimentacoes company tree"
  ON public.estoque_movimentacoes FOR SELECT TO authenticated
  USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read estoque_movimentacoes"
  ON public.estoque_movimentacoes FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Update transfer_epi_stock to record movement
CREATE OR REPLACE FUNCTION public.transfer_epi_stock(
  _source_empresa_id uuid,
  _dest_empresa_id uuid,
  _source_epi_id uuid,
  _quantidade integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE id = _source_epi_id AND empresa_id = _source_empresa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EPI não encontrado na unidade de origem');
  END IF;

  IF _source_epi.estoque < _quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente. Disponível: ' || _source_epi.estoque);
  END IF;

  -- Find or create matching EPI in destination
  SELECT id INTO _dest_epi_id
  FROM epis
  WHERE empresa_id = _dest_empresa_id
    AND (
      (ca IS NOT NULL AND ca = _source_epi.ca)
      OR (ca IS NULL AND nome = _source_epi.nome)
    )
  LIMIT 1;

  IF _dest_epi_id IS NULL THEN
    INSERT INTO epis (nome, ca, categoria, estoque, estoque_minimo, valor, empresa_id, fabricante, descricao, aprovado_para, tamanho)
    VALUES (_source_epi.nome, _source_epi.ca, _source_epi.categoria, 0, _source_epi.estoque_minimo, _source_epi.valor, _dest_empresa_id, _source_epi.fabricante, _source_epi.descricao, _source_epi.aprovado_para, _source_epi.tamanho)
    RETURNING id INTO _dest_epi_id;
  END IF;

  -- Update stock
  UPDATE epis SET estoque = estoque - _quantidade WHERE id = _source_epi_id;
  UPDATE epis SET estoque = estoque + _quantidade WHERE id = _dest_epi_id;

  -- Determine parent empresa for RLS
  SELECT COALESCE(empresa_pai_id, id) INTO _parent_empresa_id
  FROM empresa_config WHERE id = _source_empresa_id;

  -- Record the movement as a transfer (saída from source perspective)
  INSERT INTO estoque_movimentacoes (
    empresa_origem_id, empresa_destino_id, epi_id, empresa_id,
    tipo, quantidade, valor_unitario, motivo, created_by
  ) VALUES (
    _source_empresa_id, _dest_empresa_id, _source_epi_id, _parent_empresa_id,
    'transferencia', _quantidade, COALESCE(_source_epi.valor, 0),
    'Transferência Interna entre unidades', auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Transferência realizada com sucesso');
END;
$$;
