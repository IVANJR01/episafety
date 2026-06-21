CREATE OR REPLACE FUNCTION public.ppp_periodos_check_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conflito uuid;
BEGIN
  IF NEW.data_fim IS NOT NULL AND NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'A data de fim (%) não pode ser anterior à data de início (%)', NEW.data_fim, NEW.data_inicio
      USING ERRCODE = '22023';
  END IF;

  -- Apenas um período em aberto (sem data_fim) por PPP
  IF NEW.data_fim IS NULL THEN
    SELECT id INTO _conflito
      FROM public.ppp_periodos
     WHERE ppp_id = NEW.ppp_id
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND data_fim IS NULL
     LIMIT 1;
    IF _conflito IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um período em aberto (sem data de fim) neste PPP. Encerre-o antes de criar outro.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Sobreposição de intervalos [inicio, COALESCE(fim, 'infinity')]
  SELECT id INTO _conflito
    FROM public.ppp_periodos
   WHERE ppp_id = NEW.ppp_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND daterange(data_inicio, COALESCE(data_fim, 'infinity'::date), '[]')
       && daterange(NEW.data_inicio, COALESCE(NEW.data_fim, 'infinity'::date), '[]')
   LIMIT 1;
  IF _conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Período sobreposto a outro período laboral já cadastrado neste PPP.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppp_periodos_check_overlap ON public.ppp_periodos;
CREATE TRIGGER trg_ppp_periodos_check_overlap
  BEFORE INSERT OR UPDATE ON public.ppp_periodos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_periodos_check_overlap();