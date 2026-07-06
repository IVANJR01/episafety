
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS descricao_ambiente text,
  ADD COLUMN IF NOT EXISTS tipo_agente text,
  ADD COLUMN IF NOT EXISTS lesoes text,
  ADD COLUMN IF NOT EXISTS intensidade text,
  ADD COLUMN IF NOT EXISTS tempo_exposicao text,
  ADD COLUMN IF NOT EXISTS tecnica_utilizada text,
  ADD COLUMN IF NOT EXISTS epi text,
  ADD COLUMN IF NOT EXISTS atenuacao text;
