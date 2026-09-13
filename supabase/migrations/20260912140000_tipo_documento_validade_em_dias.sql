-- Validade do tipo de documento em dias, além de meses.
--
-- ASO fora do anual costuma valer 90 ou 120 dias, conforme o risco e o tipo
-- de exame. Com só `validade_meses`, esses prazos não eram representáveis no
-- tipo: quem trabalhava com eles tinha que corrigir a data em cada anexo, e
-- quem esquecesse gravava um vencimento errado sem nada avisar.
--
-- A coluna nova não substitui `validade_meses`, e a conversão de uma para a
-- outra não é feita de propósito: 12 meses e 365 dias dão datas diferentes
-- (90 dias a partir de 01/12/2027 cai em 29/02/2028; "3 meses" cai em
-- 01/03), e converter o que já está gravado mudaria vencimentos em silêncio.
-- Cada tipo usa uma das duas.
alter table public.internal_document_types
  add column if not exists validade_dias integer;

comment on column public.internal_document_types.validade_dias is
  'Prazo em dias. Tem precedência sobre validade_meses quando preenchido. Existe para prazos que não são múltiplos de mês, como ASO de 90 ou 120 dias.';

-- Uma coisa ou outra, nunca as duas: com os dois campos preenchidos não
-- haveria como saber qual venceu, e a resposta dependeria da ordem em que o
-- código lesse os campos.
alter table public.internal_document_types
  drop constraint if exists internal_document_types_validade_unica;

alter table public.internal_document_types
  add constraint internal_document_types_validade_unica
  check (validade_dias is null or validade_meses is null);

alter table public.internal_document_types
  drop constraint if exists internal_document_types_validade_dias_positiva;

alter table public.internal_document_types
  add constraint internal_document_types_validade_dias_positiva
  check (validade_dias is null or validade_dias > 0);
