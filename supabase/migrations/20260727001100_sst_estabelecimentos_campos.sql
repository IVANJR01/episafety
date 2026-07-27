-- ============================================================================
-- FASE 1.2 — sst_estabelecimentos alinhado a empresa_config
-- ============================================================================
-- sst_estabelecimentos é a EXTENSÃO do cadastro para os casos que empresa_config
-- não modela: obra/canteiro, estabelecimento de terceiro e unidade administrativa.
-- Para tipo='proprio' ele ESPELHA empresa_config usando o MESMO id, de modo que
-- o usuário digita uma vez e os dois módulos enxergam o mesmo registro.
--
-- Este passo apenas iguala as colunas disponíveis nos dois lados, para que o
-- espelhamento (implementado em useNucleoMestreSst) não perca informação.
-- ============================================================================

ALTER TABLE public.sst_estabelecimentos
  ADD COLUMN IF NOT EXISTS nome_fantasia   text,
  ADD COLUMN IF NOT EXISTS cnae_secundario text[],
  ADD COLUMN IF NOT EXISTS telefone        text,
  ADD COLUMN IF NOT EXISTS email           text;

ALTER TABLE public.sst_estabelecimentos
  DROP CONSTRAINT IF EXISTS sst_estab_grau_risco_chk;
ALTER TABLE public.sst_estabelecimentos
  ADD CONSTRAINT sst_estab_grau_risco_chk
  CHECK (grau_risco IS NULL OR grau_risco BETWEEN 1 AND 4);

COMMENT ON COLUMN public.sst_estabelecimentos.endereco IS
  'Endereço decomposto em JSON. Sub-chaves esperadas: logradouro, numero, complemento, bairro, cidade, uf, cep. Espelha as colunas homônimas de empresa_config.';
COMMENT ON TABLE public.sst_estabelecimentos IS
  'Estabelecimentos do Núcleo Mestre SST. Para tipo=''proprio'' o registro espelha empresa_config com o MESMO id (fonte única). Os demais tipos (terceiro, obra, administrativo) existem apenas aqui.';

-- Índice de apoio ao espelhamento e aos filtros por tipo.
CREATE INDEX IF NOT EXISTS sst_estab_empresa_tipo_idx
  ON public.sst_estabelecimentos (empresa_id, tipo);
