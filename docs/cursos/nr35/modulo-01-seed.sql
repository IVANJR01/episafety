-- =====================================================================
-- Curso NR-35 — Trabalho em Altura
-- Módulo 01 — Introdução ao Trabalho em Altura
--
-- Cadastra o curso, o módulo e a questão oficial do roteiro (Cena 09)
-- nas tabelas do Portal de Treinamentos.
--
-- COMO USAR
--   1. Suba o MP4 do módulo (ou publique no Google Drive) e copie a URL.
--   2. Substitua o valor de :video_url abaixo.
--   3. Rode no SQL Editor do Supabase (projeto estmuducawmftvpbeutm).
--
-- empresa_id = NULL  ->  curso global, visível para todas as empresas
-- (política "Authenticated read cursos_video" / "Authenticated read
--  videos_treinamento"). Para restringir a uma empresa, informe o UUID
-- dela em :empresa_id.
--
-- O script é idempotente: rodar de novo atualiza em vez de duplicar.
-- =====================================================================

\set video_url 'https://SUBSTITUA-PELA-URL-DO-VIDEO'
\set empresa_id NULL

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Curso
-- ---------------------------------------------------------------------
WITH curso AS (
  INSERT INTO public.cursos_video (id, titulo, descricao, pontuacao_minima, empresa_id)
  VALUES (
    '35a11000-0000-4000-8000-000000000001',
    'NR-35 — Trabalho em Altura',
    'Treinamento sobre trabalho em altura: conceito, identificação de riscos, '
    'planejamento, hierarquia da prevenção e responsabilidades.',
    70,
    :empresa_id
  )
  ON CONFLICT (id) DO UPDATE
    SET titulo           = EXCLUDED.titulo,
        descricao        = EXCLUDED.descricao,
        pontuacao_minima = EXCLUDED.pontuacao_minima,
        updated_at       = now()
  RETURNING id
)
SELECT id FROM curso;

-- ---------------------------------------------------------------------
-- 2. Módulo 01
-- ---------------------------------------------------------------------
INSERT INTO public.videos_treinamento (
  id, curso_id, ordem, titulo, descricao, video_url,
  duracao_segundos, pontuacao_minima, empresa_id
)
VALUES (
  '35a11000-0000-4000-8000-000000000101',
  '35a11000-0000-4000-8000-000000000001',
  1,
  'Módulo 01 — Introdução ao Trabalho em Altura',
  'Neste módulo, o aluno será introduzido aos fundamentos do trabalho em '
  'altura. Serão apresentados o conceito de trabalho em altura, exemplos de '
  'atividades realizadas em diferentes ambientes, perigos associados às quedas '
  'e a importância do planejamento e das medidas de prevenção. O conteúdo será '
  'desenvolvido por meio de situações simuladas, animações e exemplos '
  'práticos, permitindo que o aluno compreenda que a segurança deve começar '
  'antes mesmo do trabalhador acessar o local elevado.',
  :'video_url',
  2160,   -- 36 minutos
  70,
  :empresa_id
)
ON CONFLICT (id) DO UPDATE
  SET curso_id         = EXCLUDED.curso_id,
      ordem            = EXCLUDED.ordem,
      titulo           = EXCLUDED.titulo,
      descricao        = EXCLUDED.descricao,
      video_url        = EXCLUDED.video_url,
      duracao_segundos = EXCLUDED.duracao_segundos,
      pontuacao_minima = EXCLUDED.pontuacao_minima,
      updated_at       = now();

-- ---------------------------------------------------------------------
-- 3. Avaliação — questão oficial do roteiro (Cena 09)
-- ---------------------------------------------------------------------
DELETE FROM public.videos_perguntas
 WHERE video_id = '35a11000-0000-4000-8000-000000000101';

INSERT INTO public.videos_perguntas (
  video_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d,
  resposta_correta, ordem, empresa_id
)
VALUES (
  '35a11000-0000-4000-8000-000000000101',
  'O trabalhador deve iniciar a atividade?',
  'Sim, porque o serviço é rápido.',
  'Sim, desde que tenha capacete.',
  'Não. Primeiro deve avaliar a atividade e as medidas de prevenção necessárias.',
  'Sim, se estiver acompanhado.',
  'c',
  1,
  :empresa_id
);

COMMIT;

-- =====================================================================
-- OPCIONAL — banco complementar (docs/cursos/nr35/modulo-01-quiz.md).
-- Estas questões NÃO fazem parte do roteiro do vídeo. Rode este bloco
-- apenas se quiser ampliar a avaliação.
-- =====================================================================
-- BEGIN;
-- INSERT INTO public.videos_perguntas (
--   video_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d,
--   resposta_correta, ordem, empresa_id
-- ) VALUES
-- ('35a11000-0000-4000-8000-000000000101',
--  'Considera-se trabalho em altura a atividade realizada:',
--  'Em qualquer altura, desde que haja escada.',
--  'Acima de 2 metros do nível inferior, onde haja risco de queda.',
--  'Somente na construção civil.',
--  'Somente acima de 10 metros.',
--  'b', 2, NULL),
-- ('35a11000-0000-4000-8000-000000000101',
--  'Sobre a duração da tarefa, o módulo afirma que:',
--  'Tarefas de até cinco minutos dispensam planejamento.',
--  'O tempo necessário para realizar uma atividade não elimina o risco.',
--  'Somente tarefas longas exigem avaliação.',
--  'A duração define a necessidade de proteção.',
--  'b', 3, NULL),
-- ('35a11000-0000-4000-8000-000000000101',
--  'A hierarquia da prevenção apresentada no módulo, na ordem correta, é:',
--  'Minimizar as consequências, prevenir a queda, evitar a exposição.',
--  'Prevenir a queda, evitar a exposição, minimizar as consequências.',
--  'Evitar a exposição, prevenir a queda, minimizar as consequências.',
--  'Evitar a exposição, minimizar as consequências, prevenir a queda.',
--  'c', 4, NULL),
-- ('35a11000-0000-4000-8000-000000000101',
--  'Sobre a responsabilidade pela prevenção, o módulo afirma que:',
--  'Depende exclusivamente do trabalhador.',
--  'Depende exclusivamente do empregador.',
--  'Todos os envolvidos possuem responsabilidades dentro de suas atribuições.',
--  'Depende exclusivamente da supervisão.',
--  'c', 5, NULL),
-- ('35a11000-0000-4000-8000-000000000101',
--  'O planejamento da atividade em altura deve ocorrer:',
--  'Antes que o trabalhador esteja exposto ao perigo.',
--  'Durante a execução da atividade.',
--  'Após o término da atividade.',
--  'Somente quando houver acidente.',
--  'a', 6, NULL);
-- COMMIT;
