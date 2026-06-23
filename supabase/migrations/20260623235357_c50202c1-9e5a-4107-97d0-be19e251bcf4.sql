
CREATE OR REPLACE FUNCTION public.sync_aso_liberado_portal_rh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.liberado_portal_rh := (
    NEW.status IN ('emitido', 'assinado', 'concluido', 'finalizado')
  );
  RETURN NEW;
END;
$$;

UPDATE public.asos
SET liberado_portal_rh = true
WHERE status IN ('emitido', 'assinado', 'concluido', 'finalizado')
  AND liberado_portal_rh = false;
