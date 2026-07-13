
ALTER TABLE public.solicitacoes_materiais_itens
  ADD COLUMN IF NOT EXISTS imagem_path text,
  ADD COLUMN IF NOT EXISTS imagem_url_legado text,
  ADD COLUMN IF NOT EXISTS imagem_nome text,
  ADD COLUMN IF NOT EXISTS imagem_tipo text,
  ADD COLUMN IF NOT EXISTS imagem_tamanho integer;

-- Storage policies: usuário só acessa arquivos dentro da própria árvore de empresa
DROP POLICY IF EXISTS "solic_mat_img_select" ON storage.objects;
DROP POLICY IF EXISTS "solic_mat_img_insert" ON storage.objects;
DROP POLICY IF EXISTS "solic_mat_img_update" ON storage.objects;
DROP POLICY IF EXISTS "solic_mat_img_delete" ON storage.objects;

CREATE POLICY "solic_mat_img_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'solicitacoes-materiais-imagens'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "solic_mat_img_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'solicitacoes-materiais-imagens'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "solic_mat_img_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'solicitacoes-materiais-imagens'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "solic_mat_img_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'solicitacoes-materiais-imagens'
  AND (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);
