-- Update stock adjustment trigger to handle new types
CREATE OR REPLACE FUNCTION public.adjust_epi_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo IN ('entrega', 'substituicao') THEN
    UPDATE public.epis SET estoque = estoque - NEW.quantidade WHERE id = NEW.epi_id;
  END IF;
  -- perda and dano don't affect stock (EPI is already with the employee)
  RETURN NEW;
END;
$$;
