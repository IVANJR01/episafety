-- Adiciona campo para email de compras da empresa
-- Permite especificar um email dedicado para receber as notificações de solicitação de materiais

ALTER TABLE IF EXISTS empresa_config
ADD COLUMN IF NOT EXISTS email_compras TEXT;

-- Comentário para documentar o campo
COMMENT ON COLUMN empresa_config.email_compras IS
  'Email para receber notificações de solicitação de materiais. Se não preenchido, usa o email principal da empresa.';

-- Criar índice para buscas rápidas (opcional, para se necessário filtrar por email de compras)
CREATE INDEX IF NOT EXISTS idx_empresa_config_email_compras
  ON empresa_config(email_compras)
  WHERE email_compras IS NOT NULL;
