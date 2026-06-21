
-- ============================================================
-- PPP — Parte 1: Migrations + RLS + permissões
-- Documento técnico interno preparatório (sem eSocial real, sem ICP-Brasil).
-- Padrão arquitetural espelhado em LTCAT.
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.ppp_status AS ENUM
  ('rascunho','em_revisao','vigente','substituido','arquivado');

CREATE TYPE public.ppp_motivo_emissao AS ENUM
  ('inicial','atualizacao','correcao','demissao');

CREATE TYPE public.ppp_conclusao_aposentadoria AS ENUM
  ('nao_especial','especial_15','especial_20','especial_25','inconclusivo');

CREATE TYPE public.ppp_enquadramento AS ENUM
  ('nao_aplicavel','habitual_permanente','intermitente','eventual','neutralizado_epi');

CREATE TYPE public.ppp_tecnica_avaliacao AS ENUM
  ('quantitativa','qualitativa');

CREATE TYPE public.ppp_agente_grupo AS ENUM
  ('fisico','quimico','biologico','ergonomico','acidente');

CREATE TYPE public.ppp_epi_eficacia AS ENUM ('sim','nao','parcial');

-- ============================================================
-- 1) ppp_documentos
-- ============================================================
CREATE TABLE public.ppp_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  versao_pai_id uuid REFERENCES public.ppp_documentos(id) ON DELETE SET NULL,
  status public.ppp_status NOT NULL DEFAULT 'rascunho',
  motivo_emissao public.ppp_motivo_emissao NOT NULL DEFAULT 'inicial',
  data_emissao date,
  cbo_consolidado text,
  descricao_atividade_consolidada text,
  conclusao_consolidada public.ppp_conclusao_aposentadoria,
  observacoes text,
  publicado_em timestamptz,
  publicado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conteudo_atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (funcionario_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_documentos TO authenticated;
GRANT ALL ON public.ppp_documentos TO service_role;
ALTER TABLE public.ppp_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppp_doc_select" ON public.ppp_documentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ppp_doc_mut" ON public.ppp_documentos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE TRIGGER ppp_doc_updated_at BEFORE UPDATE ON public.ppp_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ppp_doc_empresa ON public.ppp_documentos(empresa_id);
CREATE INDEX idx_ppp_doc_funcionario ON public.ppp_documentos(funcionario_id);
CREATE INDEX idx_ppp_doc_status ON public.ppp_documentos(status);

-- ============================================================
-- Funções auxiliares: status do pai e guarda de filhas
-- ============================================================
CREATE OR REPLACE FUNCTION public.ppp_doc_status(_ppp_id uuid)
RETURNS public.ppp_status LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status FROM public.ppp_documentos WHERE id = _ppp_id
$$;

CREATE OR REPLACE FUNCTION public.ppp_child_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _st public.ppp_status;
BEGIN
  _st := public.ppp_doc_status( COALESCE(NEW.ppp_id, OLD.ppp_id) );
  IF _st IN ('vigente','substituido','arquivado') THEN
    RAISE EXCEPTION 'PPP em status % é imutável (tabela %).', _st, TG_TABLE_NAME;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

CREATE OR REPLACE FUNCTION public.ppp_touch_conteudo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ppp_documentos
     SET conteudo_atualizado_em = now()
   WHERE id = COALESCE(NEW.ppp_id, OLD.ppp_id);
  RETURN COALESCE(NEW, OLD);
END;$$;

-- ============================================================
-- 2) ppp_periodos
-- ============================================================
CREATE TABLE public.ppp_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 1,
  data_inicio date NOT NULL,
  data_fim date,
  motivo_encerramento text,
  funcao_id uuid,
  funcao_nome text,
  cbo text,
  setor_id uuid,
  setor_nome text,
  ghe_id uuid,
  ghe_codigo text,
  ghe_descricao text,
  ltcat_id uuid REFERENCES public.ltcat_documentos(id) ON DELETE SET NULL,
  pgr_id uuid,
  descricao_atividade text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_periodos TO authenticated;
GRANT ALL ON public.ppp_periodos TO service_role;
ALTER TABLE public.ppp_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_per_all" ON public.ppp_periodos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ppp_per_updated_at BEFORE UPDATE ON public.ppp_periodos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppp_per_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ppp_periodos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_child_guard();
CREATE TRIGGER trg_ppp_per_touch AFTER INSERT OR UPDATE OR DELETE ON public.ppp_periodos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_touch_conteudo();
CREATE INDEX idx_ppp_per_ppp ON public.ppp_periodos(ppp_id);

