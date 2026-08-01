-- Previsão de substituição do EPI entregue.
--
-- O sistema anterior ("Controle de EPI") mostrava esse campo em todo registro
-- de entrega, destacado quando a data se aproximava — é por ele que o SESMT
-- sabe quando programar a troca. Não havia equivalente no modelo atual:
-- `epis.validade` é a validade do Certificado de Aprovação, coisa diferente do
-- tempo de uso do equipamento entregue a uma pessoa.
--
-- Fica na entrega (não no EPI) porque a decisão é por entrega: o mesmo EPI
-- dura menos em frente de serviço do que em escritório.

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS data_prevista_substituicao DATE;

COMMENT ON COLUMN public.entregas.data_prevista_substituicao IS
  'Data prevista para substituir o EPI desta entrega. Preenchida manualmente no registro da entrega; nula quando não se aplica (ex.: devolução).';

-- Suporta a consulta "o que vence nos próximos N dias" sem varrer a tabela.
CREATE INDEX IF NOT EXISTS idx_entregas_prev_substituicao
  ON public.entregas(data_prevista_substituicao)
  WHERE data_prevista_substituicao IS NOT NULL;
