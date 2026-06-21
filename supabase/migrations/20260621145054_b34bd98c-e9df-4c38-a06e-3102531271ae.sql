
-- ============================================================
-- LTCAT — Parte 1: Migrations + RLS + permissões + seed
-- Padrão arquitetural espelhado no módulo PGR.
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.ltcat_status AS ENUM
  ('rascunho','em_revisao','vigente','substituido','arquivado');

CREATE TYPE public.ltcat_motivo_emissao AS ENUM
  ('inicial','revisao_periodica','mudanca_ambiental','correcao');

CREATE TYPE public.ltcat_tecnica_avaliacao AS ENUM
  ('quantitativa','qualitativa');

CREATE TYPE public.ltcat_enquadramento AS ENUM
  ('nao_aplicavel','habitual_permanente','intermitente','eventual','neutralizado_epi');

CREATE TYPE public.ltcat_conclusao_aposentadoria AS ENUM
  ('nao_especial','especial_15','especial_20','especial_25','inconclusivo');

CREATE TYPE public.ltcat_agente_grupo AS ENUM
  ('fisico','quimico','biologico','ergonomico','acidente');

-- ============================================================
-- 1) CATÁLOGO GLOBAL DE AGENTES NOCIVOS
-- empresa_id NULL = global (visível para todos os autenticados)
-- empresa_id NOT NULL = customizado da empresa
-- ============================================================
CREATE TABLE public.ltcat_catalogo_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  codigo_esocial text NOT NULL,
  nome text NOT NULL,
  grupo public.ltcat_agente_grupo NOT NULL,
  unidade_medida text,
  limite_tolerancia numeric(12,4),
  base_normativa text,
  sinonimos text[] DEFAULT '{}'::text[],
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, codigo_esocial)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_catalogo_agentes TO authenticated;
GRANT ALL ON public.ltcat_catalogo_agentes TO service_role;
ALTER TABLE public.ltcat_catalogo_agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ltcat_cat_select"
  ON public.ltcat_catalogo_agentes FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    OR public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "ltcat_cat_mutate_super"
  ON public.ltcat_catalogo_agentes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "ltcat_cat_mutate_empresa"
  ON public.ltcat_catalogo_agentes FOR ALL TO authenticated
  USING (
    empresa_id IS NOT NULL
    AND (public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  )
  WITH CHECK (
    empresa_id IS NOT NULL
    AND (public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  );

CREATE TRIGGER ltcat_cat_updated_at
  BEFORE UPDATE ON public.ltcat_catalogo_agentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ltcat_cat_grupo ON public.ltcat_catalogo_agentes(grupo);
CREATE INDEX idx_ltcat_cat_empresa ON public.ltcat_catalogo_agentes(empresa_id);

-- ============================================================
-- 2) ltcat_documentos
-- ============================================================
CREATE TABLE public.ltcat_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL,
  versao integer NOT NULL DEFAULT 1,
  versao_pai_id uuid REFERENCES public.ltcat_documentos(id) ON DELETE SET NULL,
  status public.ltcat_status NOT NULL DEFAULT 'rascunho',
  motivo_emissao public.ltcat_motivo_emissao NOT NULL DEFAULT 'inicial',
  data_emissao date,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  cnae text,
  grau_risco smallint,
  escopo text,
  metodologia_geral text,
  observacoes text,
  publicado_em timestamptz,
  publicado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conteudo_atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, unidade_id, versao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_documentos TO authenticated;
GRANT ALL ON public.ltcat_documentos TO service_role;
ALTER TABLE public.ltcat_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ltcat_doc_select" ON public.ltcat_documentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_doc_insert" ON public.ltcat_documentos FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_doc_update" ON public.ltcat_documentos FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_doc_delete" ON public.ltcat_documentos FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

CREATE TRIGGER ltcat_doc_updated_at
  BEFORE UPDATE ON public.ltcat_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ltcat_doc_empresa ON public.ltcat_documentos(empresa_id);
CREATE INDEX idx_ltcat_doc_unidade ON public.ltcat_documentos(unidade_id);
CREATE INDEX idx_ltcat_doc_status ON public.ltcat_documentos(status);

-- Bloqueio de alteração de empresa_id
CREATE OR REPLACE FUNCTION public.ltcat_doc_immutable_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id do LTCAT é imutável';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_ltcat_doc_immutable_empresa
  BEFORE UPDATE ON public.ltcat_documentos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_doc_immutable_empresa();

-- Touch conteudo_atualizado_em em campos relevantes
CREATE OR REPLACE FUNCTION public.ltcat_doc_touch_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.versao IS DISTINCT FROM OLD.versao
       OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
       OR NEW.motivo_emissao IS DISTINCT FROM OLD.motivo_emissao
       OR NEW.escopo IS DISTINCT FROM OLD.escopo
       OR NEW.metodologia_geral IS DISTINCT FROM OLD.metodologia_geral
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
       OR NEW.data_vigencia_inicio IS DISTINCT FROM OLD.data_vigencia_inicio
       OR NEW.data_vigencia_fim IS DISTINCT FROM OLD.data_vigencia_fim
       OR NEW.cnae IS DISTINCT FROM OLD.cnae
       OR NEW.grau_risco IS DISTINCT FROM OLD.grau_risco THEN
      NEW.conteudo_atualizado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_ltcat_doc_touch_content
  BEFORE UPDATE ON public.ltcat_documentos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_doc_touch_content();

-- ============================================================
-- 3) Função genérica: filhos herdam empresa_id do LTCAT pai
-- ============================================================
CREATE OR REPLACE FUNCTION public.ltcat_child_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _emp uuid;
BEGIN
  SELECT empresa_id INTO _emp FROM public.ltcat_documentos WHERE id = NEW.ltcat_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'LTCAT inexistente'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id imutável em tabelas filhas do LTCAT';
  END IF;
  NEW.empresa_id := _emp;
  RETURN NEW;
