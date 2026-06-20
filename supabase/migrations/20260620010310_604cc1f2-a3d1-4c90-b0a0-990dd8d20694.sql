
-- =====================================================================
-- MÓDULO CAT — Comunicação de Acidente de Trabalho (Fase 1)
-- =====================================================================

-- 1. CATÁLOGOS -------------------------------------------------------------

CREATE TABLE public.cat_situacoes_geradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cat_situacoes_geradoras TO authenticated;
GRANT ALL ON public.cat_situacoes_geradoras TO service_role;
ALTER TABLE public.cat_situacoes_geradoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_sit_select_auth" ON public.cat_situacoes_geradoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_sit_admin_write" ON public.cat_situacoes_geradoras FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

CREATE TABLE public.cat_agentes_causadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cat_agentes_causadores TO authenticated;
GRANT ALL ON public.cat_agentes_causadores TO service_role;
ALTER TABLE public.cat_agentes_causadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_age_select_auth" ON public.cat_agentes_causadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_age_admin_write" ON public.cat_agentes_causadores FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

CREATE TABLE public.cat_partes_atingidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cat_partes_atingidas TO authenticated;
GRANT ALL ON public.cat_partes_atingidas TO service_role;
ALTER TABLE public.cat_partes_atingidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_par_select_auth" ON public.cat_partes_atingidas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_par_admin_write" ON public.cat_partes_atingidas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

CREATE TABLE public.cat_naturezas_lesao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cat_naturezas_lesao TO authenticated;
GRANT ALL ON public.cat_naturezas_lesao TO service_role;
ALTER TABLE public.cat_naturezas_lesao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_nat_select_auth" ON public.cat_naturezas_lesao FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_nat_admin_write" ON public.cat_naturezas_lesao FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- 2. NUMERAÇÃO -------------------------------------------------------------

CREATE TABLE public.cat_numeracao (
  empresa_id uuid NOT NULL,
  ano int NOT NULL,
  ultimo_seq int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, ano)
);
GRANT SELECT ON public.cat_numeracao TO authenticated;
GRANT ALL ON public.cat_numeracao TO service_role;
ALTER TABLE public.cat_numeracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_num_select_scope" ON public.cat_numeracao FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- 3. CAT — TABELA PRINCIPAL ------------------------------------------------

CREATE TYPE public.cat_tipo AS ENUM ('inicial', 'reabertura', 'comunicacao_obito');
CREATE TYPE public.cat_status AS ENUM ('rascunho', 'pronto_para_envio', 'concluida', 'enviada_esocial', 'rejeitada_esocial', 'cancelada');
CREATE TYPE public.cat_emitente_tipo AS ENUM ('empregador', 'sindicato', 'medico', 'autoridade', 'segurado', 'dependente');
CREATE TYPE public.cat_tipo_acidente AS ENUM ('tipico', 'trajeto', 'doenca_ocupacional');

