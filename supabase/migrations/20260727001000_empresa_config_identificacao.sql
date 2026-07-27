-- ============================================================================
-- FASE 1.1 — Identificação da empresa/estabelecimento (fonte única)
-- ============================================================================
-- A Etapa 1 do PGR exige CNAE principal e secundários, grau de risco e endereço.
-- Hoje empresa_config só guarda nome, cnpj, endereco (texto corrido), telefone,
-- email e representante legal — o PGR não tem de onde ler esses campos.
--
-- empresa_config permanece a FONTE ÚNICA de identidade da empresa: é ela que o
-- PGR, o LTCAT, o PPP, o dashboard, os funcionários e as políticas de RLS já
-- consultam. Estender aqui evita criar um segundo cadastro divergente.
--
-- A coluna endereco (texto corrido) é MANTIDA como fallback dos registros
-- antigos; as novas colunas decompostas têm precedência quando preenchidas.
-- Migration puramente aditiva.
-- ============================================================================

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS nome_fantasia   text,
  ADD COLUMN IF NOT EXISTS cnae_principal  text,
  ADD COLUMN IF NOT EXISTS cnae_secundario text[],
  ADD COLUMN IF NOT EXISTS grau_risco      smallint,
  ADD COLUMN IF NOT EXISTS logradouro      text,
  ADD COLUMN IF NOT EXISTS numero          text,
  ADD COLUMN IF NOT EXISTS complemento     text,
  ADD COLUMN IF NOT EXISTS bairro          text,
  ADD COLUMN IF NOT EXISTS cidade          text,
  ADD COLUMN IF NOT EXISTS uf              text,
  ADD COLUMN IF NOT EXISTS cep             text;

-- Grau de risco da NR-04 (quadro I): 1 a 4.
ALTER TABLE public.empresa_config
  DROP CONSTRAINT IF EXISTS empresa_config_grau_risco_chk;
ALTER TABLE public.empresa_config
  ADD CONSTRAINT empresa_config_grau_risco_chk
  CHECK (grau_risco IS NULL OR grau_risco BETWEEN 1 AND 4);

ALTER TABLE public.empresa_config
  DROP CONSTRAINT IF EXISTS empresa_config_uf_chk;
ALTER TABLE public.empresa_config
  ADD CONSTRAINT empresa_config_uf_chk
  CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

COMMENT ON COLUMN public.empresa_config.nome_fantasia IS
  'Nome fantasia. Usado na capa do PGR quando presente; caso contrário usa-se "nome" (razão social).';
COMMENT ON COLUMN public.empresa_config.cnae_principal IS
  'CNAE principal no formato 0000-0/00.';
COMMENT ON COLUMN public.empresa_config.cnae_secundario IS
  'CNAEs secundários. Array porque a Etapa 1 do PGR pede "CNAE principal e secundários" (plural).';
COMMENT ON COLUMN public.empresa_config.grau_risco IS
  'Grau de risco da NR-04 (1 a 4), derivado do CNAE principal.';
COMMENT ON COLUMN public.empresa_config.endereco IS
  'LEGADO: endereço em texto corrido. Preservado como fallback. Preferir os campos decompostos (logradouro, numero, ...).';
