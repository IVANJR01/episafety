-- =====================================================================
-- Arquivo Digital SST — ASO passa a usar o mesmo cofre de documentos
--
-- Pedido do usuário: "tenho um ASO já assinado, tudo ok, mas preciso
-- anexar no sistema, aonde que vou colocar?" — hoje o módulo de ASO
-- (tabelas asos/aso_exames/aso_riscos/aso_verificacao) não tem NENHUM
-- upload de arquivo. `asos.pdf_url` e `aso_assinaturas.assinatura_url`
-- existem na tabela mas nunca são preenchidos por nenhuma tela.
--
-- Em vez de inventar armazenamento próprio pro ASO, ele passa a usar o
-- mesmo internal_documents/internal_document_versions que já vale pra
-- treinamentos/NRs — o dossiê do colaborador vai ler dali pra tudo.
--
-- Tipo de documento único e GLOBAL (empresa_id NULL), pelo mesmo motivo
-- que os cursos-base (NR-10, NR-35 etc.) são globais: ASO é o mesmo
-- documento regulatório pra qualquer empresa, não faz sentido cada
-- empresa ter o seu "tipo" de ASO. validade_meses fica NULL de propósito
-- — a validade de cada ASO já vem calculada pelo próprio módulo
-- (periodicidade do exame/risco), não é um prazo fixo em meses a partir
-- da emissão.
-- =====================================================================

INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, exige_arquivo, dias_aviso, ativo)
SELECT NULL, 'ASO - Atestado de Saúde Ocupacional', 'saude', NULL, true, '{60,30,15,7,1}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_document_types
  WHERE empresa_id IS NULL AND lower(nome) = lower('ASO - Atestado de Saúde Ocupacional')
);

-- Cada nova versão do "documento ASO" de um colaborador nasce de um exame
-- (uma linha de `asos`) diferente — o admissional, depois um periódico,
-- depois outro. `origem_tabela/origem_id` já existe em internal_documents,
-- mas aponta só pro PRIMEIRO exame que criou o registro; para saber de
-- qual exame especificamente cada VERSÃO veio, a própria versão precisa
-- guardar isso.
ALTER TABLE public.internal_document_versions
  ADD COLUMN IF NOT EXISTS origem_tabela text,
  ADD COLUMN IF NOT EXISTS origem_id uuid;

CREATE INDEX IF NOT EXISTS idx_idv_origem
  ON public.internal_document_versions(origem_tabela, origem_id);

COMMENT ON COLUMN public.internal_document_versions.origem_id IS
  'Registro de origem desta versão específica (ex.: o exame de asos que gerou este anexo). Independente do origem_id em internal_documents, que é só do primeiro registro que criou o documento.';
