-- ============================================================================
-- Cria o bucket da logo da empresa e alinha as permissões à empresa ativa
-- ============================================================================
-- PROBLEMA
--
-- Enviar a logo em Empresas / Unidades devolvia:
--
--   Erro ao enviar logo — Bucket not found
--
-- A migration 20260704161955 criou as quatro POLICIES de storage.objects para
-- o bucket 'company-logos' — select, insert, update e delete — mas nunca criou
-- o bucket. Ficaram regras de acesso para um lugar que não existe. É o mesmo
-- defeito que houve com 'solicitacoes-materiais-imagens'.
--
-- Só criar o bucket não bastaria: aquelas policies são anteriores ao modelo de
-- empresa ativa e só reconhecem get_user_empresa_id(uid) — a empresa do
-- próprio profile — ou has_role('admin'). Quem administra várias empresas e
-- troca a empresa ativa no seletor passaria do "Bucket not found" direto para
-- "new row violates row-level security policy".
--
-- SOLUÇÃO
--
-- Criar o bucket e recriar as policies com o mesmo padrão já em uso no bucket
-- das imagens de solicitação de materiais, que funciona para este caso:
-- is_super_admin, is_principal ou is_in_user_company_tree sobre o primeiro
-- segmento do caminho (o empresa_id). O caminho gravado pelo aplicativo é
-- `<empresa_id>/logo/logo_<timestamp>.<ext>`, então o primeiro segmento é o
-- que a regra precisa.
--
-- Os caminhos antigos continuam valendo: ninguém perde acesso que já tinha.
--
-- SOBRE O BUCKET
--
-- Privado (public = false): o acesso é controlado pelas policies e o
-- aplicativo já usa URL assinada para exibir. Limite de 5 MB por arquivo,
-- igual ao que a tela informa, e os mesmos formatos que ela aceita — incluindo
-- SVG, que a tela recomenda para fundo transparente.
--
-- Seguro rodar mais de uma vez: ON CONFLICT DO NOTHING e DROP POLICY IF EXISTS.
-- Não toca em nenhum dado existente.
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------ POLICIES
DROP POLICY IF EXISTS "company_logos_select_own_empresa" ON storage.objects;
CREATE POLICY "company_logos_select_own_empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "company_logos_insert_own_empresa" ON storage.objects;
CREATE POLICY "company_logos_insert_own_empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "company_logos_update_own_empresa" ON storage.objects;
CREATE POLICY "company_logos_update_own_empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "company_logos_delete_own_empresa" ON storage.objects;
CREATE POLICY "company_logos_delete_own_empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1]::uuid = public.get_user_empresa_id(auth.uid())
  )
);

COMMIT;
