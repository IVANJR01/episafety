ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS formas_pagamento jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cartao_credito_config jsonb;