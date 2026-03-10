
CREATE OR REPLACE FUNCTION public.restore_epi_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Only restore stock for types that originally deducted it
  IF OLD.tipo IN ('entrega', 'substituicao') THEN
    UPDATE public.epis SET estoque = estoque + OLD.quantidade WHERE id = OLD.epi_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_restore_epi_stock
  BEFORE DELETE ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_epi_stock();
