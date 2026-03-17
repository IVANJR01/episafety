
-- Add unidade_id and contrato_id to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN unidade_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL;
ALTER TABLE public.funcionarios ADD COLUMN contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;
