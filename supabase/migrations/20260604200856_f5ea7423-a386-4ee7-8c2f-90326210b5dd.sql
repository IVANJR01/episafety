
-- ============ PCMSO ============
CREATE TABLE IF NOT EXISTS public.pcmso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  data_elaboracao date,
  data_validade date,
  medico_responsavel_id uuid REFERENCES public.aso_medicos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pcmso TO authenticated;
GRANT ALL ON public.pcmso TO service_role;
ALTER TABLE public.pcmso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcmso_company_select" ON public.pcmso FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pcmso_company_insert" ON public.pcmso FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pcmso_company_update" ON public.pcmso FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pcmso_company_delete" ON public.pcmso FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_pcmso_updated BEFORE UPDATE ON public.pcmso FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ GHE/GES ============
CREATE TABLE IF NOT EXISTS public.ghe_ges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  pcmso_id uuid REFERENCES public.pcmso(id) ON DELETE SET NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  setor text,
  descricao text,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ghe_ges_empresa ON public.ghe_ges(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghe_ges TO authenticated;
GRANT ALL ON public.ghe_ges TO service_role;
ALTER TABLE public.ghe_ges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ghe_ges_select" ON public.ghe_ges FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_ges_insert" ON public.ghe_ges FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_ges_update" ON public.ghe_ges FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_ges_delete" ON public.ghe_ges FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_ghe_ges_updated BEFORE UPDATE ON public.ghe_ges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ GHE Funções ============
CREATE TABLE IF NOT EXISTS public.ghe_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ghe_id uuid NOT NULL REFERENCES public.ghe_ges(id) ON DELETE CASCADE,
  nome_funcao text NOT NULL,
  cbo text,
  descricao_atividade text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ghe_funcoes_ghe ON public.ghe_funcoes(ghe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghe_funcoes TO authenticated;
GRANT ALL ON public.ghe_funcoes TO service_role;
ALTER TABLE public.ghe_funcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ghe_funcoes_select" ON public.ghe_funcoes FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_funcoes_insert" ON public.ghe_funcoes FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_funcoes_update" ON public.ghe_funcoes FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_funcoes_delete" ON public.ghe_funcoes FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ GHE Riscos ============
CREATE TABLE IF NOT EXISTS public.ghe_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ghe_id uuid NOT NULL REFERENCES public.ghe_ges(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  tipo_agente text,
  perigo_fonte text,
  exposicao text,
  possiveis_lesoes text,
  limite_exposicao text,
  aparece_aso boolean NOT NULL DEFAULT true,
  texto_aso text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ghe_riscos_ghe ON public.ghe_riscos(ghe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghe_riscos TO authenticated;
GRANT ALL ON public.ghe_riscos TO service_role;
ALTER TABLE public.ghe_riscos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ghe_riscos_select" ON public.ghe_riscos FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_riscos_insert" ON public.ghe_riscos FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_riscos_update" ON public.ghe_riscos FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_riscos_delete" ON public.ghe_riscos FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ GHE Exames ============
CREATE TABLE IF NOT EXISTS public.ghe_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ghe_id uuid NOT NULL REFERENCES public.ghe_ges(id) ON DELETE CASCADE,
  codigo_exame text,
  nome_exame text NOT NULL,
  tipo_exame text DEFAULT 'clinico',
  obrigatorio boolean NOT NULL DEFAULT true,
  aparece_aso boolean NOT NULL DEFAULT true,
  admissional boolean NOT NULL DEFAULT true,
  periodico boolean NOT NULL DEFAULT true,
  retorno_trabalho boolean NOT NULL DEFAULT true,
  mudanca_risco boolean NOT NULL DEFAULT true,
  mudanca_funcao boolean NOT NULL DEFAULT true,
  demissional boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ghe_exames_ghe ON public.ghe_exames(ghe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghe_exames TO authenticated;
GRANT ALL ON public.ghe_exames TO service_role;
ALTER TABLE public.ghe_exames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ghe_exames_select" ON public.ghe_exames FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_exames_insert" ON public.ghe_exames FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_exames_update" ON public.ghe_exames FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ghe_exames_delete" ON public.ghe_exames FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ Funcionários: ghe_id ============
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS ghe_id uuid REFERENCES public.ghe_ges(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_funcionarios_ghe ON public.funcionarios(ghe_id);

-- ============ ASOs: ghe_id, pcmso_id, snapshots ============
ALTER TABLE public.asos ADD COLUMN IF NOT EXISTS ghe_id uuid REFERENCES public.ghe_ges(id) ON DELETE SET NULL;
ALTER TABLE public.asos ADD COLUMN IF NOT EXISTS pcmso_id uuid REFERENCES public.pcmso(id) ON DELETE SET NULL;
ALTER TABLE public.asos ADD COLUMN IF NOT EXISTS riscos_snapshot jsonb;
ALTER TABLE public.asos ADD COLUMN IF NOT EXISTS exames_snapshot jsonb;

-- Ampliar tipo_exame para incluir mudanca_funcao
ALTER TABLE public.asos DROP CONSTRAINT IF EXISTS asos_tipo_exame_check;
ALTER TABLE public.asos ADD CONSTRAINT asos_tipo_exame_check
  CHECK (tipo_exame = ANY (ARRAY['admissional','periodico','retorno','mudanca_risco','mudanca_funcao','demissional']));
