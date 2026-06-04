
-- ============ MÉDICOS ============
CREATE TABLE public.aso_medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  crm text NOT NULL,
  uf_crm text,
  cpf text,
  email text,
  telefone text,
  assinatura_url text,
  carimbo_url text,
  responsavel_pcmso boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_medicos TO authenticated;
GRANT ALL ON public.aso_medicos TO service_role;
ALTER TABLE public.aso_medicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_medicos_super_admin" ON public.aso_medicos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "aso_medicos_principal" ON public.aso_medicos FOR ALL TO authenticated
  USING (public.is_principal(auth.uid())) WITH CHECK (public.is_principal(auth.uid()));
CREATE POLICY "aso_medicos_empresa_select" ON public.aso_medicos FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_medicos_empresa_write" ON public.aso_medicos FOR INSERT TO authenticated
  WITH CHECK (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_medicos_empresa_update" ON public.aso_medicos FOR UPDATE TO authenticated
  USING (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "aso_medicos_empresa_delete" ON public.aso_medicos FOR DELETE TO authenticated
  USING (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE INDEX idx_aso_medicos_empresa ON public.aso_medicos(empresa_id);
CREATE TRIGGER trg_aso_medicos_updated BEFORE UPDATE ON public.aso_medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATÁLOGO DE EXAMES ============
CREATE TABLE public.aso_exames_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  periodicidade text,
  risco_relacionado text,
  obrigatorio boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_exames_catalogo TO authenticated;
GRANT ALL ON public.aso_exames_catalogo TO service_role;
ALTER TABLE public.aso_exames_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_cat_super_admin" ON public.aso_exames_catalogo FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "aso_cat_empresa_all" ON public.aso_exames_catalogo FOR ALL TO authenticated
  USING (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (empresa_id IS NULL OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE INDEX idx_aso_cat_empresa ON public.aso_exames_catalogo(empresa_id);
CREATE TRIGGER trg_aso_cat_updated BEFORE UPDATE ON public.aso_exames_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NUMERAÇÃO POR EMPRESA ============
CREATE TABLE public.aso_numeracao (
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ano int NOT NULL,
  ultimo_seq int NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, ano)
);
GRANT SELECT, INSERT, UPDATE ON public.aso_numeracao TO authenticated;
GRANT ALL ON public.aso_numeracao TO service_role;
ALTER TABLE public.aso_numeracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_num_authenticated" ON public.aso_numeracao FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.gerar_numero_aso(_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ano int := EXTRACT(YEAR FROM now())::int;
  _seq int;
BEGIN
  INSERT INTO public.aso_numeracao (empresa_id, ano, ultimo_seq)
  VALUES (_empresa_id, _ano, 1)
  ON CONFLICT (empresa_id, ano) DO UPDATE
    SET ultimo_seq = public.aso_numeracao.ultimo_seq + 1
  RETURNING ultimo_seq INTO _seq;
  RETURN 'ASO-' || _ano::text || '-' || lpad(_seq::text, 4, '0');
END;
$$;

-- ============ ASOs ============
CREATE TABLE public.asos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  medico_id uuid REFERENCES public.aso_medicos(id) ON DELETE SET NULL,
  numero_aso text NOT NULL,
  tipo_exame text NOT NULL CHECK (tipo_exame IN ('admissional','periodico','retorno','mudanca_risco','demissional')),
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  validade_tipo text,
  data_vencimento date,
  status_aptidao text CHECK (status_aptidao IN ('apto','inapto','apto_restricao')),
  apto_cargo boolean DEFAULT false,
  inapto_cargo boolean DEFAULT false,
  apto_restricao boolean DEFAULT false,
  apto_nr35 boolean DEFAULT false,
  inapto_nr35 boolean DEFAULT false,
  nr35_nao_aplica boolean DEFAULT false,
  observacoes text,
  local_emissao text,
  pdf_url text,
  status text NOT NULL DEFAULT 'emitido' CHECK (status IN ('rascunho','emitido','cancelado')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero_aso)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asos TO authenticated;
GRANT ALL ON public.asos TO service_role;
ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asos_super_admin" ON public.asos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "asos_principal" ON public.asos FOR ALL TO authenticated
  USING (public.is_principal(auth.uid())) WITH CHECK (public.is_principal(auth.uid()));
CREATE POLICY "asos_empresa_select" ON public.asos FOR SELECT TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "asos_empresa_insert" ON public.asos FOR INSERT TO authenticated
  WITH CHECK (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "asos_empresa_update" ON public.asos FOR UPDATE TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "asos_empresa_delete" ON public.asos FOR DELETE TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE INDEX idx_asos_empresa ON public.asos(empresa_id);
CREATE INDEX idx_asos_funcionario ON public.asos(funcionario_id);
CREATE INDEX idx_asos_vencimento ON public.asos(data_vencimento);
CREATE TRIGGER trg_asos_updated BEFORE UPDATE ON public.asos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ASO RISCOS ============
CREATE TABLE public.aso_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aso_id uuid NOT NULL REFERENCES public.asos(id) ON DELETE CASCADE,
  grupo text NOT NULL CHECK (grupo IN ('fisico','quimico','biologico','ergonomico','acidente','outro')),
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_riscos TO authenticated;
GRANT ALL ON public.aso_riscos TO service_role;
ALTER TABLE public.aso_riscos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_riscos_via_aso" ON public.aso_riscos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))));
CREATE INDEX idx_aso_riscos_aso ON public.aso_riscos(aso_id);

-- ============ ASO EXAMES ============
CREATE TABLE public.aso_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aso_id uuid NOT NULL REFERENCES public.asos(id) ON DELETE CASCADE,
  exame_id uuid REFERENCES public.aso_exames_catalogo(id) ON DELETE SET NULL,
  nome_exame text NOT NULL,
  realizado boolean NOT NULL DEFAULT false,
  data_realizacao date,
  resultado text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_exames TO authenticated;
GRANT ALL ON public.aso_exames TO service_role;
ALTER TABLE public.aso_exames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_exames_via_aso" ON public.aso_exames FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))));
CREATE INDEX idx_aso_exames_aso ON public.aso_exames(aso_id);

-- ============ ASSINATURAS ============
CREATE TABLE public.aso_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aso_id uuid NOT NULL REFERENCES public.asos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('medico','colaborador')),
  nome text,
  assinatura_url text,
  data_assinatura timestamptz NOT NULL DEFAULT now(),
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_assinaturas TO authenticated;
GRANT ALL ON public.aso_assinaturas TO service_role;
ALTER TABLE public.aso_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_assin_via_aso" ON public.aso_assinaturas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))));
CREATE INDEX idx_aso_assin_aso ON public.aso_assinaturas(aso_id);

-- ============ VERIFICAÇÃO PÚBLICA (QR Code) ============
CREATE TABLE public.aso_verificacao (
  hash text PRIMARY KEY,
  aso_id uuid NOT NULL REFERENCES public.asos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aso_verificacao TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.aso_verificacao TO authenticated;
GRANT ALL ON public.aso_verificacao TO service_role;
ALTER TABLE public.aso_verificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aso_verif_public_select" ON public.aso_verificacao FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "aso_verif_auth_write" ON public.aso_verificacao FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.asos a WHERE a.id = aso_id AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))));
CREATE INDEX idx_aso_verif_aso ON public.aso_verificacao(aso_id);
