-- ============================================================================
-- DIAGNÓSTICO — o que existe de verdade no banco da CG3
-- ============================================================================
-- Só CONSULTA. Não altera, não apaga, não insere. Pode rodar à vontade.
--
-- POR QUE ISTO EXISTE
--
-- As telas de Inspeções e de Obras acrescentavam registros escritos dentro do
-- próprio código, e isso mascarava o que estava (ou não estava) no banco. Ao
-- remover a injeção nas Inspeções, as de Barrocas sumiram da tela — o que pode
-- significar duas coisas bem diferentes:
--
--   (a) elas nunca chegaram ao banco; ou
--   (b) elas existem, mas gravadas na OUTRA empresa CG3, fora do alcance da
--       empresa ativa no seletor.
--
-- Há duas empresas CG3 no sistema:
--   75447c33-0960-46db-ba59-00327575fe44
--   814c58d9-17c9-4e18-8d19-9d0e07210834
--
-- Os registros de Barrocas que estavam no código apontavam para a SEGUNDA.
-- A tela de Inspeções mostra apenas a árvore da empresa ativa; se as duas não
-- estiverem ligadas por empresa_pai_id, uma não enxerga a outra.
--
-- COMO USAR
--
-- Rode no SQL Editor do Supabase e me mande o resultado das cinco consultas.
-- Com isso dá para dizer com certeza o que aconteceu e o que precisa ser feito.
-- ============================================================================

-- 1) As duas empresas CG3: nome e se uma é filial da outra
SELECT id, nome, empresa_pai_id
  FROM public.empresa_config
 WHERE id IN (
   '75447c33-0960-46db-ba59-00327575fe44',
   '814c58d9-17c9-4e18-8d19-9d0e07210834'
 );

-- 2) Inspeções por empresa e por local — quantas existem e quantas têm foto
SELECT empresa_id,
       local,
       count(*)                                              AS registros,
       count(*) FILTER (WHERE foto_antes_path  IS NOT NULL)  AS com_foto_antes,
       count(*) FILTER (WHERE foto_depois_path IS NOT NULL)  AS com_foto_depois,
       min(data_inspecao)                                    AS primeira,
       max(data_inspecao)                                    AS ultima
  FROM public.conformidades
 GROUP BY empresa_id, local
 ORDER BY empresa_id, local;

-- 3) Especificamente Barrocas, em qualquer empresa
SELECT id, numero, empresa_id, data_inspecao, local, situacao_detectada,
       foto_antes_path, foto_depois_path, created_at
  FROM public.conformidades
 WHERE local ILIKE '%BARROCA%'
 ORDER BY numero;

-- 4) As fotos de inspeção que estão no Storage, por pasta de empresa
--    (o primeiro trecho do caminho é o empresa_id)
SELECT bucket_id,
       split_part(name, '/', 1) AS empresa_id,
       count(*)                 AS arquivos,
       min(created_at)          AS mais_antigo,
       max(created_at)          AS mais_recente
  FROM storage.objects
 WHERE bucket_id IN ('conformidades', 'inspecoes')
 GROUP BY bucket_id, split_part(name, '/', 1)
 ORDER BY bucket_id, empresa_id;

-- 5) Obras cadastradas de verdade (a tela também injeta obras pelo código)
SELECT id, empresa_id, nome, codigo, cidade, uf, status
  FROM public.obras
 WHERE empresa_id IN (
   '75447c33-0960-46db-ba59-00327575fe44',
   '814c58d9-17c9-4e18-8d19-9d0e07210834'
 )
 ORDER BY nome;
