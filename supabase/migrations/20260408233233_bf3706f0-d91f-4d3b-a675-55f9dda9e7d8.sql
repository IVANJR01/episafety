-- Add regime_revezamento to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS regime_revezamento text DEFAULT 'NA';

-- Add representante legal fields to empresa_config
ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS cpf_representante_legal text;
ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS nome_representante_legal text;