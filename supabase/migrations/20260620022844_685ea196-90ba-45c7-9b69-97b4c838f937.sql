
-- ============================================================
-- PGR — Parte 1: Estrutura base
-- ============================================================

-- ENUMS ------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.pgr_status AS ENUM ('rascunho','em_revisao','vigente','substituido','arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_perigo_grupo AS ENUM ('fisico','quimico','biologico','ergonomico','acidente','psicossocial','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_exposicao_tipo AS ENUM ('continua','intermitente','eventual','nao_aplicavel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_avaliacao_tipo AS ENUM ('qualitativa','quantitativa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_risco_classe AS ENUM ('baixo','moderado','alto','critico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_acao_status AS ENUM ('pendente','em_andamento','concluida','atrasada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pgr_medida_tipo AS ENUM ('eliminacao','substituicao','engenharia','administrativa','epi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FUNÇÃO ÚNICA DE CLASSIFICAÇÃO -------------------------------
CREATE OR REPLACE FUNCTION public.pgr_classificar_risco(_sev int, _prob int)
RETURNS public.pgr_risco_classe
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _sev IS NULL OR _prob IS NULL THEN 'baixo'::public.pgr_risco_classe
    WHEN _sev < 1 OR _sev > 5 OR _prob < 1 OR _prob > 5 THEN 'baixo'::public.pgr_risco_classe
    WHEN (_sev * _prob) >= 20 THEN 'critico'::public.pgr_risco_classe
    WHEN (_sev * _prob) >= 12 THEN 'alto'::public.pgr_risco_classe
    WHEN (_sev * _prob) >= 6  THEN 'moderado'::public.pgr_risco_classe
    ELSE 'baixo'::public.pgr_risco_classe
  END
$$;

-- TABELA: pgr_documentos --------------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL,
  versao int NOT NULL DEFAULT 1,
  status public.pgr_status NOT NULL DEFAULT 'rascunho',
  data_emissao date,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  responsavel_tecnico_id uuid REFERENCES auth.users(id),
  resp_tec_nome text,
  resp_tec_registro text,
  metodologia_avaliacao text,
  escopo text,
  observacoes text,
  -- PDF (somente metadados/hash; nunca o binário)
  pdf_hash text,
  pdf_drive_file_id text,
  pdf_drive_view_link text,
  pdf_gerado_em timestamptz,
  -- Vínculo de versionamento
  documento_origem_id uuid REFERENCES public.pgr_documentos(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, unidade_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_documentos TO authenticated;
GRANT ALL ON public.pgr_documentos TO service_role;
ALTER TABLE public.pgr_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_doc_select ON public.pgr_documentos FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_doc_insert ON public.pgr_documentos FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_doc_update ON public.pgr_documentos FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_doc_delete ON public.pgr_documentos FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- TABELA: pgr_revisoes (append-only) --------------------------
CREATE TABLE IF NOT EXISTS public.pgr_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  versao_anterior int,
  versao_nova int,
  status_anterior public.pgr_status,
  status_novo public.pgr_status,
  acao text NOT NULL,
  motivo text,
  snapshot jsonb,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pgr_revisoes TO authenticated;
GRANT ALL ON public.pgr_revisoes TO service_role;
ALTER TABLE public.pgr_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_rev_select ON public.pgr_revisoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_rev_insert ON public.pgr_revisoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE OR REPLACE FUNCTION public.pgr_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Tabela append-only — UPDATE/DELETE bloqueado'; END;
$$;
CREATE TRIGGER trg_pgr_revisoes_block_upd BEFORE UPDATE ON public.pgr_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();
CREATE TRIGGER trg_pgr_revisoes_block_del BEFORE DELETE ON public.pgr_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();

-- TABELA: pgr_perigos_catalogo --------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_perigos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE, -- NULL = catálogo global (seed)
  grupo public.pgr_perigo_grupo NOT NULL,
  codigo text,
  nome text NOT NULL,
  descricao text,
  possiveis_lesoes text,
  unidade_medida text,
  limite_tolerancia text,
  norma_referencia text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pgr_perigos_uk_global ON public.pgr_perigos_catalogo (grupo, lower(nome)) WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pgr_perigos_uk_empresa ON public.pgr_perigos_catalogo (empresa_id, grupo, lower(nome)) WHERE empresa_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_perigos_catalogo TO authenticated;
GRANT ALL ON public.pgr_perigos_catalogo TO service_role;
ALTER TABLE public.pgr_perigos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_perigos_select ON public.pgr_perigos_catalogo FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_perigos_insert ON public.pgr_perigos_catalogo FOR INSERT TO authenticated
  WITH CHECK (empresa_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id)));
CREATE POLICY pgr_perigos_update ON public.pgr_perigos_catalogo FOR UPDATE TO authenticated
  USING (empresa_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id)));
CREATE POLICY pgr_perigos_delete ON public.pgr_perigos_catalogo FOR DELETE TO authenticated
  USING (empresa_id IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id)));

