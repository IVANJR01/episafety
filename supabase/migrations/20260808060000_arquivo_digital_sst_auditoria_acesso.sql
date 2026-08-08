-- =====================================================================
-- Arquivo Digital SST — auditoria de acesso
--
-- Hoje só fica registrado quem ENVIOU cada versão (created_by em
-- internal_document_versions). Falta o outro lado: quem ABRIU o
-- documento depois, e quando.
--
-- Não dá pra usar o audit_log genérico (audit_trigger(), migration
-- 20260808000000) — ele só dispara em INSERT/UPDATE/DELETE de linha.
-- Abrir um PDF não muda nenhuma linha (só gera uma signed URL), então
-- precisa de um INSERT explícito no momento certo, não um trigger.
--
-- RLS aqui segue o mesmo padrão que internal_documents/
-- internal_document_types já usam (get_user_empresa_ids() + has_role
-- admin) — de propósito NÃO o padrão mais restrito do audit_log (que
-- só libera leitura pra super admin/principal via is_principal/
-- is_in_user_company_tree). Misturar os dois padrões de RLS dentro da
-- mesma feature seria inconsistente sem necessidade: quem já vê o
-- documento em si vê também quem mais olhou.
-- =====================================================================

CREATE TABLE public.document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.internal_documents(id) ON DELETE CASCADE,
  versao_id uuid REFERENCES public.internal_document_versions(id) ON DELETE SET NULL,
  empresa_id uuid NOT NULL,
  colaborador_id uuid,
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dal_documento ON public.document_access_log(documento_id);
CREATE INDEX idx_dal_empresa_data ON public.document_access_log(empresa_id, created_at DESC);
CREATE INDEX idx_dal_versao ON public.document_access_log(versao_id);

COMMENT ON TABLE public.document_access_log IS
  'Um registro por vez que alguém abre um documento do Arquivo Digital (signed URL gerada). Não distingue "visualizar" de "baixar" — o navegador decide isso, não a aplicação.';

ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;

-- Cada usuário só registra o próprio acesso, dentro do escopo da própria empresa.
CREATE POLICY dal_insert ON public.document_access_log FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Mesma visibilidade de quem já vê o documento em si.
CREATE POLICY dal_select ON public.document_access_log FOR SELECT TO authenticated
  USING (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))) OR has_role(auth.uid(), 'admin'::app_role));

-- Registro de acesso não se edita nem se apaga.