END;$$;

-- Touch conteudo_atualizado_em no LTCAT quando filhos mudam
CREATE OR REPLACE FUNCTION public.ltcat_child_touch_doc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ltcat uuid;
BEGIN
  _ltcat := COALESCE(NEW.ltcat_id, OLD.ltcat_id);
  IF _ltcat IS NOT NULL THEN
    UPDATE public.ltcat_documentos SET conteudo_atualizado_em = now() WHERE id = _ltcat;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

-- ============================================================
-- 4) ltcat_responsaveis_tecnicos
-- ============================================================
CREATE TABLE public.ltcat_responsaveis_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  cpf text,
  profissao text NOT NULL,
  registro_profissional text NOT NULL,
  uf_registro text,
  numero_art text,
  email text,
  telefone text,
  ordem smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_responsaveis_tecnicos TO authenticated;
GRANT ALL ON public.ltcat_responsaveis_tecnicos TO service_role;
ALTER TABLE public.ltcat_responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_rt_all" ON public.ltcat_responsaveis_tecnicos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_rt_updated_at BEFORE UPDATE ON public.ltcat_responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_rt_guard BEFORE INSERT OR UPDATE ON public.ltcat_responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_rt_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_rt_ltcat ON public.ltcat_responsaveis_tecnicos(ltcat_id);

-- ============================================================
-- 5) ltcat_setores_avaliados
-- ============================================================
CREATE TABLE public.ltcat_setores_avaliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  setor_id uuid REFERENCES public.aso_setores(id) ON DELETE SET NULL,
  nome_setor text NOT NULL,
  descricao_local text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_setores_avaliados TO authenticated;
GRANT ALL ON public.ltcat_setores_avaliados TO service_role;
ALTER TABLE public.ltcat_setores_avaliados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_setor_all" ON public.ltcat_setores_avaliados FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_setor_updated_at BEFORE UPDATE ON public.ltcat_setores_avaliados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_setor_guard BEFORE INSERT OR UPDATE ON public.ltcat_setores_avaliados
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_setor_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_setores_avaliados
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_setor_ltcat ON public.ltcat_setores_avaliados(ltcat_id);