-- TABELA: pgr_inventario_itens --------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_inventario_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  ghe_id uuid REFERENCES public.ghe_ges(id) ON DELETE SET NULL,
  perigo_id uuid REFERENCES public.pgr_perigos_catalogo(id) ON DELETE SET NULL,
  grupo public.pgr_perigo_grupo NOT NULL,
  perigo_descricao text NOT NULL,
  fonte_geradora text,
  meio_propagacao text,
  tipo_exposicao public.pgr_exposicao_tipo NOT NULL DEFAULT 'continua',
  trabalhadores_expostos int NOT NULL DEFAULT 0,
  avaliacao_tipo public.pgr_avaliacao_tipo NOT NULL DEFAULT 'qualitativa',
  medicao_valor numeric,
  medicao_unidade text,
  limite_tolerancia text,
  excedente boolean,
  severidade int NOT NULL DEFAULT 1 CHECK (severidade BETWEEN 1 AND 5),
  probabilidade int NOT NULL DEFAULT 1 CHECK (probabilidade BETWEEN 1 AND 5),
  nivel_risco int GENERATED ALWAYS AS (severidade * probabilidade) STORED,
  classificacao public.pgr_risco_classe,
  controles_existentes text[] DEFAULT ARRAY[]::text[],
  necessita_acao boolean NOT NULL DEFAULT false,
  justificativa text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Chave lógica para evitar duplicidade em importação de GHE/GES
CREATE UNIQUE INDEX IF NOT EXISTS pgr_inv_dedupe
  ON public.pgr_inventario_itens (pgr_id, ghe_id, perigo_id, COALESCE(lower(fonte_geradora),''), avaliacao_tipo)
  WHERE ghe_id IS NOT NULL AND perigo_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_inventario_itens TO authenticated;
GRANT ALL ON public.pgr_inventario_itens TO service_role;
ALTER TABLE public.pgr_inventario_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_inv_select ON public.pgr_inventario_itens FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_inv_insert ON public.pgr_inventario_itens FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_inv_update ON public.pgr_inventario_itens FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_inv_delete ON public.pgr_inventario_itens FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- TABELA: pgr_acoes -------------------------------------------
CREATE TABLE IF NOT EXISTS public.pgr_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  inventario_item_id uuid REFERENCES public.pgr_inventario_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  tipo public.pgr_medida_tipo NOT NULL DEFAULT 'administrativa',
  responsavel_id uuid REFERENCES auth.users(id),
  responsavel_nome text,
  prazo date,
  status public.pgr_acao_status NOT NULL DEFAULT 'pendente',
  data_conclusao date,
  evidencia_url text,
  prioridade int NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 5),
  custo_estimado numeric,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_acoes TO authenticated;
GRANT ALL ON public.pgr_acoes TO service_role;
ALTER TABLE public.pgr_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_acao_select ON public.pgr_acoes FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_acao_insert ON public.pgr_acoes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_acao_update ON public.pgr_acoes FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_acao_delete ON public.pgr_acoes FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- TABELA: pgr_acao_historico (append-only) --------------------
CREATE TABLE IF NOT EXISTS public.pgr_acao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES public.pgr_acoes(id) ON DELETE CASCADE,
  pgr_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  status_anterior public.pgr_acao_status,
  status_novo public.pgr_acao_status,
  campo_alterado text,
  valor_anterior text,
  valor_novo text,
  motivo text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pgr_acao_historico TO authenticated;