CREATE TABLE public.cat_comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE RESTRICT,
  unidade_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  numero_cat text,
  tipo_cat public.cat_tipo NOT NULL DEFAULT 'inicial',
  cat_origem_id uuid REFERENCES public.cat_comunicacoes(id) ON DELETE SET NULL,
  status public.cat_status NOT NULL DEFAULT 'rascunho',

  -- Funcionário / acidentado
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  cbo text,
  remuneracao_mensal numeric(12,2),
  jornada_semanal_horas numeric(5,2),

  -- Acidente
  data_acidente date NOT NULL,
  hora_acidente time,
  tipo_acidente public.cat_tipo_acidente NOT NULL DEFAULT 'tipico',
  houve_afastamento boolean NOT NULL DEFAULT false,
  ultimo_dia_trabalhado date,
  local_acidente text,
  endereco_local text,
  cep text,
  municipio text,
  uf text,
  pais text DEFAULT 'BRA',
  obito boolean NOT NULL DEFAULT false,
  data_obito date,

  -- Lesão
  situacao_geradora_id uuid REFERENCES public.cat_situacoes_geradoras(id),
  agente_causador_id uuid REFERENCES public.cat_agentes_causadores(id),
  parte_atingida_id uuid REFERENCES public.cat_partes_atingidas(id),
  lateralidade text CHECK (lateralidade IN ('D','E','A','N')),
  natureza_lesao_id uuid REFERENCES public.cat_naturezas_lesao(id),
  cid_codigo text,
  cid_descricao text,

  -- Atendimento médico
  data_atendimento date,
  hora_atendimento time,
  hospital text,
  medico_id uuid REFERENCES public.aso_medicos(id) ON DELETE SET NULL,
  medico_nome text,
  medico_crm text,
  medico_uf text,
  houve_internacao boolean DEFAULT false,
  descricao_lesao text,

  -- Vínculo opcional com ASO/exame
  aso_id uuid REFERENCES public.asos(id) ON DELETE SET NULL,
  exame_id uuid REFERENCES public.exames(id) ON DELETE SET NULL,

  -- Emitente
  emitente_tipo public.cat_emitente_tipo NOT NULL DEFAULT 'empregador',
  emitente_nome text,
  emitente_cpf text,
  emitente_cargo text,

  -- Cancelamento
  motivo_cancelamento text,
  cancelada_em timestamptz,
  cancelada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Conclusão
  concluida_em timestamptz,
  concluida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- PDF
  pdf_drive_file_id text,
  pdf_hash text,
  pdf_gerado_em timestamptz,

  -- eSocial (stub Fase 1)
  esocial_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  esocial_status text,
  esocial_recibo text,
  esocial_protocolo text,
  esocial_enviado_em timestamptz,
  esocial_erro jsonb,

  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cat_numero_empresa_unique UNIQUE (empresa_id, numero_cat),
  CONSTRAINT cat_obito_data_check CHECK (NOT obito OR data_obito IS NOT NULL),
  CONSTRAINT cat_afastamento_check CHECK (NOT houve_afastamento OR ultimo_dia_trabalhado IS NOT NULL),
  CONSTRAINT cat_reabertura_origem_check CHECK (tipo_cat = 'inicial' OR cat_origem_id IS NOT NULL)
);

CREATE INDEX idx_cat_empresa ON public.cat_comunicacoes(empresa_id);
CREATE INDEX idx_cat_funcionario ON public.cat_comunicacoes(funcionario_id);
CREATE INDEX idx_cat_data_acidente ON public.cat_comunicacoes(data_acidente DESC);
CREATE INDEX idx_cat_status ON public.cat_comunicacoes(status);
CREATE INDEX idx_cat_contrato ON public.cat_comunicacoes(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cat_comunicacoes TO authenticated;
GRANT ALL ON public.cat_comunicacoes TO service_role;
ALTER TABLE public.cat_comunicacoes ENABLE ROW LEVEL SECURITY;

-- RLS: isolamento por empresa
CREATE POLICY "cat_select_scope" ON public.cat_comunicacoes FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
    OR funcionario_id IN (SELECT public.get_my_funcionario_ids())
  );

CREATE POLICY "cat_insert_scope" ON public.cat_comunicacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "cat_update_scope" ON public.cat_comunicacoes FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "cat_delete_principal" ON public.cat_comunicacoes FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- 4. TESTEMUNHAS -----------------------------------------------------------

CREATE TABLE public.cat_testemunhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id uuid NOT NULL REFERENCES public.cat_comunicacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  cpf text,
  cargo text,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_test_cat ON public.cat_testemunhas(cat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cat_testemunhas TO authenticated;
GRANT ALL ON public.cat_testemunhas TO service_role;
ALTER TABLE public.cat_testemunhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_test_scope_all" ON public.cat_testemunhas FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- 5. ANEXOS (metadados Google Drive) ---------------------------------------

CREATE TABLE public.cat_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id uuid NOT NULL REFERENCES public.cat_comunicacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('boletim_ocorrencia','atestado_medico','aso_relacionado','foto_local','laudo','outros')),
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  drive_file_id text,
  drive_path text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_anx_cat ON public.cat_anexos(cat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cat_anexos TO authenticated;
GRANT ALL ON public.cat_anexos TO service_role;
ALTER TABLE public.cat_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_anx_scope_all" ON public.cat_anexos FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- 6. HISTÓRICO (append-only) -----------------------------------------------

CREATE TABLE public.cat_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id uuid NOT NULL REFERENCES public.cat_comunicacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  status_anterior public.cat_status,
  status_novo public.cat_status,
  acao text NOT NULL,
  motivo text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_hist_cat ON public.cat_historico(cat_id, created_at DESC);
GRANT SELECT, INSERT ON public.cat_historico TO authenticated;
GRANT ALL ON public.cat_historico TO service_role;
ALTER TABLE public.cat_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_hist_select_scope" ON public.cat_historico FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );
CREATE POLICY "cat_hist_insert_scope" ON public.cat_historico FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );
-- bloqueia UPDATE/DELETE explicitamente (append-only)
CREATE POLICY "cat_hist_no_update" ON public.cat_historico FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "cat_hist_no_delete" ON public.cat_historico FOR DELETE TO authenticated USING (false);

