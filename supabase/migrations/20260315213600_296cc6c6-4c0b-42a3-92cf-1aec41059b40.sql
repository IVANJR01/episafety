
ALTER TABLE public.empresa_config
ADD COLUMN tipo text NOT NULL DEFAULT 'empresa';
-- tipo values: 'empresa', 'filial', 'obra', 'setor'