-- ============================================================
-- 6) ltcat_grupos_homogeneos (snapshot de GHE/GES)
-- ============================================================
CREATE TABLE public.ltcat_grupos_homogeneos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  ghe_origem_id uuid REFERENCES public.ghe_ges(id) ON DELETE SET NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  setor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_grupos_homogeneos TO authenticated;
GRANT ALL ON public.ltcat_grupos_homogeneos TO service_role;
ALTER TABLE public.ltcat_grupos_homogeneos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_ghe_all" ON public.ltcat_grupos_homogeneos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_ghe_updated_at BEFORE UPDATE ON public.ltcat_grupos_homogeneos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_ghe_guard BEFORE INSERT OR UPDATE ON public.ltcat_grupos_homogeneos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_ghe_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_grupos_homogeneos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_ghe_ltcat ON public.ltcat_grupos_homogeneos(ltcat_id);

-- ============================================================
-- 7) ltcat_funcoes (funções enquadradas em cada GHE)
-- ============================================================
CREATE TABLE public.ltcat_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  grupo_homogeneo_id uuid NOT NULL REFERENCES public.ltcat_grupos_homogeneos(id) ON DELETE CASCADE,
  funcao_origem_id uuid REFERENCES public.aso_funcoes(id) ON DELETE SET NULL,
  nome_funcao text NOT NULL,
  cbo text,
  descricao_atividade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_funcoes TO authenticated;
GRANT ALL ON public.ltcat_funcoes TO service_role;
ALTER TABLE public.ltcat_funcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_func_all" ON public.ltcat_funcoes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_func_updated_at BEFORE UPDATE ON public.ltcat_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_func_guard BEFORE INSERT OR UPDATE ON public.ltcat_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_func_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_func_ghe ON public.ltcat_funcoes(grupo_homogeneo_id);

-- ============================================================
-- 8) ltcat_agentes (agentes nocivos por GHE)
-- ============================================================
CREATE TABLE public.ltcat_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  grupo_homogeneo_id uuid NOT NULL REFERENCES public.ltcat_grupos_homogeneos(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.ltcat_catalogo_agentes(id) ON DELETE SET NULL,
  codigo_esocial text NOT NULL,
  nome text NOT NULL,
  grupo public.ltcat_agente_grupo NOT NULL,
  fonte_geradora text,
  meio_propagacao text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (grupo_homogeneo_id, codigo_esocial)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_agentes TO authenticated;
GRANT ALL ON public.ltcat_agentes TO service_role;
ALTER TABLE public.ltcat_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_ag_all" ON public.ltcat_agentes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_ag_updated_at BEFORE UPDATE ON public.ltcat_agentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_ag_guard BEFORE INSERT OR UPDATE ON public.ltcat_agentes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_ag_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_agentes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_ag_ghe ON public.ltcat_agentes(grupo_homogeneo_id);

-- ============================================================
-- 9) ltcat_avaliacoes (1 linha por GHE × agente)
-- ============================================================
CREATE TABLE public.ltcat_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  agente_id uuid NOT NULL REFERENCES public.ltcat_agentes(id) ON DELETE CASCADE,
  grupo_homogeneo_id uuid NOT NULL REFERENCES public.ltcat_grupos_homogeneos(id) ON DELETE CASCADE,
  tecnica public.ltcat_tecnica_avaliacao NOT NULL DEFAULT 'qualitativa',
  metodologia text,
  instrumento_marca text,
  instrumento_modelo text,
  instrumento_serie text,
  instrumento_calibracao_data date,
  intensidade numeric(14,4),
  unidade_medida text,
  limite_tolerancia numeric(14,4),
  base_normativa_limite text,
  tempo_exposicao_horas numeric(5,2),
  percentual_jornada numeric(5,2),
  epi_descricao text,
  epi_eficacia text CHECK (epi_eficacia IN ('sim','nao','parcial') OR epi_eficacia IS NULL),
  epi_ca text,
  epc_descricao text,
  enquadramento public.ltcat_enquadramento NOT NULL DEFAULT 'nao_aplicavel',
  origem_pgr_item_id uuid REFERENCES public.pgr_inventario_itens(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_avaliacoes TO authenticated;
GRANT ALL ON public.ltcat_avaliacoes TO service_role;
ALTER TABLE public.ltcat_avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_aval_all" ON public.ltcat_avaliacoes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_aval_updated_at BEFORE UPDATE ON public.ltcat_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_aval_guard BEFORE INSERT OR UPDATE ON public.ltcat_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_aval_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_aval_ltcat ON public.ltcat_avaliacoes(ltcat_id);
CREATE INDEX idx_ltcat_aval_agente ON public.ltcat_avaliacoes(agente_id);

-- ============================================================
-- 10) ltcat_conclusoes (por GHE e/ou função)
-- ============================================================
CREATE TABLE public.ltcat_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  grupo_homogeneo_id uuid REFERENCES public.ltcat_grupos_homogeneos(id) ON DELETE CASCADE,
  funcao_id uuid REFERENCES public.ltcat_funcoes(id) ON DELETE CASCADE,
  conclusao public.ltcat_conclusao_aposentadoria NOT NULL DEFAULT 'nao_especial',
  fundamento_legal text,
  justificativa text,
  agentes_considerados jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_conclusoes TO authenticated;
