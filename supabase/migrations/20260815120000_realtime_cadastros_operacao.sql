-- =====================================================================
-- Realtime nas tabelas que as telas leem pelo hook compartilhado
--
-- Sintoma relatado: colaborador cadastrado pelo celular não aparecia na
-- busca do Almoxarifado, e só aparecia depois de apertar "atualizar".
--
-- Confirmado neste banco antes de mexer em qualquer coisa: os dois
-- cadastros mais recentes da G91 estavam gravados, na empresa certa e
-- dentro do escopo que a tela filtra (matriz + filiais da mesma árvore).
-- Ou seja, o cadastro nunca se perdeu. O que faltava era o aviso.
--
-- A publicação `supabase_realtime` tinha só videos_treinamento e
-- videos_visualizacao, e o código não abria canal nenhum (busca por
-- `postgres_changes` no repositório: zero ocorrências). Sem isso, a lista
-- só recarregava ao montar a tela, ao voltar o foco da janela ou ao
-- reconectar — tela aberta parada nunca ficava sabendo de nada.
--
-- REPLICA IDENTITY FULL: sem ela o evento de UPDATE/DELETE chega só com a
-- chave primária, e a RLS do Realtime não consegue avaliar se aquele
-- usuário pode ver a linha — o evento é descartado em silêncio, o que é
-- pior do que não ter Realtime, porque parece que está funcionando.
--
-- Já aplicada no banco de produção nesta sessão; fica aqui para o
-- histórico e para qualquer ambiente novo.
-- =====================================================================

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'funcionarios','epis','entregas','treinamentos','dds','exames','asos',
    'obras','ordens_servico','conformidades',
    'empresa_config','usuarios_liberados',
    'aso_setores','aso_funcoes',
    'ghe_ges','ghe_setores','ghe_funcoes',
    'sst_estabelecimentos','sst_ambientes','sst_setores','sst_processos',
    'sst_funcoes','sst_ges','sst_atividades','sst_exposicoes',
    'sst_perigos_catalogo',
    'pgr_inventario_itens','pgr_acoes'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Tabela ausente neste ambiente não derruba a migração inteira.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'ignorada (não existe): %', t;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
