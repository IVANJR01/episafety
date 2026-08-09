-- Remove os subtipos de ASO que foram inseridos na migration 20260808090000_dossie_digital_colaborador
-- O cliente quer manter apenas "ASO - Atestado de Saúde Ocupacional" e tratar admissional, periódico etc como versões do mesmo documento (histórico).

DELETE FROM public.internal_document_types
WHERE empresa_id IS NULL AND nome IN (
  'ASO Admissional',
  'ASO Periódico',
  'ASO Mudança de Risco/Função',
  'ASO Retorno ao Trabalho',
  'ASO Demissional'
);
