-- Trigger: when tipo='substituicao', automatically mark previous active entries of same EPI CA for same employee as 'substituido'
CREATE OR REPLACE FUNCTION public.auto_substituicao_epi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ca TEXT;
BEGIN
  IF NEW.tipo = 'substituicao' THEN
    -- Get the CA of the new EPI
    SELECT ca INTO v_ca FROM public.epis WHERE id = NEW.epi_id;
    
    IF v_ca IS NOT NULL THEN
      -- Mark all previous active entries with same CA for same employee as 'substituido'
      UPDATE public.entregas
      SET status = 'substituido'
      WHERE funcionario_id = NEW.funcionario_id
        AND status = 'ativo'
        AND id != NEW.id
        AND epi_id IN (SELECT id FROM public.epis WHERE ca = v_ca);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_substituicao
AFTER INSERT ON public.entregas
FOR EACH ROW
EXECUTE FUNCTION public.auto_substituicao_epi();
