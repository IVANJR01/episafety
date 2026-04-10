
ALTER TABLE public.entregas
ADD COLUMN unidade_origem_id UUID REFERENCES public.empresa_config(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.entregas.unidade_origem_id IS 'Unidade de origem da baixa do EPI (local de onde o item saiu)';
