-- =====================================================================
-- Realtime nas tabelas do atendimento por WhatsApp
--
-- A tela de atendimento (/comercial/atendimento) usa o mesmo canal por
-- tabela do resto do sistema (src/lib/realtimeTabelas.ts). Sem a tabela na
-- publicação, o canal abre, conecta e nunca recebe nada — a conversa só
-- apareceria ao recarregar a página, que numa tela de atendimento é o
-- mesmo que não funcionar: o cliente responde e a mensagem não chega.
--
-- REPLICA IDENTITY FULL pelo mesmo motivo da migration 20260815120000: sem
-- ela o evento de UPDATE chega só com a chave primária, a RLS do Realtime
-- não consegue avaliar se aquele usuário pode ver a linha, e o evento é
-- descartado em silêncio. Aqui isso apareceria como a conversa que alguém
-- assumiu continuar marcada como "IA respondendo" na tela do colega.
-- =====================================================================

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['whatsapp_contatos', 'whatsapp_mensagens'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
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
