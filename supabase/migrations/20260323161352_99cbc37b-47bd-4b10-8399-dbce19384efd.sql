
-- Fix adjust_epi_stock trigger to not decrement when entrega is from a different empresa than the EPI
CREATE OR REPLACE FUNCTION public.adjust_epi_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _contrato_id uuid;
  _has_contrato_epi boolean;
  _epi_empresa_id uuid;
BEGIN
  IF NEW.tipo IN ('entrega', 'substituicao') THEN
    -- Get the EPI's empresa_id to verify it matches the entrega's empresa
    SELECT empresa_id INTO _epi_empresa_id FROM epis WHERE id = NEW.epi_id;
    
    -- Only decrement if the entrega is from the same empresa as the EPI
    IF _epi_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RETURN NEW;
    END IF;

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
$function$;

-- Fix restore_epi_stock trigger similarly
CREATE OR REPLACE FUNCTION public.restore_epi_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _contrato_id uuid;
  _has_contrato_epi boolean;
  _epi_empresa_id uuid;
BEGIN
  IF OLD.tipo IN ('entrega', 'substituicao') THEN
    -- Get the EPI's empresa_id
    SELECT empresa_id INTO _epi_empresa_id FROM epis WHERE id = OLD.epi_id;
    
    -- Only restore if the entrega was from the same empresa as the EPI
    IF _epi_empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RETURN OLD;
    END IF;

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
$function$;

-- Fix corrupted data: restore incorrectly decremented stock
-- LUVA MULTITATO: 3 cross-empresa substituições decremented incorrectly, add 3 back
UPDATE epis SET estoque = estoque + 3 WHERE id = '927e9890-0f0c-4739-af79-c65134fa6138';

-- PFF2 SEM VÁLVULA: 2 cross-empresa substituições  
UPDATE epis SET estoque = estoque + 2 WHERE id = '0458974b-7a26-465d-bfa9-0aa8588471f9';

-- LUVA LÁTEX NATURAL: 1 cross-empresa substituição
UPDATE epis SET estoque = estoque + 1 WHERE id = 'e4b4eced-c4e2-46c4-a60e-51c53809ae02';
