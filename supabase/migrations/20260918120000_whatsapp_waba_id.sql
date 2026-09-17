-- Identificador da conta do WhatsApp Business (WABA) na Meta.
--
-- É por ele que se pergunta à Meta quais templates estão aprovados. Não dá
-- para deduzir do phone_number_id: uma conta pode ter várias linhas, e a lista
-- de templates é da conta, não da linha.
--
-- Fica na tabela, e não num secret da function, porque é por empresa: com duas
-- empresas atendendo por linhas diferentes, um secret único entregaria à
-- segunda os templates da primeira. Não é segredo — é um identificador, do
-- mesmo tipo do phone_number_id que já está aqui.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS waba_id TEXT;

COMMENT ON COLUMN public.whatsapp_config.waba_id IS
  'ID da conta do WhatsApp Business na Meta. Usado para listar os templates aprovados.';