GRANT ALL ON public.ltcat_conclusoes TO service_role;
ALTER TABLE public.ltcat_conclusoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_concl_all" ON public.ltcat_conclusoes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_concl_updated_at BEFORE UPDATE ON public.ltcat_conclusoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_concl_guard BEFORE INSERT OR UPDATE ON public.ltcat_conclusoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();
CREATE TRIGGER trg_ltcat_concl_touch AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_conclusoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_touch_doc();
CREATE INDEX idx_ltcat_concl_ltcat ON public.ltcat_conclusoes(ltcat_id);

-- ============================================================
-- 11) ltcat_revisoes (histórico append-only de revisões)
-- ============================================================
CREATE TABLE public.ltcat_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  versao_anterior integer,
  versao_nova integer,
  motivo text NOT NULL,
  resumo_alteracoes text,
  status_anterior public.ltcat_status,
  status_novo public.ltcat_status,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ltcat_revisoes TO authenticated;
GRANT ALL ON public.ltcat_revisoes TO service_role;
ALTER TABLE public.ltcat_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_rev_select" ON public.ltcat_revisoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_rev_insert" ON public.ltcat_revisoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ltcat_revisoes_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ltcat_revisoes é append-only'; END;$$;
CREATE TRIGGER trg_ltcat_rev_block_upd BEFORE UPDATE ON public.ltcat_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_revisoes_block_mutations();
CREATE TRIGGER trg_ltcat_rev_block_del BEFORE DELETE ON public.ltcat_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_revisoes_block_mutations();
CREATE INDEX idx_ltcat_rev_ltcat ON public.ltcat_revisoes(ltcat_id);

-- ============================================================
-- 12) ltcat_assinaturas (append-only)
-- ============================================================
CREATE TABLE public.ltcat_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  pdf_versao integer,
  pdf_hash text NOT NULL,
  responsavel_nome text NOT NULL,
  responsavel_registro text,
  responsavel_cpf text,
  ip_origem text,
  observacao text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text
);
GRANT SELECT, INSERT ON public.ltcat_assinaturas TO authenticated;
GRANT ALL ON public.ltcat_assinaturas TO service_role;
ALTER TABLE public.ltcat_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_assin_select" ON public.ltcat_assinaturas FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_assin_insert" ON public.ltcat_assinaturas FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ltcat_assin_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ltcat_assinaturas é append-only'; END;$$;
CREATE TRIGGER trg_ltcat_assin_block_upd BEFORE UPDATE ON public.ltcat_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_assin_block_mutations();
CREATE TRIGGER trg_ltcat_assin_block_del BEFORE DELETE ON public.ltcat_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_assin_block_mutations();
CREATE INDEX idx_ltcat_assin_ltcat ON public.ltcat_assinaturas(ltcat_id);

