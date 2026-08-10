-- =====================================================================
-- FUNCIONÁRIO CADASTRADO QUE NÃO APARECE
--
-- Rode a PARTE 1 no SQL Editor do Supabase e me mande o resultado.
-- Ela só lê. A PARTE 2 conserta, e só deve rodar depois de olhar a 1.
--
-- Há três destinos possíveis para um cadastro que "sumiu":
--   a) ele nunca chegou ao banco (a gravação falhou, ou ficou na fila
--      offline do celular e ainda não sincronizou);
--   b) ele chegou, mas sem empresa vinculada — e aí o aplicativo o
--      descarta em toda leitura, então existe e não aparece em lugar
--      nenhum: nem na busca, nem na Ficha de EPI;
--   c) ele chegou vinculado a OUTRA empresa que não a ativa.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE 1 — DIAGNÓSTICO (só leitura)
-- ---------------------------------------------------------------------

-- 1.1  Os últimos 20 funcionários criados, com a empresa de cada um.
--      Se o nome que você cadastrou aparecer aqui, ele CHEGOU ao banco —
--      e a coluna "empresa" diz por que ele não aparece na tela.
SELECT f.created_at,
       f.nome,
       f.cpf,
       f.empresa_id,
       coalesce(e.nome, '(SEM EMPRESA — invisível no app)') AS empresa
FROM public.funcionarios f
LEFT JOIN public.empresa_config e ON e.id = f.empresa_id
ORDER BY f.created_at DESC
LIMIT 20;


-- 1.2  Quantos estão órfãos (sem empresa)? Estes existem e não aparecem.
SELECT count(*) AS funcionarios_sem_empresa
FROM public.funcionarios
WHERE empresa_id IS NULL;


-- 1.3  Procure pelo nome exato que você cadastrou.
--      Troque ADRIAN pelo trecho do nome. Vazio = não chegou ao banco.
SELECT f.created_at, f.nome, f.cpf, coalesce(e.nome, '(SEM EMPRESA)') AS empresa
FROM public.funcionarios f
LEFT JOIN public.empresa_config e ON e.id = f.empresa_id
WHERE unaccent(lower(f.nome)) LIKE unaccent(lower('%ADRIAN%'))
ORDER BY f.created_at DESC;
-- Se a extensão unaccent não existir neste banco, use a versão simples:
-- WHERE lower(f.nome) LIKE lower('%ADRIAN%')


-- ---------------------------------------------------------------------
-- PARTE 2 — CONSERTO (só se a 1.2 tiver dado mais que zero)
--
-- Vincula os órfãos a uma empresa. TROQUE o id abaixo pelo da empresa
-- correta — o da G91 NORDESTE aparece na barra de endereço do aplicativo,
-- em ?empresa_id=...
--
-- Confira antes com o SELECT, depois rode o UPDATE.
-- ---------------------------------------------------------------------

-- Ver quem seria alterado:
-- SELECT id, nome, cpf, created_at FROM public.funcionarios WHERE empresa_id IS NULL;

-- Aplicar:
-- UPDATE public.funcionarios
-- SET empresa_id = '40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid
-- WHERE empresa_id IS NULL;


-- ---------------------------------------------------------------------
-- PARTE 3 — EVITAR QUE VOLTE A ACONTECER (opcional, recomendado)
--
-- O aplicativo passou a recusar cadastro sem empresa ativa. Esta trava no
-- banco fecha o mesmo buraco para qualquer outro caminho de escrita.
--
-- Rode SOMENTE depois da PARTE 2, senão as linhas órfãs impedem a criação
-- da restrição.
-- ---------------------------------------------------------------------

-- ALTER TABLE public.funcionarios
--   ALTER COLUMN empresa_id SET NOT NULL;
