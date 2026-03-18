-- Remove duplicate triggers (keep only the original ones)
DROP TRIGGER IF EXISTS trigger_adjust_epi_stock ON public.entregas;
DROP TRIGGER IF EXISTS trigger_auto_substituicao ON public.entregas;
DROP TRIGGER IF EXISTS trigger_restore_epi_stock ON public.entregas;

-- Recreate restore_epi_stock on the correct name
CREATE TRIGGER on_entrega_deleted
  BEFORE DELETE ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION restore_epi_stock();