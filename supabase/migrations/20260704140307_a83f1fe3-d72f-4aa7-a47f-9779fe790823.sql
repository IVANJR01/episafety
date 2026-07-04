ALTER TABLE public.conformidades
  ADD COLUMN IF NOT EXISTS prazo_correcao date,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);

-- Backfill: use existing data_realizado as prazo when we have no prazo yet
UPDATE public.conformidades
   SET prazo_correcao = data_realizado
 WHERE prazo_correcao IS NULL
   AND data_realizado IS NOT NULL
   AND status <> 'SOLUCIONADO';

-- If solucionado and has no prazo, keep prazo = data_realizado as best-effort
UPDATE public.conformidades
   SET prazo_correcao = data_realizado
 WHERE prazo_correcao IS NULL
   AND data_realizado IS NOT NULL
   AND status = 'SOLUCIONADO';