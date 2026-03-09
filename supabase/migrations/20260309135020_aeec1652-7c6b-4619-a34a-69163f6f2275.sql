-- Add new enum values to tipo_entrega
ALTER TYPE public.tipo_entrega ADD VALUE IF NOT EXISTS 'substituicao';
ALTER TYPE public.tipo_entrega ADD VALUE IF NOT EXISTS 'perda';
ALTER TYPE public.tipo_entrega ADD VALUE IF NOT EXISTS 'dano';

-- Add new status value
ALTER TYPE public.status_entrega ADD VALUE IF NOT EXISTS 'substituido';
ALTER TYPE public.status_entrega ADD VALUE IF NOT EXISTS 'perdido';
ALTER TYPE public.status_entrega ADD VALUE IF NOT EXISTS 'danificado';