GRANT ALL ON public.pgr_acao_historico TO service_role;
ALTER TABLE public.pgr_acao_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_acao_hist_select ON public.pgr_acao_historico FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_acao_hist_insert ON public.pgr_acao_historico FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_pgr_acao_hist_block_upd BEFORE UPDATE ON public.pgr_acao_historico
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();
CREATE TRIGGER trg_pgr_acao_hist_block_del BEFORE DELETE ON public.pgr_acao_historico
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();

-- TABELA: pgr_assinaturas (preparação — sem ICP-Brasil) -------
CREATE TABLE IF NOT EXISTS public.pgr_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  responsavel_user_id uuid REFERENCES auth.users(id),
  responsavel_nome text NOT NULL,
  responsavel_registro text,
  pdf_hash text NOT NULL,
  pdf_versao int NOT NULL,
  ip_origem text,
  mfa_verificado boolean NOT NULL DEFAULT false,
  observacao text,
  assinado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pgr_assinaturas TO authenticated;
GRANT ALL ON public.pgr_assinaturas TO service_role;
ALTER TABLE public.pgr_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pgr_ass_select ON public.pgr_assinaturas FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY pgr_ass_insert ON public.pgr_assinaturas FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER trg_pgr_ass_block_upd BEFORE UPDATE ON public.pgr_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();
CREATE TRIGGER trg_pgr_ass_block_del BEFORE DELETE ON public.pgr_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.pgr_block_mutations();

-- TRIGGERS: updated_at e classificação automática -------------
CREATE TRIGGER trg_pgr_doc_updated BEFORE UPDATE ON public.pgr_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pgr_perigos_updated BEFORE UPDATE ON public.pgr_perigos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pgr_inv_updated BEFORE UPDATE ON public.pgr_inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pgr_acao_updated BEFORE UPDATE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: protege empresa_id e calcula classificação
CREATE OR REPLACE FUNCTION public.pgr_doc_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'empresa_id do PGR não pode ser alterado';
    END IF;
    IF OLD.status IN ('vigente','substituido','arquivado') AND NEW.status = OLD.status THEN
      -- bloqueia mutação direta de dados-chave após vigência (somente via revisão)
      IF NEW.versao IS DISTINCT FROM OLD.versao OR NEW.data_emissao IS DISTINCT FROM OLD.data_emissao THEN
        RAISE EXCEPTION 'PGR % imutável — abra uma revisão', OLD.status;
      END IF;
    END IF;
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pgr_doc_guard BEFORE UPDATE ON public.pgr_documentos
  FOR EACH ROW EXECUTE FUNCTION public.pgr_doc_guard();

CREATE OR REPLACE FUNCTION public.pgr_child_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _emp uuid;
BEGIN
  SELECT empresa_id INTO _emp FROM public.pgr_documentos WHERE id = NEW.pgr_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'PGR inexistente'; END IF;
  NEW.empresa_id := _emp;
  IF TG_TABLE_NAME = 'pgr_inventario_itens' THEN
    NEW.classificacao := public.pgr_classificar_risco(NEW.severidade, NEW.probabilidade);
    NEW.necessita_acao := NEW.classificacao IN ('alto','critico');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pgr_inv_child_guard BEFORE INSERT OR UPDATE ON public.pgr_inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();
CREATE TRIGGER trg_pgr_acao_child_guard BEFORE INSERT OR UPDATE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();

-- Trigger: histórico append-only de mudanças de status nas ações
CREATE OR REPLACE FUNCTION public.pgr_acao_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pgr_acao_historico(acao_id, pgr_id, empresa_id, status_anterior, status_novo, campo_alterado, user_id, user_email)
    VALUES (NEW.id, NEW.pgr_id, NEW.empresa_id, NULL, NEW.status, 'criada', auth.uid(), NULLIF(_email,''));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.pgr_acao_historico(acao_id, pgr_id, empresa_id, status_anterior, status_novo, campo_alterado, user_id, user_email)
    VALUES (NEW.id, NEW.pgr_id, NEW.empresa_id, OLD.status, NEW.status, 'status', auth.uid(), NULLIF(_email,''));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pgr_acao_log AFTER INSERT OR UPDATE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_acao_log_status();