-- ============================================================
-- 3) ppp_exposicoes
-- ============================================================
CREATE TABLE public.ppp_exposicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  periodo_id uuid NOT NULL REFERENCES public.ppp_periodos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  agente_nome text NOT NULL,
  agente_tipo public.ppp_agente_grupo,
  codigo_esocial text,
  intensidade numeric(14,4),
  unidade_medida text,
  limite_tolerancia numeric(14,4),
  acima_limite boolean,
  tecnica public.ppp_tecnica_avaliacao,
  enquadramento public.ppp_enquadramento DEFAULT 'nao_aplicavel',
  tempo_exposicao_horas numeric(6,2),
  percentual_jornada numeric(5,2),
  epi_descricao text,
  epi_ca text,
  epi_eficacia public.ppp_epi_eficacia,
  epc_descricao text,
  origem_ltcat_aval_id uuid REFERENCES public.ltcat_avaliacoes(id) ON DELETE SET NULL,
  fundamento_legal text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_exposicoes TO authenticated;
GRANT ALL ON public.ppp_exposicoes TO service_role;
ALTER TABLE public.ppp_exposicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_exp_all" ON public.ppp_exposicoes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ppp_exp_updated_at BEFORE UPDATE ON public.ppp_exposicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppp_exp_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ppp_exposicoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_child_guard();
CREATE TRIGGER trg_ppp_exp_touch AFTER INSERT OR UPDATE OR DELETE ON public.ppp_exposicoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_touch_conteudo();
CREATE INDEX idx_ppp_exp_ppp ON public.ppp_exposicoes(ppp_id);
CREATE INDEX idx_ppp_exp_periodo ON public.ppp_exposicoes(periodo_id);

-- ============================================================
-- 4) ppp_responsaveis_ambientais
-- ============================================================
CREATE TABLE public.ppp_responsaveis_ambientais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  periodo_id uuid REFERENCES public.ppp_periodos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  registro_profissional text,
  formacao text,
  origem_ltcat_rt_id uuid REFERENCES public.ltcat_responsaveis_tecnicos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_responsaveis_ambientais TO authenticated;
GRANT ALL ON public.ppp_responsaveis_ambientais TO service_role;
ALTER TABLE public.ppp_responsaveis_ambientais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_rta_all" ON public.ppp_responsaveis_ambientais FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ppp_rta_updated_at BEFORE UPDATE ON public.ppp_responsaveis_ambientais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppp_rta_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ppp_responsaveis_ambientais
  FOR EACH ROW EXECUTE FUNCTION public.ppp_child_guard();
CREATE TRIGGER trg_ppp_rta_touch AFTER INSERT OR UPDATE OR DELETE ON public.ppp_responsaveis_ambientais
  FOR EACH ROW EXECUTE FUNCTION public.ppp_touch_conteudo();
CREATE INDEX idx_ppp_rta_ppp ON public.ppp_responsaveis_ambientais(ppp_id);

-- ============================================================
-- 5) ppp_responsaveis_medicos
-- ============================================================
CREATE TABLE public.ppp_responsaveis_medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  crm text,
  periodo_inicio date,
  periodo_fim date,
  origem_aso_medico_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_responsaveis_medicos TO authenticated;
GRANT ALL ON public.ppp_responsaveis_medicos TO service_role;
ALTER TABLE public.ppp_responsaveis_medicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_rtm_all" ON public.ppp_responsaveis_medicos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ppp_rtm_updated_at BEFORE UPDATE ON public.ppp_responsaveis_medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppp_rtm_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ppp_responsaveis_medicos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_child_guard();
CREATE TRIGGER trg_ppp_rtm_touch AFTER INSERT OR UPDATE OR DELETE ON public.ppp_responsaveis_medicos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_touch_conteudo();
CREATE INDEX idx_ppp_rtm_ppp ON public.ppp_responsaveis_medicos(ppp_id);

-- ============================================================
-- 6) ppp_exames_referenciados
-- ============================================================
CREATE TABLE public.ppp_exames_referenciados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  aso_id uuid REFERENCES public.asos(id) ON DELETE SET NULL,
  data date,
  tipo text,
  resultado_resumo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppp_exames_referenciados TO authenticated;
GRANT ALL ON public.ppp_exames_referenciados TO service_role;
ALTER TABLE public.ppp_exames_referenciados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_exa_all" ON public.ppp_exames_referenciados FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ppp_exa_updated_at BEFORE UPDATE ON public.ppp_exames_referenciados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ppp_exa_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ppp_exames_referenciados
  FOR EACH ROW EXECUTE FUNCTION public.ppp_child_guard();
