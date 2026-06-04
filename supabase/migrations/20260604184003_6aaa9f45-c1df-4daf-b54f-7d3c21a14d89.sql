
-- aso_setores
CREATE TABLE public.aso_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_setores TO authenticated;
GRANT ALL ON public.aso_setores TO service_role;
ALTER TABLE public.aso_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_setores_select" ON public.aso_setores FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_setores_insert" ON public.aso_setores FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_setores_update" ON public.aso_setores FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_setores_delete" ON public.aso_setores FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_aso_setores_uat BEFORE UPDATE ON public.aso_setores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- aso_funcoes
CREATE TABLE public.aso_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  setor_id uuid REFERENCES public.aso_setores(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cbo text,
  descricao_atividades text,
  exige_nr35 boolean NOT NULL DEFAULT false,
  exige_nr10 boolean NOT NULL DEFAULT false,
  exige_nr33 boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_funcoes TO authenticated;
GRANT ALL ON public.aso_funcoes TO service_role;
ALTER TABLE public.aso_funcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_funcoes_select" ON public.aso_funcoes FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_funcoes_insert" ON public.aso_funcoes FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_funcoes_update" ON public.aso_funcoes FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_funcoes_delete" ON public.aso_funcoes FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_aso_funcoes_uat BEFORE UPDATE ON public.aso_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- aso_riscos_funcao
CREATE TABLE public.aso_riscos_funcao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  funcao_id uuid NOT NULL REFERENCES public.aso_funcoes(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  descricao text NOT NULL,
  fonte_geradora text,
  possiveis_danos text,
  medidas_controle text,
  aplica_aso boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_riscos_funcao TO authenticated;
GRANT ALL ON public.aso_riscos_funcao TO service_role;
ALTER TABLE public.aso_riscos_funcao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_riscos_funcao_select" ON public.aso_riscos_funcao FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_riscos_funcao_insert" ON public.aso_riscos_funcao FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_riscos_funcao_update" ON public.aso_riscos_funcao FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_riscos_funcao_delete" ON public.aso_riscos_funcao FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_aso_riscos_funcao_uat BEFORE UPDATE ON public.aso_riscos_funcao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_aso_funcoes_empresa ON public.aso_funcoes(empresa_id);
CREATE INDEX idx_aso_setores_empresa ON public.aso_setores(empresa_id);
CREATE INDEX idx_aso_riscos_funcao_funcao ON public.aso_riscos_funcao(funcao_id);