-- Audit log (redige PDF/hash não — apenas metadados; tabelas não armazenam PDF binário)
CREATE TRIGGER trg_pgr_doc_audit AFTER INSERT OR UPDATE OR DELETE ON public.pgr_documentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_pgr_acao_audit AFTER INSERT OR UPDATE OR DELETE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_pgr_inv_audit AFTER INSERT OR UPDATE OR DELETE ON public.pgr_inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_pgr_perigos_audit AFTER INSERT OR UPDATE OR DELETE ON public.pgr_perigos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- RPCs: pgr_abrir_revisao e pgr_publicar
-- ============================================================
CREATE OR REPLACE FUNCTION public.pgr_abrir_revisao(_pgr_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _src RECORD; _new_id uuid; _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _src FROM public.pgr_documentos WHERE id = _pgr_id;
  IF _src.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _src.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['pgr:revisar'] OR modulos_permitidos @> ARRAY['pgr:editar'] OR modulos_permitidos @> ARRAY['pgr'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão pgr:revisar requerida'; END IF;
  END IF;

  IF _src.status NOT IN ('vigente') THEN
    RAISE EXCEPTION 'Somente PGR vigente pode entrar em revisão';
  END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo da revisão é obrigatório';
  END IF;

  INSERT INTO public.pgr_documentos(
    empresa_id, unidade_id, versao, status, data_emissao,
    data_vigencia_inicio, data_vigencia_fim,
    responsavel_tecnico_id, resp_tec_nome, resp_tec_registro,
    metodologia_avaliacao, escopo, observacoes,
    documento_origem_id, created_by, updated_by
  ) VALUES (
    _src.empresa_id, _src.unidade_id, _src.versao + 1, 'em_revisao'::public.pgr_status, NULL,
    NULL, NULL,
    _src.responsavel_tecnico_id, _src.resp_tec_nome, _src.resp_tec_registro,
    _src.metodologia_avaliacao, _src.escopo, _src.observacoes,
    _src.id, auth.uid(), auth.uid()
  ) RETURNING id INTO _new_id;

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova, status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_new_id, _src.empresa_id, _src.versao, _src.versao + 1, _src.status, 'em_revisao'::public.pgr_status, 'abrir_revisao', _motivo, auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object('success', true, 'pgr_id', _new_id, 'versao', _src.versao + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.pgr_publicar(_pgr_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _doc RECORD; _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
  _has_perm boolean := false; _ant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _doc FROM public.pgr_documentos WHERE id = _pgr_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  _has_perm := public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid());
  IF NOT _has_perm THEN
    IF NOT public.is_in_user_company_tree(auth.uid(), _doc.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para esta empresa';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_liberados
      WHERE lower(email)=_email AND ativo=true
        AND (modulos_permitidos @> ARRAY['pgr:revisar'] OR modulos_permitidos @> ARRAY['pgr'])
    ) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'Permissão pgr:revisar requerida'; END IF;
  END IF;

  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR não está em estado publicável';
  END IF;

  -- Substitui o vigente anterior (mesma empresa+unidade)
  UPDATE public.pgr_documentos
     SET status = 'substituido'::public.pgr_status, updated_at = now()
   WHERE empresa_id = _doc.empresa_id
     AND unidade_id IS NOT DISTINCT FROM _doc.unidade_id
     AND status = 'vigente'::public.pgr_status
     AND id <> _doc.id
   RETURNING id INTO _ant_id;

  UPDATE public.pgr_documentos
     SET status = 'vigente'::public.pgr_status,
         data_emissao = COALESCE(data_emissao, CURRENT_DATE),
         updated_at = now()
   WHERE id = _pgr_id;

  INSERT INTO public.pgr_revisoes(pgr_id, empresa_id, versao_anterior, versao_nova, status_anterior, status_novo, acao, motivo, user_id, user_email)
  VALUES (_pgr_id, _doc.empresa_id, _doc.versao, _doc.versao, _doc.status, 'vigente'::public.pgr_status, 'publicar',
          CASE WHEN _ant_id IS NOT NULL THEN 'Substitui PGR anterior ' || _ant_id::text END,
          auth.uid(), NULLIF(_email,''));

  RETURN jsonb_build_object('success', true, 'pgr_id', _pgr_id, 'substituiu', _ant_id);
END;
$$;

-- ============================================================
-- SEED: catálogo global de perigos (empresa_id = NULL)
-- ============================================================
INSERT INTO public.pgr_perigos_catalogo (empresa_id, grupo, codigo, nome, descricao, norma_referencia) VALUES
  (NULL,'fisico','F01','Ruído contínuo ou intermitente','Pressão sonora acima do limite de tolerância','NR-15 Anexo 1'),
  (NULL,'fisico','F02','Ruído de impacto','Eventos sonoros de curta duração e alta intensidade','NR-15 Anexo 2'),
  (NULL,'fisico','F03','Vibrações de corpo inteiro','Exposição a veículos e máquinas','NR-15 Anexo 8'),
  (NULL,'fisico','F04','Vibrações localizadas (mão-braço)','Ferramentas vibratórias','NR-15 Anexo 8'),
  (NULL,'fisico','F05','Calor','Exposição a fontes de calor / IBUTG','NR-15 Anexo 3'),
  (NULL,'fisico','F06','Frio','Exposição a baixas temperaturas','NR-15 Anexo 9'),
  (NULL,'fisico','F07','Radiações ionizantes','Raios X, gama, alfa, beta','NR-15 Anexo 5'),
  (NULL,'fisico','F08','Radiações não ionizantes','UV, IR, micro-ondas, laser','NR-15 Anexo 7'),
  (NULL,'fisico','F09','Umidade','Ambientes encharcados / alagados','NR-15 Anexo 10'),
  (NULL,'fisico','F10','Pressões anormais','Trabalho hiperbárico','NR-15 Anexo 6'),
  (NULL,'quimico','Q01','Poeiras minerais','Sílica, asbesto, carvão','NR-15 Anexo 12'),
  (NULL,'quimico','Q02','Poeiras vegetais','Algodão, bagaço de cana','NR-15 Anexo 12'),
  (NULL,'quimico','Q03','Fumos metálicos','Soldagem','NR-15 Anexo 11'),
  (NULL,'quimico','Q04','Névoas','Pulverização de tintas/agrotóxicos','NR-15 Anexo 11'),
  (NULL,'quimico','Q05','Neblinas','Aerodispersóides líquidos','NR-15 Anexo 11'),
  (NULL,'quimico','Q06','Gases','CO, CO2, NH3, Cl2, etc.','NR-15 Anexo 11'),
  (NULL,'quimico','Q07','Vapores','Solventes orgânicos','NR-15 Anexo 11'),
  (NULL,'quimico','Q08','Produtos químicos em geral','Ácidos, bases, solventes','NR-15 Anexo 13'),
  (NULL,'quimico','Q09','Benzeno e derivados','Exposição ocupacional','NR-15 Anexo 13-A'),
  (NULL,'quimico','Q10','Amianto/asbesto','Manuseio de fibras','NR-15 Anexo 12'),
  (NULL,'quimico','Q11','Sílica cristalizada','Pó respirável','NR-15 Anexo 12'),
  (NULL,'quimico','Q12','Chumbo','Inorgânico e orgânico','NR-15 Anexo 11'),
  (NULL,'quimico','Q13','Mercúrio','Vapores e compostos','NR-15 Anexo 11'),
  (NULL,'biologico','B01','Vírus','Contato com material biológico','NR-32 / NR-15 Anexo 14'),
  (NULL,'biologico','B02','Bactérias','Manipulação ou exposição','NR-32 / NR-15 Anexo 14'),
  (NULL,'biologico','B03','Fungos','Bolores, leveduras','NR-32 / NR-15 Anexo 14'),
  (NULL,'biologico','B04','Parasitas','Helmintos, protozoários','NR-32 / NR-15 Anexo 14'),
  (NULL,'biologico','B05','Bacilos','Tuberculose, hanseníase','NR-32 / NR-15 Anexo 14'),
  (NULL,'biologico','B06','Material biológico humano','Sangue, secreções','NR-32'),
  (NULL,'biologico','B07','Material biológico animal','Lidar com animais ou carcaças','NR-32'),
  (NULL,'biologico','B08','Esgoto e resíduos','Limpeza urbana / saneamento','NR-15 Anexo 14'),
  (NULL,'ergonomico','E01','Levantamento e transporte manual de carga','Esforço repetitivo / sobrecarga','NR-17'),
  (NULL,'ergonomico','E02','Postura inadequada','Trabalho em pé/sentado prolongado','NR-17'),
  (NULL,'ergonomico','E03','Movimentos repetitivos','LER/DORT','NR-17'),
  (NULL,'ergonomico','E04','Esforço físico intenso','Atividade muscular acima do recomendado','NR-17'),
  (NULL,'ergonomico','E05','Trabalho em turnos / noturno','Alteração do ciclo circadiano','NR-17'),
  (NULL,'ergonomico','E06','Monotonia e repetitividade','Tarefas mentais repetitivas','NR-17'),
  (NULL,'ergonomico','E07','Mobiliário inadequado','Cadeiras, bancadas, displays','NR-17 Anexo II'),
  (NULL,'ergonomico','E08','Iluminação inadequada','Insuficiente, ofuscante ou inadequada','NR-17'),
  (NULL,'ergonomico','E09','Ritmo de trabalho excessivo','Metas e pressão por produção','NR-17'),
  (NULL,'acidente','A01','Trabalho em altura','Acima de 2 m','NR-35'),
  (NULL,'acidente','A02','Trabalho em espaço confinado','Atmosferas IPVS','NR-33'),
  (NULL,'acidente','A03','Eletricidade','Choque elétrico, arco voltaico','NR-10'),
  (NULL,'acidente','A04','Máquinas e equipamentos','Prensas, esmeris, cortadeiras','NR-12'),
  (NULL,'acidente','A05','Veículos automotores','Conduzir ou operar','NR-11/NR-12'),
  (NULL,'acidente','A06','Arranjo físico inadequado','Layout/circulação','NR-08'),
  (NULL,'acidente','A07','Ferramentas inadequadas ou defeituosas','Manuais e elétricas','NR-12'),
  (NULL,'acidente','A08','Iluminação deficiente','Risco de queda/colisão','NR-08'),
  (NULL,'acidente','A09','Quedas em mesmo nível','Piso escorregadio/obstruído','NR-08'),
  (NULL,'acidente','A10','Quedas de diferente nível','Escadas, plataformas','NR-35'),
  (NULL,'acidente','A11','Incêndio e explosão','Materiais inflamáveis/explosivos','NR-23 / NR-20'),
  (NULL,'acidente','A12','Animais peçonhentos','Aranhas, cobras, escorpiões','NR-31'),
  (NULL,'acidente','A13','Soterramento','Escavações','NR-18'),
  (NULL,'acidente','A14','Projeção de partículas','Estilhaços, fragmentos','NR-06'),
  (NULL,'acidente','A15','Perfurocortantes','Agulhas, bisturis, vidros','NR-32'),
  (NULL,'acidente','A16','Atropelamento / colisão','Tráfego interno','NR-11/NR-12'),
  (NULL,'acidente','A17','Soldagem e corte a quente','Trabalho a quente','NR-18 / NR-34'),
  (NULL,'psicossocial','P01','Sobrecarga de trabalho','Excesso de demandas / jornadas longas','NR-01 (gestão riscos psicossociais)'),
  (NULL,'psicossocial','P02','Assédio moral','Conduta abusiva sistemática','NR-01 / Lei 14.457'),
  (NULL,'psicossocial','P03','Assédio sexual','Conduta sexual indesejada','NR-01 / Lei 14.457'),
  (NULL,'psicossocial','P04','Violência no trabalho','Agressões físicas/verbais por terceiros','NR-01'),
  (NULL,'psicossocial','P05','Conflitos interpessoais','Relações de trabalho deterioradas','NR-01'),
  (NULL,'psicossocial','P06','Baixa autonomia decisória','Trabalho sem margem de decisão','NR-01 (AEP/COPSOQ)'),
  (NULL,'psicossocial','P07','Falta de suporte da chefia','Liderança ausente ou agressiva','NR-01 (AEP/COPSOQ)'),
  (NULL,'psicossocial','P08','Insegurança no emprego','Risco percebido de demissão','NR-01 (AEP/COPSOQ)'),
  (NULL,'psicossocial','P09','Ambiguidade e conflito de papéis','Falta de clareza de função','NR-01 (AEP/COPSOQ)'),
  (NULL,'psicossocial','P10','Equilíbrio trabalho-vida','Interferência do trabalho na vida pessoal','NR-01 (AEP/COPSOQ)'),
  (NULL,'psicossocial','P11','Exposição a sofrimento de terceiros','Atendimento a vítimas','NR-01'),
  (NULL,'psicossocial','P12','Isolamento social no trabalho','Trabalho solitário/remoto extremo','NR-01')
ON CONFLICT DO NOTHING;
