-- =====================================================================
-- conformidades.trecho_norma — o texto da norma tinha onde nascer e não
-- tinha onde morar
--
-- A função de IA sempre devolveu quatro campos: referência, gravidade, ação
-- corretiva e `trecho_norma` (o texto resumido do que a norma exige). Os três
-- primeiros iam para o formulário e para o banco. O quarto aparecia num aviso
-- de canto de tela que some em segundos, e acabava ali — não havia campo na
-- tela nem coluna na tabela.
--
-- Era isso que o usuário via como "não puxa os detalhes da norma": puxava, e
-- descartava. E num relatório de inspeção esse é justamente o trecho que
-- sustenta a autuação diante de quem for questionar.
--
-- Já aplicada no banco de produção nesta sessão.
-- =====================================================================

ALTER TABLE public.conformidades
  ADD COLUMN IF NOT EXISTS trecho_norma text;

COMMENT ON COLUMN public.conformidades.trecho_norma IS
  'Texto resumido do requisito da(s) norma(s) citada(s) em referencia_normativa. Preenchido pela sugestão de IA e editável pelo responsável técnico.';
