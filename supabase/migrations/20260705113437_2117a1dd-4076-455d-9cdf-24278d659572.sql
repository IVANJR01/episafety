
-- 1) ghe_ges: ambiente + multi-setores + descrição do ambiente
ALTER TABLE public.ghe_ges
  ADD COLUMN IF NOT EXISTS ambiente text,
  ADD COLUMN IF NOT EXISTS setores text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS descricao_ambiente text;

-- Backfill setores a partir do campo singular legado
UPDATE public.ghe_ges
   SET setores = ARRAY[setor]
 WHERE (setores IS NULL OR array_length(setores,1) IS NULL)
   AND setor IS NOT NULL AND setor <> '';

-- 2) ghe_funcoes: dados de atividade por função
ALTER TABLE public.ghe_funcoes
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS processo text,
  ADD COLUMN IF NOT EXISTS quantidade_trabalhadores integer,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- 3) ghe_riscos: risco específico por função (opcional)
ALTER TABLE public.ghe_riscos
  ADD COLUMN IF NOT EXISTS funcao_id uuid REFERENCES public.ghe_funcoes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS especifico_funcao boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ghe_riscos_funcao_id ON public.ghe_riscos(funcao_id);
