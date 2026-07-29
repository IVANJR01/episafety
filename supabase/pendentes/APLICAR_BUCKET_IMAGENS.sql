-- ============================================================================
-- Cria o bucket das imagens da Solicitação de Materiais
-- ============================================================================
-- PROBLEMA
--
-- Anexar uma foto ao item e salvar devolvia:
--
--   Erro ao salvar — Bucket not found
--
-- A migration 20260713132827 criou as POLICIES de storage.objects para o bucket
-- 'solicitacoes-materiais-imagens' — select, insert, update e delete, com o
-- isolamento por árvore de empresa — mas nunca criou o bucket em si. Ficaram
-- regras de acesso para um lugar que não existe.
--
-- Como o upload acontecia dentro do salvamento, a falha derrubava a solicitação
-- inteira: perdia-se título, itens e quantidades por causa de uma foto opcional.
-- (Isso foi corrigido no aplicativo em separado — a foto que falha agora só
-- avisa. Esta migration resolve a causa.)
--
-- SOBRE O BUCKET
--
-- Privado (public = false): as imagens são de material solicitado por empresa e
-- o acesso já é controlado pelas policies existentes, que usam
-- is_in_user_company_tree sobre o primeiro segmento do caminho (empresa_id).
-- Público deixaria qualquer um com a URL ver arquivo de qualquer empresa.
--
-- Limite de 20 MB por arquivo, igual ao que a tela informa ao usuário.
--
-- Seguro rodar mais de uma vez: ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'solicitacoes-materiais-imagens',
  'solicitacoes-materiais-imagens',
  false,
  20971520, -- 20 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