-- 7. TRIGGERS DE PROTEÇÃO --------------------------------------------------

-- 7.1 updated_at
CREATE TRIGGER trg_cat_updated_at
  BEFORE UPDATE ON public.cat_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7.2 Guard: empresa_id imutável + funcionario da mesma empresa
CREATE OR REPLACE FUNCTION public.cat_guard_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _func_empresa_id uuid;
  _func_empresa_pai uuid;
  _cat_empresa_pai uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'empresa_id da CAT não pode ser alterado após criação';
    END IF;
    -- Bloqueia edição de CAT concluída/enviada (exceto status/eSocial/PDF)
    IF OLD.status IN ('concluida','enviada_esocial','cancelada')
       AND NEW.status = OLD.status
       AND (NEW.data_acidente <> OLD.data_acidente OR NEW.funcionario_id <> OLD.funcionario_id) THEN
      RAISE EXCEPTION 'CAT % não pode ser editada neste status', OLD.status;
    END IF;
  END IF;

  -- Funcionário precisa pertencer à mesma empresa (ou filial dela)
  SELECT empresa_id INTO _func_empresa_id FROM public.funcionarios WHERE id = NEW.funcionario_id;
  IF _func_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário inválido';
  END IF;

  SELECT COALESCE(empresa_pai_id, id) INTO _func_empresa_pai FROM public.empresa_config WHERE id = _func_empresa_id;
  SELECT COALESCE(empresa_pai_id, id) INTO _cat_empresa_pai FROM public.empresa_config WHERE id = NEW.empresa_id;

  IF _func_empresa_pai IS DISTINCT FROM _cat_empresa_pai THEN
    RAISE EXCEPTION 'Funcionário não pertence à mesma empresa da CAT';
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cat_guard
  BEFORE INSERT OR UPDATE ON public.cat_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.cat_guard_integrity();

-- 7.3 Propaga empresa_id para tabelas filhas
CREATE OR REPLACE FUNCTION public.cat_child_inherit_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp uuid;
BEGIN
  SELECT empresa_id INTO _emp FROM public.cat_comunicacoes WHERE id = NEW.cat_id;
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'CAT inexistente';
  END IF;
  NEW.empresa_id := _emp;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cat_test_inherit BEFORE INSERT OR UPDATE ON public.cat_testemunhas
  FOR EACH ROW EXECUTE FUNCTION public.cat_child_inherit_empresa();
CREATE TRIGGER trg_cat_anx_inherit BEFORE INSERT OR UPDATE ON public.cat_anexos
  FOR EACH ROW EXECUTE FUNCTION public.cat_child_inherit_empresa();
CREATE TRIGGER trg_cat_hist_inherit BEFORE INSERT ON public.cat_historico
  FOR EACH ROW EXECUTE FUNCTION public.cat_child_inherit_empresa();

-- 7.4 Histórico automático de transição de status
CREATE OR REPLACE FUNCTION public.cat_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cat_historico (cat_id, empresa_id, status_anterior, status_novo, acao, user_id, user_email)
    VALUES (NEW.id, NEW.empresa_id, NULL, NEW.status, 'criada', auth.uid(), lower(COALESCE(auth.jwt() ->> 'email','')));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.cat_historico (cat_id, empresa_id, status_anterior, status_novo, acao, motivo, user_id, user_email)
    VALUES (NEW.id, NEW.empresa_id, OLD.status, NEW.status, 'status_alterado',
            CASE WHEN NEW.status = 'cancelada' THEN NEW.motivo_cancelamento END,
            auth.uid(), lower(COALESCE(auth.jwt() ->> 'email','')));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cat_log_status
  AFTER INSERT OR UPDATE ON public.cat_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.cat_log_status_change();

