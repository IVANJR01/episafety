
-- 1) Campos técnicos complementares no GES/GHE
ALTER TABLE public.ghe_ges
  ADD COLUMN IF NOT EXISTS descricao_atividades text,
  ADD COLUMN IF NOT EXISTS trabalhadores_expostos integer,
  ADD COLUMN IF NOT EXISTS frequencia_exposicao text,
  ADD COLUMN IF NOT EXISTS tempo_exposicao text,
  ADD COLUMN IF NOT EXISTS severidade integer,
  ADD COLUMN IF NOT EXISTS probabilidade integer,
  ADD COLUMN IF NOT EXISTS nivel_risco text,
  ADD COLUMN IF NOT EXISTS medidas_controle_existentes text,
  ADD COLUMN IF NOT EXISTS medidas_controle_recomendadas text,
  ADD COLUMN IF NOT EXISTS epcs text,
  ADD COLUMN IF NOT EXISTS capacitacoes_obrigatorias text,
  ADD COLUMN IF NOT EXISTS observacoes_tecnicas text;

-- 2) Ordens de Serviço SST
CREATE TABLE IF NOT EXISTS public.ordens_servico_sst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ghe_id uuid REFERENCES public.ghe_ges(id) ON DELETE SET NULL,
  funcao_id uuid,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  escopo text NOT NULL CHECK (escopo IN ('funcionario','funcao','ghe')),
  titulo text NOT NULL,
  atividades text,
  riscos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  epis_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  medidas_preventivas text,
  proibicoes text,
  procedimentos_acidente text,
  responsabilidades text,
  responsavel_tecnico_nome text,
  responsavel_tecnico_registro text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','emitida','arquivada')),
  versao integer NOT NULL DEFAULT 1,
  data_emissao date,
  pdf_hash text,
  pdf_drive_view_link text,
  pdf_gerado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_sst_empresa ON public.ordens_servico_sst(empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_sst_ghe ON public.ordens_servico_sst(ghe_id);
CREATE INDEX IF NOT EXISTS idx_os_sst_funcionario ON public.ordens_servico_sst(funcionario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico_sst TO authenticated;
GRANT ALL ON public.ordens_servico_sst TO service_role;

ALTER TABLE public.ordens_servico_sst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_sst_select" ON public.ordens_servico_sst FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "os_sst_insert" ON public.ordens_servico_sst FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "os_sst_update" ON public.ordens_servico_sst FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "os_sst_delete" ON public.ordens_servico_sst FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- 3) Assinaturas
CREATE TABLE IF NOT EXISTS public.ordens_servico_sst_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico_sst(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  assinatura_url text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_os_sst_ass_os ON public.ordens_servico_sst_assinaturas(os_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico_sst_assinaturas TO authenticated;
GRANT ALL ON public.ordens_servico_sst_assinaturas TO service_role;

ALTER TABLE public.ordens_servico_sst_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_sst_ass_all" ON public.ordens_servico_sst_assinaturas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- 4) Versões de PDF
CREATE TABLE IF NOT EXISTS public.ordens_servico_sst_pdf_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico_sst(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  versao integer NOT NULL,
  pdf_hash text NOT NULL,
  pdf_drive_view_link text,
  bucket text,
  path text,
  tamanho_bytes integer,
  gerado_por uuid,
  gerado_por_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_os_sst_pdf_os ON public.ordens_servico_sst_pdf_versoes(os_id);

GRANT SELECT, INSERT ON public.ordens_servico_sst_pdf_versoes TO authenticated;
GRANT ALL ON public.ordens_servico_sst_pdf_versoes TO service_role;

ALTER TABLE public.ordens_servico_sst_pdf_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_sst_pdf_select" ON public.ordens_servico_sst_pdf_versoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "os_sst_pdf_insert" ON public.ordens_servico_sst_pdf_versoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- 5) updated_at trigger
DROP TRIGGER IF EXISTS trg_os_sst_updated_at ON public.ordens_servico_sst;
CREATE TRIGGER trg_os_sst_updated_at
BEFORE UPDATE ON public.ordens_servico_sst
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
