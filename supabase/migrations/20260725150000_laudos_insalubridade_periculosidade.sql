-- Laudos técnicos de Insalubridade (NR-15) e Periculosidade (NR-16)

CREATE TABLE IF NOT EXISTS public.laudos_insalubridade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  setor text,
  funcao text,
  titulo text NOT NULL,
  data_avaliacao date,
  data_emissao date,
  agentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  grau_conclusao text NOT NULL DEFAULT 'nenhum' CHECK (grau_conclusao IN ('nenhum','minimo','medio','maximo')),
  percentual_aplicavel numeric NOT NULL DEFAULT 0,
  caracterizado boolean NOT NULL DEFAULT false,
  base_legal text,
  metodologia text,
  fundamentacao text,
  recomendacoes text,
  responsavel_tecnico_nome text,
  responsavel_tecnico_registro text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','emitido','arquivado')),
  versao integer NOT NULL DEFAULT 1,
  pdf_gerado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laudos_insalubridade_empresa ON public.laudos_insalubridade(empresa_id);
CREATE INDEX IF NOT EXISTS idx_laudos_insalubridade_funcionario ON public.laudos_insalubridade(funcionario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laudos_insalubridade TO authenticated;
GRANT ALL ON public.laudos_insalubridade TO service_role;

ALTER TABLE public.laudos_insalubridade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laudos_insalubridade_select" ON public.laudos_insalubridade FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_insalubridade_insert" ON public.laudos_insalubridade FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_insalubridade_update" ON public.laudos_insalubridade FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_insalubridade_delete" ON public.laudos_insalubridade FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

DROP TRIGGER IF EXISTS trg_laudos_insalubridade_updated_at ON public.laudos_insalubridade;
CREATE TRIGGER trg_laudos_insalubridade_updated_at
BEFORE UPDATE ON public.laudos_insalubridade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Periculosidade (NR-16)

CREATE TABLE IF NOT EXISTS public.laudos_periculosidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  setor text,
  funcao text,
  titulo text NOT NULL,
  data_avaliacao date,
  data_emissao date,
  atividades jsonb NOT NULL DEFAULT '[]'::jsonb,
  caracterizado boolean NOT NULL DEFAULT false,
  percentual_aplicavel numeric NOT NULL DEFAULT 30,
  base_legal text,
  metodologia text,
  fundamentacao text,
  recomendacoes text,
  responsavel_tecnico_nome text,
  responsavel_tecnico_registro text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','emitido','arquivado')),
  versao integer NOT NULL DEFAULT 1,
  pdf_gerado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laudos_periculosidade_empresa ON public.laudos_periculosidade(empresa_id);
CREATE INDEX IF NOT EXISTS idx_laudos_periculosidade_funcionario ON public.laudos_periculosidade(funcionario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laudos_periculosidade TO authenticated;
GRANT ALL ON public.laudos_periculosidade TO service_role;

ALTER TABLE public.laudos_periculosidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laudos_periculosidade_select" ON public.laudos_periculosidade FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_periculosidade_insert" ON public.laudos_periculosidade FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_periculosidade_update" ON public.laudos_periculosidade FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "laudos_periculosidade_delete" ON public.laudos_periculosidade FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

DROP TRIGGER IF EXISTS trg_laudos_periculosidade_updated_at ON public.laudos_periculosidade;
CREATE TRIGGER trg_laudos_periculosidade_updated_at
BEFORE UPDATE ON public.laudos_periculosidade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