CREATE TRIGGER trg_ppp_exa_touch AFTER INSERT OR UPDATE OR DELETE ON public.ppp_exames_referenciados
  FOR EACH ROW EXECUTE FUNCTION public.ppp_touch_conteudo();
CREATE INDEX idx_ppp_exa_ppp ON public.ppp_exames_referenciados(ppp_id);

-- ============================================================
-- 7) ppp_revisoes (append-only)
-- ============================================================
CREATE TABLE public.ppp_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  versao_anterior integer,
  versao_nova integer,
  motivo text NOT NULL,
  status_anterior public.ppp_status,
  status_novo public.ppp_status,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ppp_revisoes TO authenticated;
GRANT ALL ON public.ppp_revisoes TO service_role;
ALTER TABLE public.ppp_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_rev_select" ON public.ppp_revisoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ppp_rev_insert" ON public.ppp_revisoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ppp_rev_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ppp_revisoes é append-only'; END;$$;
CREATE TRIGGER trg_ppp_rev_block_upd BEFORE UPDATE ON public.ppp_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_rev_block_mutations();
CREATE TRIGGER trg_ppp_rev_block_del BEFORE DELETE ON public.ppp_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_rev_block_mutations();
CREATE INDEX idx_ppp_rev_ppp ON public.ppp_revisoes(ppp_id);

-- ============================================================
-- 8) ppp_pdf_versoes (append-only; metadados + hash, sem binário)
-- ============================================================
CREATE TABLE public.ppp_pdf_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('rascunho','final')),
  sha256 text NOT NULL,
  drive_id text,
  drive_link text,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ppp_pdf_versoes TO authenticated;
GRANT ALL ON public.ppp_pdf_versoes TO service_role;
ALTER TABLE public.ppp_pdf_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_pdfv_select" ON public.ppp_pdf_versoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ppp_pdfv_insert" ON public.ppp_pdf_versoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ppp_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ppp_pdf_versoes é append-only'; END;$$;
CREATE TRIGGER trg_ppp_pdfv_block_upd BEFORE UPDATE ON public.ppp_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_pdfv_block_mutations();
CREATE TRIGGER trg_ppp_pdfv_block_del BEFORE DELETE ON public.ppp_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_pdfv_block_mutations();
CREATE INDEX idx_ppp_pdfv_ppp ON public.ppp_pdf_versoes(ppp_id);

-- ============================================================
-- 9) ppp_assinaturas
-- ============================================================
CREATE TABLE public.ppp_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ppp_id uuid NOT NULL REFERENCES public.ppp_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome text NOT NULL,
  papel text,
  drive_id text,
  imagem_link text,
  auth_aal text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  assinado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ppp_assinaturas TO authenticated;
GRANT ALL ON public.ppp_assinaturas TO service_role;
ALTER TABLE public.ppp_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppp_assin_select" ON public.ppp_assinaturas FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ppp_assin_insert" ON public.ppp_assinaturas FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ppp_assin_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ppp_assinaturas é append-only'; END;$$;
CREATE TRIGGER trg_ppp_assin_block_upd BEFORE UPDATE ON public.ppp_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ppp_assin_block_mutations();
CREATE TRIGGER trg_ppp_assin_block_del BEFORE DELETE ON public.ppp_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ppp_assin_block_mutations();
CREATE INDEX idx_ppp_assin_ppp ON public.ppp_assinaturas(ppp_id);

-- ============================================================
-- 10) Trigger de audit (reutiliza audit_log)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ppp_audit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp uuid; _eid uuid;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF TG_OP = 'DELETE' THEN _emp := OLD.empresa_id; _eid := OLD.id;
  ELSE _emp := NEW.empresa_id; _eid := NEW.id;
  END IF;
  INSERT INTO public.audit_log(
    user_id, user_email, action, entity_type, entity_id, empresa_id, old_data, new_data
  ) VALUES (
    auth.uid(), NULLIF(_email,''), TG_OP, TG_TABLE_NAME, _eid, _emp,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;$$;

CREATE TRIGGER trg_ppp_doc_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ppp_documentos
  FOR EACH ROW EXECUTE FUNCTION public.ppp_audit_trg();
CREATE TRIGGER trg_ppp_exp_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ppp_exposicoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_audit_trg();
CREATE TRIGGER trg_ppp_assin_audit
  AFTER INSERT ON public.ppp_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ppp_audit_trg();
CREATE TRIGGER trg_ppp_pdfv_audit
  AFTER INSERT ON public.ppp_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ppp_audit_trg();

-- ============================================================
-- 11) Revoga acesso de anon em todas as funções auxiliares
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.ppp_doc_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ppp_doc_status(uuid) TO authenticated, service_role;
