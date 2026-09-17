-- Aviso de vencimento também por WhatsApp.
--
-- A `alertas-vencimento-sst` roda uma vez por dia e manda um e-mail por empresa
-- com o que venceu e o que está para vencer. E-mail de resumo diário é o tipo
-- de mensagem que se acumula sem ser aberta — o WhatsApp é lido. Os dois
-- convivem: o e-mail leva a tabela inteira, o WhatsApp leva o número e o empurrão
-- para abrir o sistema.
--
-- Fica desligado por padrão. Mensagem que a empresa inicia é cobrada por
-- conversa pela Meta, e ninguém deve começar a pagar por uma migration.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS alertas_ativos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS numeros_alerta TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_alerta TEXT,
  ADD COLUMN IF NOT EXISTS template_alerta_idioma TEXT NOT NULL DEFAULT 'pt_BR';

COMMENT ON COLUMN public.whatsapp_config.alertas_ativos IS
  'Manda o resumo diário de vencimentos por WhatsApp, além do e-mail. Desligado por padrão: template é cobrado por conversa.';
COMMENT ON COLUMN public.whatsapp_config.numeros_alerta IS
  'Quem recebe o resumo de vencimentos por WhatsApp. Números com DDI, um por item.';
COMMENT ON COLUMN public.whatsapp_config.template_alerta IS
  'Nome do template aprovado na Meta usado no resumo. Sem ele o aviso não sai: fora da janela de 24h só template vale.';