-- 7.5 Audit log genérico
CREATE TRIGGER trg_cat_audit AFTER INSERT OR UPDATE OR DELETE ON public.cat_comunicacoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_cat_test_audit AFTER INSERT OR UPDATE OR DELETE ON public.cat_testemunhas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER trg_cat_anx_audit AFTER INSERT OR UPDATE OR DELETE ON public.cat_anexos
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 8. FUNÇÃO gerar_numero_cat -----------------------------------------------

CREATE OR REPLACE FUNCTION public.gerar_numero_cat(_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ano int := EXTRACT(YEAR FROM now())::int;
  _seq int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _empresa_id)) THEN
    RAISE EXCEPTION 'Sem permissão para gerar número de CAT desta empresa';
  END IF;

  INSERT INTO public.cat_numeracao (empresa_id, ano, ultimo_seq)
  VALUES (_empresa_id, _ano, 1)
  ON CONFLICT (empresa_id, ano) DO UPDATE
    SET ultimo_seq = public.cat_numeracao.ultimo_seq + 1,
        updated_at = now()
  RETURNING ultimo_seq INTO _seq;

  RETURN 'CAT-' || _ano::text || '-' || lpad(_seq::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_numero_cat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_numero_cat(uuid) TO authenticated;

-- 9. SEEDS DOS CATÁLOGOS ---------------------------------------------------

INSERT INTO public.cat_situacoes_geradoras (codigo, descricao) VALUES
  ('010','Impacto de pessoa contra objeto parado'),
  ('020','Impacto sofrido por pessoa de objeto em movimento'),
  ('030','Aprisionamento em, sob ou entre objetos'),
  ('040','Queda de pessoa com diferença de nível'),
  ('050','Queda de pessoa em mesmo nível'),
  ('060','Esforço excessivo ou movimento inadequado'),
  ('070','Exposição a energia elétrica'),
  ('080','Exposição a temperatura extrema'),
  ('090','Contato com substância ou radiação'),
  ('100','Atrito ou abrasão'),
  ('110','Acidente de trânsito'),
  ('120','Agressão por animal'),
  ('130','Agressão por terceiros'),
  ('999','Outros')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.cat_agentes_causadores (codigo, descricao) VALUES
  ('010','Máquinas e equipamentos'),
  ('020','Ferramentas manuais'),
  ('030','Veículos de transporte'),
  ('040','Materiais e substâncias químicas'),
  ('050','Eletricidade'),
  ('060','Estruturas e superfícies de trabalho'),
  ('070','Animais'),
  ('080','Agentes biológicos'),
  ('090','Radiações'),
  ('100','Ruído'),
  ('110','Temperaturas extremas'),
  ('999','Outros')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.cat_partes_atingidas (codigo, descricao) VALUES
  ('010','Cabeça'),('020','Olho'),('030','Face'),('040','Pescoço'),
  ('050','Tórax'),('060','Abdômen'),('070','Coluna vertebral'),
  ('080','Membro superior'),('090','Mão'),('100','Dedo da mão'),
  ('110','Membro inferior'),('120','Pé'),('130','Dedo do pé'),
  ('140','Múltiplas partes'),('999','Outros')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.cat_naturezas_lesao (codigo, descricao) VALUES
  ('010','Escoriação / abrasão'),('020','Corte / laceração'),
  ('030','Contusão / esmagamento'),('040','Fratura'),
  ('050','Luxação'),('060','Entorse'),('070','Queimadura'),
  ('080','Amputação'),('090','Intoxicação'),('100','Choque elétrico'),
  ('110','Asfixia'),('120','Lesão por esforço repetitivo (LER)'),
  ('130','Trauma psicológico'),('999','Outros')
ON CONFLICT (codigo) DO NOTHING;

-- 10. MFA: adiciona ações privilegiadas CAT --------------------------------
-- (não há tabela de ações; o frontend usa useMfaStatus para gate visual.
--  As funções privilegiadas já checam permissão; MFA é forçado no client.)

COMMENT ON TABLE public.cat_comunicacoes IS 'Módulo CAT — Comunicação de Acidente de Trabalho (eSocial S-2210). Fase 1: estrutura, RLS e numeração. Integração eSocial em fase futura.';
