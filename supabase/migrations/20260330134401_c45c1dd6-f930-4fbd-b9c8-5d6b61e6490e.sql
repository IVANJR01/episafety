
CREATE OR REPLACE FUNCTION public.reverse_contrato_stock_on_entrega_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _contrato_id uuid;
  _func_empresa_id uuid;
  _contrato_epi_id uuid;
  _current_stock integer;
  _is_outgoing boolean;
  _is_return boolean;
  _mov_id uuid;
BEGIN
  _is_outgoing := OLD.tipo IN ('entrega', 'troca', 'substituicao', 'perda', 'dano');
  _is_return := OLD.tipo = 'devolucao';

  IF NOT _is_outgoing AND NOT _is_return THEN
    RETURN OLD;
  END IF;

  SELECT contrato_id, empresa_id INTO _contrato_id, _func_empresa_id
  FROM funcionarios WHERE id = OLD.funcionario_id;

  IF _contrato_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT id, estoque INTO _contrato_epi_id, _current_stock
  FROM contrato_epis
  WHERE contrato_id = _contrato_id AND epi_id = OLD.epi_id
  LIMIT 1;

  IF _contrato_epi_id IS NULL THEN
    RETURN OLD;
  END IF;

  IF _is_outgoing THEN
    UPDATE contrato_epis SET estoque = _current_stock + OLD.quantidade WHERE id = _contrato_epi_id;
  ELSE
    UPDATE contrato_epis SET estoque = GREATEST(_current_stock - OLD.quantidade, 0) WHERE id = _contrato_epi_id;
  END IF;

  -- Find and delete the most recent matching movimentacao
  SELECT id INTO _mov_id
  FROM contrato_epis_movimentacoes
  WHERE contrato_epi_id = _contrato_epi_id
    AND epi_id = OLD.epi_id
    AND quantidade = OLD.quantidade
    AND created_at >= OLD.created_at
  ORDER BY created_at DESC
  LIMIT 1;

  IF _mov_id IS NOT NULL THEN
    DELETE FROM contrato_epis_movimentacoes WHERE id = _mov_id;
  END IF;

  RETURN OLD;
END;
$function$;
