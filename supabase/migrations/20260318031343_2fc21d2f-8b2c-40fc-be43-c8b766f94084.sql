
CREATE OR REPLACE FUNCTION public.sync_contrato_stock_on_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contrato_id uuid;
  _func_empresa_id uuid;
  _contrato_epi_id uuid;
  _current_stock integer;
  _next_stock integer;
  _is_outgoing boolean;
  _is_return boolean;
  _tipo_mov text;
  _motivo text;
  _label text;
  _ce_empresa_id uuid;
BEGIN
  _is_outgoing := NEW.tipo IN ('entrega', 'troca', 'substituicao', 'perda', 'dano');
  _is_return := NEW.tipo = 'devolucao';

  IF NOT _is_outgoing AND NOT _is_return THEN
    RETURN NEW;
  END IF;

  SELECT contrato_id, empresa_id INTO _contrato_id, _func_empresa_id
  FROM funcionarios WHERE id = NEW.funcionario_id;

  IF _contrato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, estoque, empresa_id INTO _contrato_epi_id, _current_stock, _ce_empresa_id
  FROM contrato_epis
  WHERE contrato_id = _contrato_id AND epi_id = NEW.epi_id
  LIMIT 1;

  IF _contrato_epi_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF _is_return THEN
    _next_stock := _current_stock + NEW.quantidade;
    _tipo_mov := 'entrada';
  ELSE
    _next_stock := GREATEST(_current_stock - NEW.quantidade, 0);
    _tipo_mov := 'saida';
  END IF;

  UPDATE contrato_epis SET estoque = _next_stock WHERE id = _contrato_epi_id;

  _label := CASE NEW.tipo
    WHEN 'entrega' THEN 'Entrega'
    WHEN 'troca' THEN 'Troca'
    WHEN 'substituicao' THEN 'Substituição'
    WHEN 'devolucao' THEN 'Devolução'
    WHEN 'perda' THEN 'Perda'
    WHEN 'dano' THEN 'Dano'
    ELSE NEW.tipo
  END;
  _motivo := _label || ' via módulo de entregas';
  IF NEW.observacao IS NOT NULL AND NEW.observacao != '' THEN
    _motivo := _motivo || ' — ' || NEW.observacao;
  END IF;

  INSERT INTO contrato_epis_movimentacoes (
    contrato_epi_id, contrato_id, epi_id, empresa_id,
    tipo, quantidade, motivo, created_by
  ) VALUES (
    _contrato_epi_id, _contrato_id, NEW.epi_id,
    COALESCE(_ce_empresa_id, _func_empresa_id, NEW.empresa_id),
    _tipo_mov, NEW.quantidade, _motivo, NEW.created_by
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_contrato_stock
AFTER INSERT ON public.entregas
FOR EACH ROW
EXECUTE FUNCTION public.sync_contrato_stock_on_entrega();