-- ============================================================
-- 13) ltcat_pdf_versoes (apenas metadados/hash/link Drive; append-only)
-- ============================================================
CREATE TABLE public.ltcat_pdf_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  pdf_versao integer NOT NULL,
  pdf_hash text NOT NULL,
  status_no_momento public.ltcat_status NOT NULL,
  com_marca_dagua boolean NOT NULL DEFAULT false,
  drive_file_id text,
  drive_view_link text,
  drive_path text,
  nome_arquivo text,
  tamanho_bytes bigint,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (ltcat_id, pdf_versao)
);
GRANT SELECT, INSERT ON public.ltcat_pdf_versoes TO authenticated;
GRANT ALL ON public.ltcat_pdf_versoes TO service_role;
ALTER TABLE public.ltcat_pdf_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_pdfv_select" ON public.ltcat_pdf_versoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "ltcat_pdfv_insert" ON public.ltcat_pdf_versoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.ltcat_pdfv_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ltcat_pdf_versoes é append-only'; END;$$;
CREATE TRIGGER trg_ltcat_pdfv_block_upd BEFORE UPDATE ON public.ltcat_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_pdfv_block_mutations();
CREATE TRIGGER trg_ltcat_pdfv_block_del BEFORE DELETE ON public.ltcat_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_pdfv_block_mutations();
CREATE INDEX idx_ltcat_pdfv_ltcat ON public.ltcat_pdf_versoes(ltcat_id);

-- ============================================================
-- 14) ltcat_anexos (metadados Drive — nunca binário)
-- ============================================================
CREATE TABLE public.ltcat_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ltcat_id uuid NOT NULL REFERENCES public.ltcat_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  avaliacao_id uuid REFERENCES public.ltcat_avaliacoes(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  drive_file_id text NOT NULL,
  drive_view_link text,
  drive_path text,
  descricao text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltcat_anexos TO authenticated;
GRANT ALL ON public.ltcat_anexos TO service_role;
ALTER TABLE public.ltcat_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltcat_anx_all" ON public.ltcat_anexos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER ltcat_anx_updated_at BEFORE UPDATE ON public.ltcat_anexos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ltcat_anx_guard BEFORE INSERT OR UPDATE ON public.ltcat_anexos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_child_guard();

-- ============================================================
-- 15) AUDIT TRIGGER (em audit_log existente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.ltcat_audit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp uuid;
  _eid uuid;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF TG_OP = 'DELETE' THEN
    _emp := OLD.empresa_id; _eid := OLD.id;
  ELSE
    _emp := NEW.empresa_id; _eid := NEW.id;
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

CREATE TRIGGER trg_ltcat_doc_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_documentos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();
CREATE TRIGGER trg_ltcat_aval_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();
CREATE TRIGGER trg_ltcat_concl_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_conclusoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();
CREATE TRIGGER trg_ltcat_assin_audit
  AFTER INSERT ON public.ltcat_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();
CREATE TRIGGER trg_ltcat_pdfv_audit
  AFTER INSERT ON public.ltcat_pdf_versoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();

-- ============================================================
-- 16) RPCs: ltcat_abrir_revisao, ltcat_publicar
-- ============================================================
CREATE OR REPLACE FUNCTION public.ltcat_abrir_revisao(_ltcat_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _nova_id uuid;
  _nova_versao integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo da revisão é obrigatório (mín. 5 caracteres)';
  END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['ltcat:revisar'] OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:revisar requerida'; END IF;
  END IF;

  IF _doc.status <> 'vigente' THEN
    RAISE EXCEPTION 'Apenas LTCAT vigente pode iniciar nova revisão (status atual: %)', _doc.status;
  END IF;

  SELECT COALESCE(MAX(versao),0)+1 INTO _nova_versao
    FROM public.ltcat_documentos
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id;

  INSERT INTO public.ltcat_documentos(
    empresa_id, unidade_id, versao, versao_pai_id, status, motivo_emissao,
    cnae, grau_risco, escopo, metodologia_geral, observacoes,
    data_vigencia_inicio, data_vigencia_fim, created_by, updated_by
  ) VALUES (
    _doc.empresa_id, _doc.unidade_id, _nova_versao, _doc.id, 'em_revisao'::public.ltcat_status,
    'revisao_periodica'::public.ltcat_motivo_emissao,
    _doc.cnae, _doc.grau_risco, _doc.escopo, _doc.metodologia_geral, _doc.observacoes,
    _doc.data_vigencia_inicio, _doc.data_vigencia_fim, auth.uid(), auth.uid()
  ) RETURNING id INTO _nova_id;

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova, motivo,
    status_anterior, status_novo, user_id, user_email
  ) VALUES (
    _nova_id, _doc.empresa_id, _doc.versao, _nova_versao, _motivo,
    _doc.status, 'em_revisao'::public.ltcat_status, auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'novo_ltcat_id', _nova_id, 'versao', _nova_versao);
