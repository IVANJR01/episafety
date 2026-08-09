-- =====================================================================
-- OBRAS: por que aparece "Obra removida" nas inspeções
--
-- Rode este arquivo no SQL Editor do Supabase (painel do projeto).
-- A PARTE 1 só lê e mostra o estado; a PARTE 2 aplica a correção.
-- Leia o resultado da PARTE 1 antes de rodar a PARTE 2.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE 1 — DIAGNÓSTICO (só leitura, não altera nada)
-- ---------------------------------------------------------------------

-- 1.1  As obras existem mesmo? Quantas, e de quais empresas?
--      Se vier vazio, as obras não estão no banco.
--      Se vier com linhas, elas existem e o problema é de permissão.
SELECT o.empresa_id,
       e.nome AS empresa,
       count(*) AS total_obras,
       count(*) FILTER (WHERE o.status = 'ATIVA') AS ativas
FROM public.obras o
LEFT JOIN public.empresa_config e ON e.id = o.empresa_id
GROUP BY o.empresa_id, e.nome
ORDER BY e.nome;


-- 1.2  As inspeções apontam para obras que existem?
--      "orfa" = TRUE significa obra_id apontando para linha inexistente.
--      Se vier tudo FALSE, nenhuma obra foi apagada — é permissão de leitura.
SELECT (o.id IS NULL) AS orfa,
       count(*) AS inspecoes
FROM public.conformidades c
LEFT JOIN public.obras o ON o.id = c.obra_id
WHERE c.obra_id IS NOT NULL
GROUP BY 1;


-- 1.3  A obra da inspeção está na MESMA empresa da inspeção?
--      Se aparecerem linhas aqui, a obra existe mas mora em outra
--      empresa — e todo filtro por empresa deixa ela de fora.
SELECT c.empresa_id AS empresa_da_inspecao,
       o.empresa_id AS empresa_da_obra,
       count(*)     AS inspecoes
FROM public.conformidades c
JOIN public.obras o ON o.id = c.obra_id
WHERE o.empresa_id IS DISTINCT FROM c.empresa_id
GROUP BY 1, 2;


-- 1.4  Quais políticas de RLS estão valendo hoje em `obras`?
--      É isto que decide se o aplicativo consegue ler e gravar.
SELECT policyname, cmd, qual AS condicao_leitura, with_check AS condicao_escrita
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'obras'
ORDER BY cmd, policyname;


-- 1.5  A função que as políticas usam existe?
--      Se vier vazio, as políticas que dependem dela recusam tudo.
SELECT proname AS funcao
FROM pg_proc
WHERE proname = 'get_user_empresa_ids';


-- ---------------------------------------------------------------------
-- PARTE 2 — CORREÇÃO
--
-- Reescreve as quatro políticas de `obras` no mesmo padrão que o resto
-- do sistema usa. É idempotente: pode rodar de novo sem efeito colateral.
--
-- Este é o mesmo conteúdo da migration que já está no repositório em
-- supabase/migrations/20260808080000_fix_obras_rls_get_user_empresa_ids.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

CREATE POLICY "Obras select por empresa" ON public.obras
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras insert por empresa" ON public.obras
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras update por empresa" ON public.obras
FOR UPDATE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras delete por empresa" ON public.obras
FOR DELETE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);


-- ---------------------------------------------------------------------
-- PARTE 3 — SÓ SE A CONSULTA 1.3 TIVER MOSTRADO LINHAS
--
-- Caso a obra esteja numa empresa diferente da inspeção, alinhar as duas
-- resolve de vez. Rode primeiro o SELECT para ver o que seria alterado;
-- só depois troque pelo UPDATE.
-- ---------------------------------------------------------------------

-- Ver o que mudaria:
-- SELECT o.id, o.nome, o.empresa_id AS de, c.empresa_id AS para
-- FROM public.obras o
-- JOIN public.conformidades c ON c.obra_id = o.id
-- WHERE o.empresa_id IS DISTINCT FROM c.empresa_id
-- GROUP BY o.id, o.nome, o.empresa_id, c.empresa_id;

-- Aplicar (descomente só depois de conferir o SELECT acima):
-- UPDATE public.obras o
-- SET empresa_id = sub.empresa_id
-- FROM (
--   SELECT c.obra_id, min(c.empresa_id::text)::uuid AS empresa_id
--   FROM public.conformidades c
--   WHERE c.obra_id IS NOT NULL
--   GROUP BY c.obra_id
--   HAVING count(DISTINCT c.empresa_id) = 1
-- ) sub
-- WHERE o.id = sub.obra_id AND o.empresa_id IS DISTINCT FROM sub.empresa_id;
