
DROP TRIGGER IF EXISTS trigger_restore_epi_stock ON public.entregas;
DROP TRIGGER IF EXISTS trigger_adjust_epi_stock ON public.entregas;
DROP TRIGGER IF EXISTS trigger_auto_substituicao ON public.entregas;

CREATE TRIGGER trigger_restore_epi_stock
  BEFORE DELETE ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_epi_stock();

CREATE TRIGGER trigger_adjust_epi_stock
  AFTER INSERT ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_epi_stock();

CREATE TRIGGER trigger_auto_substituicao
  AFTER INSERT ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_substituicao_epi();
