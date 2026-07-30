-- ============================================================================
-- Cria o bucket das fotos de inspeção
-- ============================================================================
-- As policies de storage.objects para 'inspecoes-fotos' já existiam — select,
-- insert, update e delete, cobrindo super admin, empresa do profile e árvore da
-- empresa — mas o bucket nunca foi criado. Regras de acesso apontando para um
-- lugar que não existe.
--
-- Era por isso que NENHUMA inspeção do sistema tinha foto: confirmado por
-- consulta, foto_antes_path estava vazio em todos os registros de todas as
-- empresas. Todo upload falhava com "Bucket not found".
--
-- Terceira vez que isto acontece (materiais, logo da empresa e agora inspeções).
-- Ao mexer em storage, criar bucket e policies na mesma migration.
--
-- Limite de 8 MB por arquivo, igual ao que o aplicativo valida.
-- Aplicada em 30/07/2026 via MCP.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspecoes-fotos',
  'inspecoes-fotos',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
