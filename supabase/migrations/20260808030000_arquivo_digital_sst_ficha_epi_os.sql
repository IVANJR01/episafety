-- =====================================================================
-- Ficha de EPI e Ordem de Serviço entram no Arquivo Digital SST
--
-- Terceira frente: depois de ASO e Cursos, agora Ficha de EPI e Ordem de
-- Serviço passam a arquivar uma cópia oficial no mesmo cofre
-- (internal_documents), em vez de só gerar PDF que ninguém guarda em
-- lugar nenhum.
--
-- Ficha de EPI não é um evento por entrega — é um relatório dinâmico
-- (src/lib/gerarFichaEPI.ts) que soma TODAS as entregas do colaborador
-- toda vez que alguém gera o PDF. Por isso cada geração vira uma versão
-- nova do mesmo documento "Ficha de EPI" do colaborador, em vez de tentar
-- ligar 1 entrega = 1 versão.
--
-- Ordem de Serviço pode ser emitida por colaborador, por função ou por
-- GHE (ordens_servico_sst.escopo). Só as de escopo 'funcionario' têm um
-- colaborador_id de verdade pra pendurar no cofre; as de função/GHE são
-- modelo compartilhado, não documento de uma pessoa, e ficam de fora
-- deste passo — decisão da aplicação, não desta migration.
--
-- Os dois tipos: validade_meses NULL — nem ficha de EPI nem OS têm
-- "vencimento" por data hoje; cada nova emissão é só uma versão nova do
-- mesmo documento, não substitui por prazo.
-- =====================================================================

INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, exige_arquivo, dias_aviso, ativo)
SELECT NULL, 'Ficha de EPI', 'equipamento', NULL, true, '{60,30,15,7,1}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_document_types
  WHERE empresa_id IS NULL AND lower(nome) = lower('Ficha de EPI')
);

INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, exige_arquivo, dias_aviso, ativo)
SELECT NULL, 'Ordem de Serviço', 'empresa', NULL, true, '{60,30,15,7,1}', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_document_types
  WHERE empresa_id IS NULL AND lower(nome) = lower('Ordem de Serviço')
);
