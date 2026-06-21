ALTER TABLE public.ppp_revisoes
  ADD COLUMN IF NOT EXISTS acao text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.ppp_revisoes ALTER COLUMN motivo SET DEFAULT '';
ALTER TABLE public.ppp_revisoes ALTER COLUMN motivo DROP NOT NULL;