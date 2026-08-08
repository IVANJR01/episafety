-- =====================================================================
-- Arquivo Digital SST — alertas automáticos por prazo
--
-- O Painel de Vencimentos (rodada anterior) só avisa quem abre a tela.
-- Esta migration liga o "automático": um cron diário chama a edge
-- function `alertas-vencimento-sst`, que manda um e-mail por empresa
-- resumindo o que está vencido/vencendo, sem ninguém precisar ir olhar.
--
-- `internal_document_types.dias_aviso` (integer[], default
-- {60,30,15,7,1}) já existe desde a migration do núcleo e foi semeada em
-- todo tipo criado até agora (ASO, Cursos, Ficha de EPI, OS) — mas nunca
-- foi lida por nada. Esta é a primeira coisa que consome esse campo.
--
-- Throttle sem tabela nova: em vez de mandar e-mail todo santo dia
-- enquanto um documento estiver "vence_em_breve" (spam por 60 dias),
-- só entra no e-mail no dia EXATO em que dias_para_vencer bate com um
-- dos marcos de dias_aviso — um aviso por marco, não um por dia. Já
-- "vencido" entra em todo e-mail, todo dia, até alguém resolver — esse
-- lembrete recorrente é intencional. Limite consciente: se o cron não
-- rodar exatamente naquele dia (queda, deploy), aquele marco específico
-- passa em branco, sem re-tentativa — aceitável para um e-mail de
-- cabeça-up, não uma auditoria.
-- =====================================================================

ALTER TABLE public.empresa_config ADD COLUMN IF NOT EXISTS email_sst text;

COMMENT ON COLUMN public.empresa_config.email_sst IS
  'Destinatário(s) do resumo diário de vencimentos do Arquivo Digital SST (ASO, capacitações, ficha de EPI, ordem de serviço). Vazio = nenhum alerta enviado para essa empresa. Mesmo formato de email_compras (lista separada por vírgula/linha).';

-- Segredo compartilhado entre o cron e a edge function, gerado uma vez e
-- guardado no Vault (não em texto no git). A edge function confere esse
-- valor no header x-cron-secret antes de processar qualquer coisa.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_alertas_vencimento_secret') THEN
    PERFORM vault.create_secret(
      gen_random_uuid()::text,
      'cron_alertas_vencimento_secret',
      'Segredo compartilhado entre o cron de alertas de vencimento do Arquivo Digital SST e a edge function alertas-vencimento-sst. Precisa ser copiado manualmente para o secret CRON_ALERTAS_SECRET da edge function após aplicar esta migration.'
    );
  END IF;
END $$;

-- cron.schedule faz upsert pelo nome do job — reaplicar esta migration
-- não duplica o agendamento.
SELECT cron.schedule(
  'arquivo-digital-alertas-vencimento',
  '0 11 * * *', -- 11:00 UTC ~ 08:00 horário de Brasília
  $cron$
  SELECT net.http_post(
    url := 'https://estmuducawmftvpbeutm.supabase.co/functions/v1/alertas-vencimento-sst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_alertas_vencimento_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