END;$$;

REVOKE EXECUTE ON FUNCTION public.ltcat_abrir_revisao(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ltcat_abrir_revisao(uuid, text) TO authenticated;

-- ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ltcat_publicar(_ltcat_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
  _aal text := COALESCE(auth.jwt() ->> 'aal','');
  _rt_count integer;
  _concl_count integer;
  _agente_count integer;
  _pendentes integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _aal <> 'aal2' THEN RAISE EXCEPTION 'MFA (AAL2) obrigatório para publicar LTCAT'; END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id FOR UPDATE;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['ltcat:revisar'] OR modulos_permitidos @> ARRAY['ltcat'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão ltcat:revisar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'Apenas LTCAT em rascunho ou em revisão pode ser publicado (status: %)', _doc.status;
  END IF;

  SELECT count(*) INTO _rt_count FROM public.ltcat_responsaveis_tecnicos WHERE ltcat_id = _ltcat_id;
  IF _rt_count = 0 THEN RAISE EXCEPTION 'É obrigatório pelo menos 1 Responsável Técnico'; END IF;

  SELECT count(*) INTO _agente_count FROM public.ltcat_agentes WHERE ltcat_id = _ltcat_id;
  IF _agente_count = 0 THEN RAISE EXCEPTION 'É obrigatório pelo menos 1 agente nocivo cadastrado'; END IF;

  SELECT count(*) INTO _concl_count FROM public.ltcat_conclusoes WHERE ltcat_id = _ltcat_id;
  IF _concl_count = 0 THEN RAISE EXCEPTION 'É obrigatória ao menos 1 conclusão previdenciária'; END IF;

  -- conclusões "especial_*"/"inconclusivo" exigem justificativa
  SELECT count(*) INTO _pendentes
    FROM public.ltcat_conclusoes
   WHERE ltcat_id = _ltcat_id
     AND conclusao IN ('especial_15','especial_20','especial_25','inconclusivo')
     AND (justificativa IS NULL OR length(btrim(justificativa)) < 5);
  IF _pendentes > 0 THEN
    RAISE EXCEPTION '% conclusão(ões) sem justificativa técnica obrigatória', _pendentes;
  END IF;

  -- Marca versão anterior (mesma empresa/unidade) como substituída
  UPDATE public.ltcat_documentos
     SET status = 'substituido'::public.ltcat_status,
         updated_at = now(), updated_by = auth.uid()
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id
     AND status = 'vigente'
     AND id <> _ltcat_id;

  -- Publica
  UPDATE public.ltcat_documentos
     SET status = 'vigente'::public.ltcat_status,
         publicado_em = now(),
         publicado_por = auth.uid(),
         data_emissao = COALESCE(data_emissao, current_date),
         updated_at = now(),
         updated_by = auth.uid()
   WHERE id = _ltcat_id;

  INSERT INTO public.ltcat_revisoes(
    ltcat_id, empresa_id, versao_anterior, versao_nova, motivo,
    status_anterior, status_novo, user_id, user_email
  ) VALUES (
    _ltcat_id, _doc.empresa_id, _doc.versao, _doc.versao, 'Publicação do LTCAT',
    _doc.status, 'vigente'::public.ltcat_status, auth.uid(), NULLIF(_email,'')
  );

  RETURN jsonb_build_object('success', true, 'ltcat_id', _ltcat_id, 'versao', _doc.versao);
END;$$;

REVOKE EXECUTE ON FUNCTION public.ltcat_publicar(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ltcat_publicar(uuid) TO authenticated;

-- ============================================================
-- 17) SEED — catálogo de agentes nocivos (Anexo IV / S-2240)
-- ============================================================
INSERT INTO public.ltcat_catalogo_agentes (codigo_esocial, nome, grupo, unidade_medida, limite_tolerancia, base_normativa, sinonimos) VALUES
-- Físicos
('01.01.001','Ruído contínuo ou intermitente','fisico','dB(A)',85,'NR-15 Anexo 1; NHO-01 Fundacentro', ARRAY['ruido','barulho']),
('01.01.002','Ruído de impacto','fisico','dB(C) pico',120,'NR-15 Anexo 2', ARRAY['impacto sonoro']),
('01.02.001','Vibração de corpo inteiro','fisico','m/s² (aren)',1.1,'NHO-09 Fundacentro; NR-15 Anexo 8', ARRAY['VCI','vibracao']),
('01.02.002','Vibração de mãos e braços','fisico','m/s² (aren)',5.0,'NHO-10 Fundacentro; NR-15 Anexo 8', ARRAY['VMB','HAV']),
('01.03.001','Calor','fisico','IBUTG (°C)',NULL,'NR-15 Anexo 3; NHO-06 Fundacentro', ARRAY['estresse termico','sobrecarga termica']),
('01.04.001','Frio','fisico',NULL,NULL,'NR-15 Anexo 9', ARRAY['baixa temperatura']),
('01.05.001','Umidade','fisico',NULL,NULL,'NR-15 Anexo 10', ARRAY[]::text[]),
('01.06.001','Radiações ionizantes','fisico','mSv/ano',20,'NR-15 Anexo 5; CNEN-NN-3.01', ARRAY['raio-x','gama','beta','alfa']),
('01.07.001','Radiações não ionizantes','fisico',NULL,NULL,'NR-15 Anexo 7', ARRAY['UV','IR','microondas']),
('01.08.001','Pressões anormais (hiperbárica/hipobárica)','fisico',NULL,NULL,'NR-15 Anexo 6', ARRAY['mergulho','ar comprimido']),
-- Químicos
('02.01.001','Arsênio e seus compostos','quimico','mg/m³',NULL,'NR-15 Anexo 11; Anexo IV Decreto 3.048/99', ARRAY['As']),
('02.01.002','Asbestos / amianto','quimico','f/cm³',0.1,'NR-15 Anexo 12', ARRAY['amianto']),
('02.01.003','Benzeno','quimico','ppm',NULL,'NR-15 Anexo 13-A; IN MTb 1/95', ARRAY['C6H6']),
('02.01.004','Berílio e seus compostos','quimico','mg/m³',NULL,'Anexo IV', ARRAY['Be']),
('02.01.005','Bromo','quimico','ppm',0.1,'NR-15 Anexo 11', ARRAY['Br2']),
('02.01.006','Cádmio e seus compostos','quimico','mg/m³',NULL,'Anexo IV', ARRAY['Cd']),
('02.01.007','Chumbo e seus compostos','quimico','mg/m³',0.1,'NR-15 Anexo 11; Anexo IV', ARRAY['Pb']),
('02.01.008','Cloro','quimico','ppm',0.8,'NR-15 Anexo 11', ARRAY['Cl2']),
('02.01.009','Cromo VI e seus compostos','quimico','mg/m³',NULL,'Anexo IV', ARRAY['cromo hexavalente']),
('02.01.010','Dissulfeto de carbono','quimico','ppm',16,'NR-15 Anexo 11', ARRAY['CS2']),
('02.01.011','Fenol','quimico','ppm',4,'NR-15 Anexo 11', ARRAY[]::text[]),
('02.01.012','Formaldeído (formol)','quimico','ppm',1.6,'NR-15 Anexo 11', ARRAY['formol','metanal']),
('02.01.013','Fósforo branco','quimico','mg/m³',NULL,'Anexo IV', ARRAY['P4']),
('02.01.014','Hidrocarbonetos aromáticos (BTX)','quimico','ppm',NULL,'NR-15 Anexo 11', ARRAY['tolueno','xileno','etilbenzeno']),
('02.01.015','Manganês e seus compostos','quimico','mg/m³',1,'NR-15 Anexo 11', ARRAY['Mn']),
('02.01.016','Mercúrio','quimico','mg/m³',0.04,'NR-15 Anexo 11', ARRAY['Hg']),
('02.01.017','Níquel e seus compostos','quimico','mg/m³',NULL,'Anexo IV', ARRAY['Ni']),
('02.01.018','Sílica livre cristalizada','quimico','mg/m³',NULL,'NR-15 Anexo 12; Anexo IV', ARRAY['quartzo','silica']),
('02.01.019','Sulfeto de hidrogênio (H2S)','quimico','ppm',8,'NR-15 Anexo 11', ARRAY['gas sulfidrico']),
('02.01.020','Tolueno','quimico','ppm',78,'NR-15 Anexo 11', ARRAY['metilbenzeno']),
('02.01.021','Tricloroetileno','quimico','ppm',78,'NR-15 Anexo 11', ARRAY['TCE']),
('02.01.022','Vapores de soldagem (fumos metálicos)','quimico','mg/m³',5,'NR-15 Anexo 12', ARRAY['fumos de solda']),
('02.01.023','Vapores orgânicos (genérico)','quimico','ppm',NULL,'NR-15 Anexo 11', ARRAY['VOC']),
('02.01.024','Poeiras minerais não especificadas','quimico','mg/m³',NULL,'NR-15 Anexo 12', ARRAY['poeira']),
('02.01.025','Óleos minerais','quimico','mg/m³',5,'NR-15 Anexo 11', ARRAY['lubrificante']),
('02.01.026','Iodo','quimico','ppm',0.1,'NR-15 Anexo 11', ARRAY['I2']),
('02.01.027','Amônia','quimico','ppm',20,'NR-15 Anexo 11', ARRAY['NH3']),
('02.01.028','Anidrido sulfuroso','quimico','ppm',4,'NR-15 Anexo 11', ARRAY['SO2','dioxido de enxofre']),
('02.01.029','Monóxido de carbono','quimico','ppm',39,'NR-15 Anexo 11', ARRAY['CO']),
('02.01.030','Dióxido de carbono','quimico','ppm',3900,'NR-15 Anexo 11', ARRAY['CO2']),
('02.01.031','Anilina','quimico','ppm',4,'NR-15 Anexo 11', ARRAY[]::text[]),
('02.01.032','Acetona','quimico','ppm',780,'NR-15 Anexo 11', ARRAY[]::text[]),
('02.01.033','Defensivos agrícolas (genérico)','quimico',NULL,NULL,'NR-31; Anexo IV', ARRAY['agrotoxico','pesticida']),
-- Biológicos
('03.01.001','Vírus','biologico',NULL,NULL,'NR-32; Anexo IV Decreto 3.048/99', ARRAY[]::text[]),
('03.01.002','Bactérias','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY[]::text[]),
('03.01.003','Fungos','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY[]::text[]),
('03.01.004','Bacilos (Mycobacterium tuberculosis)','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY['tuberculose']),
('03.01.005','Parasitas','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY[]::text[]),
('03.01.006','Protozoários','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY[]::text[]),
('03.01.007','Riquétsias','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY[]::text[]),
('03.01.008','Esgoto e/ou resíduos hospitalares','biologico',NULL,NULL,'NR-32; Anexo IV', ARRAY['esgoto','RSS']),
-- Ergonômicos (referência; não geram aposentadoria especial mas constam em PGR/LTCAT informativo)
('04.01.001','Levantamento e transporte manual de peso','ergonomico','kg',23,'NR-17', ARRAY['LMR']),
('04.01.002','Postura inadequada','ergonomico',NULL,NULL,'NR-17', ARRAY[]::text[]),
('04.01.003','Movimentos repetitivos','ergonomico',NULL,NULL,'NR-17', ARRAY['LER','DORT']),
-- Acidente
('05.01.001','Trabalho em altura','acidente','m',2,'NR-35', ARRAY['altura']),
('05.01.002','Eletricidade','acidente','V',NULL,'NR-10', ARRAY['choque eletrico','SEP']),
('05.01.003','Máquinas e equipamentos sem proteção','acidente',NULL,NULL,'NR-12', ARRAY[]::text[]),
('05.01.004','Espaço confinado','acidente',NULL,NULL,'NR-33', ARRAY[]::text[]),
('05.01.005','Trabalho em explosivos / inflamáveis','acidente',NULL,NULL,'NR-19; NR-20', ARRAY['inflamavel']);
