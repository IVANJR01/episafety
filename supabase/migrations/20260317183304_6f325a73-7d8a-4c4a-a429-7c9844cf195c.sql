
-- Add contrato_id column to usuarios_liberados for linking users to contracts
ALTER TABLE public.usuarios_liberados ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;
