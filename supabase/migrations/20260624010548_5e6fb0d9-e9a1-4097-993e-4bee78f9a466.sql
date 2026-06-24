CREATE OR REPLACE FUNCTION public.sync_aso_liberado_portal_rh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.liberado_portal_rh :=
    coalesce(new.status, '') = 'emitido'
    and new.pdf_url is not null
    and length(trim(new.pdf_url)) > 0;
  RETURN new;
END;
$$;

UPDATE public.asos
SET liberado_portal_rh =
  coalesce(status, '') = 'emitido'
  and pdf_url is not null
  and length(trim(pdf_url)) > 0;