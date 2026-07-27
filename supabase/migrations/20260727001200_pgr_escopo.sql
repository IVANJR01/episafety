-- ============================================================================
-- FASE 1.3 — Escopo e identificação do PGR (Etapa 1)
-- ============================================================================
-- pgr_documentos hoje só guarda empresa, unidade, versão, status, vigência,
-- um responsável técnico em texto solto, metodologia e escopo (texto corrido).
-- Faltam os campos de escopo exigidos pela NR-01 e pela Etapa 1 do assistente.
--
-- Os campos ficam em pgr_documentos (e não em tabela separada) porque são 1:1
-- com o documento e precisam ser CONGELADOS na versão assinada: uma alteração
-- posterior no cadastro da empresa não pode reescrever um PGR já emitido.
-- Por isso são um SNAPSHOT copiado de empresa_config no momento da criação,
-- e não uma leitura por referência.
-- ============================================================================

-- Tipo do PGR (NR-01 1.5.3.1 / NR-18 para obra).
DO $$ BEGIN
  CREATE TYPE public.pgr_tipo AS ENUM ('estabelecimento','obra','frente_contrato');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pgr_documentos
  -- Snapshot da identificação (congelado na emissão)
  ADD COLUMN IF NOT EXISTS tipo_pgr           public.pgr_tipo NOT NULL DEFAULT 'estabelecimento',
  ADD COLUMN IF NOT EXISTS estabelecimento_id uuid REFERENCES public.sst_estabelecimentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cnpj_snapshot      text,
  ADD COLUMN IF NOT EXISTS cno                text,
  ADD COLUMN IF NOT EXISTS cnae_principal     text,
  ADD COLUMN IF NOT EXISTS cnae_secundario    text[],
  ADD COLUMN IF NOT EXISTS grau_risco         smallint,
  ADD COLUMN IF NOT EXISTS endereco_snapshot  jsonb,

  -- População e organização do trabalho
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores  integer,
  ADD COLUMN IF NOT EXISTS jornada_turnos     text,

  -- Contratação (quando o PGR cobre prestação de serviço em terceiro)
  ADD COLUMN IF NOT EXISTS contratante_nome   text,
  ADD COLUMN IF NOT EXISTS contratante_cnpj   text,
  ADD COLUMN IF NOT EXISTS contrato_numero    text,
  ADD COLUMN IF NOT EXISTS local_prestacao    text,

  -- Datas do ciclo de gestão
  ADD COLUMN IF NOT EXISTS periodo_ref_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_ref_fim    date,
  ADD COLUMN IF NOT EXISTS data_levantamento  date,
  ADD COLUMN IF NOT EXISTS proxima_revisao    date,

  -- Certificação em sistema de gestão de SST (NR-01 1.5.4.4.4: permite 3 anos)
  ADD COLUMN IF NOT EXISTS sgsst_certificado  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sgsst_norma        text,
  ADD COLUMN IF NOT EXISTS sgsst_certificadora text,
  ADD COLUMN IF NOT EXISTS sgsst_validade     date;

ALTER TABLE public.pgr_documentos
  DROP CONSTRAINT IF EXISTS pgr_doc_grau_risco_chk;
ALTER TABLE public.pgr_documentos
  ADD CONSTRAINT pgr_doc_grau_risco_chk
  CHECK (grau_risco IS NULL OR grau_risco BETWEEN 1 AND 4);

ALTER TABLE public.pgr_documentos
  DROP CONSTRAINT IF EXISTS pgr_doc_periodo_ref_chk;
ALTER TABLE public.pgr_documentos
  ADD CONSTRAINT pgr_doc_periodo_ref_chk
  CHECK (periodo_ref_inicio IS NULL OR periodo_ref_fim IS NULL
         OR periodo_ref_fim >= periodo_ref_inicio);

ALTER TABLE public.pgr_documentos
  DROP CONSTRAINT IF EXISTS pgr_doc_qtd_trab_chk;
ALTER TABLE public.pgr_documentos
  ADD CONSTRAINT pgr_doc_qtd_trab_chk
  CHECK (qtd_trabalhadores IS NULL OR qtd_trabalhadores >= 0);

COMMENT ON COLUMN public.pgr_documentos.endereco_snapshot IS
  'Cópia do endereço no momento da emissão. Sub-chaves: logradouro, numero, complemento, bairro, cidade, uf, cep.';
COMMENT ON COLUMN public.pgr_documentos.proxima_revisao IS
  'Data-limite da próxima revisão da avaliação de riscos. Máx. 2 anos (NR-01 1.5.4.4.4), ou 3 anos quando sgsst_certificado = true. O PGR em si é programa contínuo, não documento com validade fixa.';
COMMENT ON COLUMN public.pgr_documentos.sgsst_certificado IS
  'Organização certificada em sistema de gestão de SST — habilita o prazo de revisão de até 3 anos.';

-- Backfill do escopo a partir do cadastro da empresa, apenas para PGRs ainda
-- editáveis. Documentos vigentes/arquivados NÃO são tocados: seu conteúdo já foi
-- emitido e não pode ser reescrito retroativamente.
UPDATE public.pgr_documentos d
   SET cnpj_snapshot  = COALESCE(d.cnpj_snapshot, e.cnpj),
       cnae_principal = COALESCE(d.cnae_principal, e.cnae_principal),
       grau_risco     = COALESCE(d.grau_risco, e.grau_risco)
  FROM public.empresa_config e
 WHERE e.id = COALESCE(d.unidade_id, d.empresa_id)
   AND d.status IN ('rascunho','em_revisao');

CREATE INDEX IF NOT EXISTS pgr_doc_proxima_revisao_idx
  ON public.pgr_documentos (proxima_revisao)
  WHERE proxima_revisao IS NOT NULL;
