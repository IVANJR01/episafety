-- Separa o CA da referência nos itens de solicitação de materiais.
--
-- O formulário tinha um campo só, rotulado "Referência", gravando em `ca`. Na
-- prática ele virou depósito de duas coisas diferentes: o Certificado de
-- Aprovação do EPI ("CA: 5745", "C.A 38753") e a referência/modelo do material
-- ("(R-19)", "Prancha Scoop", "LEDAN 900 TA - Capacete..."). São coisas
-- distintas: só o CA se consulta no consultaca.com, e só EPI tem CA.
--
-- Esta migração é conservadora de propósito: NENHUM texto é descartado. O que
-- não é CA vai inteiro para `referencia`; o que é CA fica em `ca` com só os
-- dígitos; e o caso de dois CAs no mesmo campo guarda o texto original em
-- `referencia` além do primeiro número em `ca`.

ALTER TABLE public.solicitacoes_materiais_itens
  ADD COLUMN IF NOT EXISTS referencia TEXT;

COMMENT ON COLUMN public.solicitacoes_materiais_itens.ca IS
  'Certificado de Aprovação do EPI — apenas dígitos, para consulta.';
COMMENT ON COLUMN public.solicitacoes_materiais_itens.referencia IS
  'Referência/modelo do material (código do fornecedor, modelo, placa).';

-- Reconhece "CA", "C.A", "nº" e pontuação em volta do número; qualquer outra
-- letra ("NUTRIEX-61093", "Prancha Scoop") diz que aquilo não é um CA.
WITH classificado AS (
  SELECT
    id,
    ca,
    replace(ca, '.', '') AS sem_ponto,
    (regexp_replace(replace(ca, '.', ''), '[0-9]', '', 'g') ~* '^[cano°º:,/ -]*$'
      AND replace(ca, '.', '') ~ '[0-9]{3,7}') AS parece_ca,
    (SELECT count(*) FROM regexp_matches(replace(ca, '.', ''), '[0-9]{3,7}', 'g')) AS quantos_numeros
  FROM public.solicitacoes_materiais_itens
  WHERE coalesce(ca, '') <> ''
)
UPDATE public.solicitacoes_materiais_itens i
SET
  referencia = CASE
    WHEN NOT c.parece_ca THEN c.ca              -- não é CA: vai inteiro
    WHEN c.quantos_numeros > 1 THEN c.ca        -- mais de um CA: preserva o original
    ELSE i.referencia
  END,
  ca = CASE
    WHEN NOT c.parece_ca THEN NULL
    ELSE (regexp_match(c.sem_ponto, '([0-9]{3,7})'))[1]
  END
FROM classificado c
WHERE i.id = c.id;
