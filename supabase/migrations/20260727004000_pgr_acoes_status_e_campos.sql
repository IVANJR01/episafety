-- ============================================================================
-- FASE 4.1 — Plano de Ação: status ampliado e campos completos
-- ============================================================================
-- O enum pgr_acao_status cobria apenas pendente/em_andamento/concluida/
-- atrasada/cancelada. Faltavam "programada", "bloqueada" e "reprogramada" —
-- estados reais de um plano de ação em execução.
--
-- Convertido para text + CHECK pelo mesmo motivo da classificação de risco:
-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que o valor
-- é utilizado, e este vocabulário ainda vai evoluir.
-- ============================================================================

ALTER TABLE public.pgr_acoes ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.pgr_acoes ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.pgr_acoes ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE public.pgr_acao_historico ALTER COLUMN status_anterior TYPE text USING status_anterior::text;
ALTER TABLE public.pgr_acao_historico ALTER COLUMN status_novo TYPE text USING status_novo::text;

ALTER TABLE public.pgr_acoes DROP CONSTRAINT IF EXISTS pgr_acao_status_chk;
ALTER TABLE public.pgr_acoes ADD CONSTRAINT pgr_acao_status_chk CHECK (status IN (
  'pendente','programada','em_andamento','bloqueada','atrasada',
  'reprogramada','concluida','cancelada'
));

COMMENT ON TYPE public.pgr_acao_status IS
  'OBSOLETO desde 2026-07-27. Substituído por text + CHECK em pgr_acoes.status.';

ALTER TABLE public.pgr_acoes
  ADD COLUMN IF NOT EXISTS objetivo text,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS hierarquia_medida text,
  ADD COLUMN IF NOT EXISTS corresponsavel_nome text,
  ADD COLUMN IF NOT EXISTS corresponsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_setor text,
  ADD COLUMN IF NOT EXISTS data_abertura date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS meses_execucao smallint[],
  ADD COLUMN IF NOT EXISTS recursos_necessarios text,
  ADD COLUMN IF NOT EXISTS forma_acompanhamento text,
  ADD COLUMN IF NOT EXISTS indicador text,
  ADD COLUMN IF NOT EXISTS meta_criterio text,
  ADD COLUMN IF NOT EXISTS evidencia_esperada text,
  ADD COLUMN IF NOT EXISTS percentual_execucao smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trabalhadores_atingidos integer,
  ADD COLUMN IF NOT EXISTS quanto_texto text,
  ADD COLUMN IF NOT EXISTS data_reavaliacao_residual date;

ALTER TABLE public.pgr_acoes DROP CONSTRAINT IF EXISTS pgr_acao_hierarquia_chk;
ALTER TABLE public.pgr_acoes ADD CONSTRAINT pgr_acao_hierarquia_chk
  CHECK (hierarquia_medida IS NULL OR hierarquia_medida IN (
    'eliminacao','substituicao','engenharia_epc','administrativa',
    'treinamento_procedimento','epi','monitoramento_saude','preparacao_emergencia'));

ALTER TABLE public.pgr_acoes DROP CONSTRAINT IF EXISTS pgr_acao_pct_chk;
ALTER TABLE public.pgr_acoes ADD CONSTRAINT pgr_acao_pct_chk
  CHECK (percentual_execucao BETWEEN 0 AND 100);

-- Contenção de array: subquery não é permitida em CHECK, então usa-se <@.
ALTER TABLE public.pgr_acoes DROP CONSTRAINT IF EXISTS pgr_acao_meses_chk;
ALTER TABLE public.pgr_acoes ADD CONSTRAINT pgr_acao_meses_chk
  CHECK (meses_execucao IS NULL
         OR meses_execucao <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);

-- Cancelar exige motivo: cancelamento sem justificativa é o que a norma não aceita.
ALTER TABLE public.pgr_acoes DROP CONSTRAINT IF EXISTS pgr_acao_cancel_chk;
ALTER TABLE public.pgr_acoes ADD CONSTRAINT pgr_acao_cancel_chk
  CHECK (status <> 'cancelada'
         OR (motivo_cancelamento IS NOT NULL AND length(btrim(motivo_cancelamento)) >= 5));

COMMENT ON COLUMN public.pgr_acoes.meses_execucao IS
  'Meses previstos de execução (1=JAN..12=DEZ), para o cronograma 5W2H. Complementa datas e marcos — não os substitui.';
COMMENT ON COLUMN public.pgr_acoes.hierarquia_medida IS
  'Posição da medida na hierarquia da NR-01 1.5.4.4.3. Permite verificar se a ação apenas adiciona EPI em vez de eliminar o risco.';
COMMENT ON COLUMN public.pgr_acoes.trabalhadores_atingidos IS
  'Quantidade de trabalhadores possivelmente atingidos. Influencia a PRIORIDADE da ação, nunca a pontuação do risco.';
