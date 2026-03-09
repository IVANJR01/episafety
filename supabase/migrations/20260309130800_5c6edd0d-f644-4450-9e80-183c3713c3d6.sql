
ALTER TABLE public.epis 
ADD COLUMN IF NOT EXISTS descricao text,
ADD COLUMN IF NOT EXISTS fabricante text,
ADD COLUMN IF NOT EXISTS aprovado_para text;
