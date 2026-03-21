
-- Fix: When an employee belongs to a contract that has the EPI in contrato_epis,
-- do NOT decrement epis.estoque (the contract stock trigger handles it separately).
-- This prevents double-decrementing when EPIs were already transferred to the contract.
CREATE OR REPLACE FUNCTION public.adjust_epi_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
  _has_contrato_epi boolean;
BEGIN
  IF NEW.tipo IN ('entrega', 'substituicao') THEN
    -- Check if the employee belongs to a contract that has this EPI
    SELECT f.contrato_id INTO _contrato_id
    FROM funcionarios f
    WHERE f.id = NEW.funcionario_id;

    IF _contrato_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM contrato_epis
        WHERE contrato_id = _contrato_id AND epi_id = NEW.epi_id
      ) INTO _has_contrato_epi;
    END IF;

    -- Only decrement general stock if there's no contract stock for this EPI
    IF NOT COALESCE(_has_contrato_epi, false) THEN
      UPDATE public.epis SET estoque = estoque - NEW.quantidade WHERE id = NEW.epi_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Also fix restore_epi_stock for deletions with the same logic
CREATE OR REPLACE FUNCTION public.restore_epi_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
  _has_contrato_epi boolean;
BEGIN
  IF OLD.tipo IN ('entrega', 'substituicao') THEN
    SELECT f.contrato_id INTO _contrato_id
    FROM funcionarios f
    WHERE f.id = OLD.funcionario_id;

    IF _contrato_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM contrato_epis
        WHERE contrato_id = _contrato_id AND epi_id = OLD.epi_id
      ) INTO _has_contrato_epi;
    END IF;

    IF NOT COALESCE(_has_contrato_epi, false) THEN
      UPDATE public.epis SET estoque = estoque + OLD.quantidade WHERE id = OLD.epi_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
