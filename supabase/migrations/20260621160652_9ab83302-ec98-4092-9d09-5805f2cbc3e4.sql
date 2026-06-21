ALTER TABLE public.ppp_exposicoes
  ADD COLUMN IF NOT EXISTS agente_id uuid,
  ADD COLUMN IF NOT EXISTS agente_grupo public.ppp_agente_grupo,
  ADD COLUMN IF NOT EXISTS ltcat_id uuid,
  ADD COLUMN IF NOT EXISTS conclusao_ltcat_id uuid,
  ADD COLUMN IF NOT EXISTS fonte_geradora text,
  ADD COLUMN IF NOT EXISTS tecnica_avaliacao text,
  ADD COLUMN IF NOT EXISTS data_medicao date,
  ADD COLUMN IF NOT EXISTS tipo_exposicao text,
  ADD COLUMN IF NOT EXISTS frequencia text,
  ADD COLUMN IF NOT EXISTS duracao text,
  ADD COLUMN IF NOT EXISTS epc_eficacia text,
  ADD COLUMN IF NOT EXISTS conclusao_previdenciaria text,
  ADD COLUMN IF NOT EXISTS justificativa text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ppp_exposicoes_conclusao_chk') THEN
    ALTER TABLE public.ppp_exposicoes
      ADD CONSTRAINT ppp_exposicoes_conclusao_chk
      CHECK (conclusao_previdenciaria IS NULL OR conclusao_previdenciaria IN
        ('nao_especial','especial_15','especial_20','especial_25','inconclusivo'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ppp_exposicoes_dedup_idx
  ON public.ppp_exposicoes (
    ppp_id, periodo_id,
    COALESCE(ltcat_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(agente_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(data_medicao, '1900-01-01'::date),
    COALESCE(tecnica_avaliacao, '')
  );

CREATE INDEX IF NOT EXISTS ppp_exposicoes_periodo_idx ON public.ppp_exposicoes (periodo_id);
CREATE INDEX IF NOT EXISTS ppp_exposicoes_ltcat_idx ON public.ppp_exposicoes (ltcat_id);