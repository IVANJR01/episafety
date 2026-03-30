
CREATE TRIGGER trg_reverse_contrato_stock
  BEFORE DELETE ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.reverse_contrato_stock_on_entrega_delete();
