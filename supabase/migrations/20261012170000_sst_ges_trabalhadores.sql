-- Número de trabalhadores expostos do GES.
--
-- A NR-01 pede, no item 1.5.7.3.2 "e", os grupos de trabalhadores expostos. O
-- cadastro do GES não tinha esse número, e o PGR saía com "Trabalhadores
-- expostos: não informado" no cabeçalho de TODOS os grupos — conferido num PGR
-- real de 13 GES.
--
-- O número existia só no item do inventário (`pgr_inventario_itens.
-- trabalhadores_expostos`), e ali ele significa outra coisa: quantos ficam
-- expostos ÀQUELE perigo, que pode ser parte do grupo. O número do grupo é do
-- grupo e pertence ao cadastro.
--
-- Vazio é "não informado", nunca zero. Zero expostos é uma afirmação — dizê-la
-- a um fiscal sem saber é pior do que não dizer nada.

ALTER TABLE public.sst_ges
  ADD COLUMN IF NOT EXISTS trabalhadores INTEGER
  CONSTRAINT sst_ges_trabalhadores_nao_negativo CHECK (trabalhadores IS NULL OR trabalhadores >= 0);

COMMENT ON COLUMN public.sst_ges.trabalhadores IS
  'Numero de trabalhadores expostos do GES (NR-01, item 1.5.7.3.2 "e"). Vazio significa nao informado, nunca zero.';
