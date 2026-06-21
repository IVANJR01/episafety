-- ============================================================
-- eSocial S-2240 — Parte 1: Migrations + RLS + permissões
-- Estrutura interna preparatória. SEM envio real, SEM ICP-Brasil,
-- SEM SOAP, SEM XML completo no audit_log.
-- Padrão arquitetural espelhado em PPP/LTCAT/S-2210.
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.esocial_s2240_status AS ENUM (
  'pendente',
  'pronto_envio',
  'validado_stub',
  'homologacao_stub',
  'simulado',
  'rejeitado_local',
  'retificar',
  'excluido_local'
);

CREATE TYPE public.esocial_s2240_tipo_evento AS ENUM (
  'inicial',
  'alteracao',
  'fim',
  'retificacao',
  'exclusao'
);

CREATE TYPE public.esocial_s2240_tipo_aval AS ENUM ('quantitativa', 'qualitativa');

CREATE TYPE public.esocial_s2240_origem_t24 AS ENUM ('oficial', 'referencial', 'pendente_revisao');

CREATE TYPE public.esocial_s2240_mapeamento_status AS ENUM ('mapeado', 'pendente', 'divergente');

CREATE TYPE public.esocial_s2240_ocorrencia_tipo AS ENUM (
  'validacao_local',
  'geracao_xml_stub',
  'simulacao_envio',
  'rejeicao_local',
  'retificacao_aberta',
  'exclusao_local'
);

CREATE TYPE public.esocial_s2240_ocorrencia_resultado AS ENUM ('ok', 'aviso', 'erro');

-- ---------- TABELA 24 OFICIAL (catálogo de referência) ----------
CREATE TABLE public.esocial_tabela24_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  grupo text,
  unidade_medida_padrao text,
  tipo_avaliacao public.esocial_s2240_tipo_aval,
  aposentadoria_especial boolean NOT NULL DEFAULT false,
  insalubridade_padrao boolean NOT NULL DEFAULT false,
  periculosidade_padrao boolean NOT NULL DEFAULT false,
  observacoes text,
  origem public.esocial_s2240_origem_t24 NOT NULL DEFAULT 'oficial',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esocial_tabela24_agentes TO authenticated;
GRANT ALL ON public.esocial_tabela24_agentes TO service_role;
ALTER TABLE public.esocial_tabela24_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "t24_select" ON public.esocial_tabela24_agentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "t24_service_all" ON public.esocial_tabela24_agentes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER t24_updated_at BEFORE UPDATE ON public.esocial_tabela24_agentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_t24_codigo ON public.esocial_tabela24_agentes(codigo);
CREATE INDEX idx_t24_ativo ON public.esocial_tabela24_agentes(ativo);

-- ---------- MAPEAMENTOS POR EMPRESA ----------
CREATE TABLE public.esocial_s2240_mapeamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  agente_nome text NOT NULL,
  ltcat_catalogo_agente_id uuid REFERENCES public.ltcat_catalogo_agentes(id) ON DELETE SET NULL,
  codigo_t24 text REFERENCES public.esocial_tabela24_agentes(codigo) ON DELETE RESTRICT,
  tipo_avaliacao_esperado public.esocial_s2240_tipo_aval,
  unidade_medida_padrao text,
  aposentadoria_especial boolean NOT NULL DEFAULT false,
  status public.esocial_s2240_mapeamento_status NOT NULL DEFAULT 'pendente',
  observacoes_tecnicas text,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, agente_nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_s2240_mapeamentos TO authenticated;
GRANT ALL ON public.esocial_s2240_mapeamentos TO service_role;
ALTER TABLE public.esocial_s2240_mapeamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_map_all" ON public.esocial_s2240_mapeamentos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER s2240_map_updated_at BEFORE UPDATE ON public.esocial_s2240_mapeamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_s2240_map_empresa ON public.esocial_s2240_mapeamentos(empresa_id);
CREATE INDEX idx_s2240_map_status ON public.esocial_s2240_mapeamentos(status);

-- ---------- EVENTOS S-2240 ----------
CREATE TABLE public.esocial_eventos_s2240 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,

  -- vínculos de origem
  ppp_documento_id uuid REFERENCES public.ppp_documentos(id) ON DELETE SET NULL,
  ppp_periodo_id uuid REFERENCES public.ppp_periodos(id) ON DELETE SET NULL,
  ltcat_documento_id uuid REFERENCES public.ltcat_documentos(id) ON DELETE SET NULL,
  pgr_documento_id uuid REFERENCES public.pgr_documentos(id) ON DELETE SET NULL,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,

  -- dados do vínculo (snapshot)
  cpf_trabalhador text NOT NULL,
  matricula text,
  categoria_esocial text,
  cbo text,
  funcao text,
  lotacao_tributaria text,

  -- evento
  tipo_evento public.esocial_s2240_tipo_evento NOT NULL DEFAULT 'inicial',
  data_inicio_condicao date NOT NULL,
  data_fim_condicao date,
  observacao_complementar text,

  -- retificação/exclusão (preparado, não usado nesta fase)
  ind_retificacao smallint NOT NULL DEFAULT 1 CHECK (ind_retificacao IN (1,2,3)),
  evento_origem_id uuid REFERENCES public.esocial_eventos_s2240(id) ON DELETE SET NULL,
  nr_recibo_origem text,

  -- status técnico/stub
  status public.esocial_s2240_status NOT NULL DEFAULT 'pendente',

  -- XML stub (binário fica no Drive BYOK; banco guarda só metadados)
  xml_sha256 text,
  xml_tamanho_bytes integer,
  xml_drive_id text,
  xml_drive_link text,
  xml_gerado_em timestamptz,
  xml_gerado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- preparação ICP-Brasil/SOAP (fase futura — null por enquanto)
  xml_assinado_drive_id text,
  cert_alias text,

  -- auditoria
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_eventos_s2240 TO authenticated;
GRANT ALL ON public.esocial_eventos_s2240 TO service_role;
ALTER TABLE public.esocial_eventos_s2240 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_evt_select" ON public.esocial_eventos_s2240 FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "s2240_evt_mut" ON public.esocial_eventos_s2240 FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER s2240_evt_updated_at BEFORE UPDATE ON public.esocial_eventos_s2240
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_s2240_evt_empresa ON public.esocial_eventos_s2240(empresa_id);
CREATE INDEX idx_s2240_evt_func ON public.esocial_eventos_s2240(funcionario_id);
CREATE INDEX idx_s2240_evt_ppp ON public.esocial_eventos_s2240(ppp_documento_id);
CREATE INDEX idx_s2240_evt_periodo ON public.esocial_eventos_s2240(ppp_periodo_id);
CREATE INDEX idx_s2240_evt_status ON public.esocial_eventos_s2240(status);

-- proteção: empresa_id imutável + imutabilidade após validação/simulação
CREATE OR REPLACE FUNCTION public.s2240_evt_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id de evento S-2240 é imutável';
  END IF;
  IF OLD.status IN ('validado_stub','homologacao_stub','simulado')
     AND NEW.status = OLD.status
     AND (NEW.data_inicio_condicao IS DISTINCT FROM OLD.data_inicio_condicao
       OR NEW.data_fim_condicao IS DISTINCT FROM OLD.data_fim_condicao
       OR NEW.cpf_trabalhador IS DISTINCT FROM OLD.cpf_trabalhador
       OR NEW.matricula IS DISTINCT FROM OLD.matricula
       OR NEW.cbo IS DISTINCT FROM OLD.cbo
       OR NEW.xml_sha256 IS DISTINCT FROM OLD.xml_sha256) THEN
    RAISE EXCEPTION 'evento S-2240 em status % é imutável; use fluxo de retificação', OLD.status;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_s2240_evt_guard BEFORE UPDATE ON public.esocial_eventos_s2240
  FOR EACH ROW EXECUTE FUNCTION public.s2240_evt_guard();

-- ---------- AGENTES DO EVENTO (snapshot) ----------
CREATE TABLE public.esocial_s2240_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2240(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  ppp_exposicao_id uuid REFERENCES public.ppp_exposicoes(id) ON DELETE SET NULL,
  codigo_t24 text REFERENCES public.esocial_tabela24_agentes(codigo) ON DELETE RESTRICT,
  agente_nome text NOT NULL,
  tipo_avaliacao public.esocial_s2240_tipo_aval,
  intensidade_concentracao numeric,
  limite_tolerancia numeric,
  unidade_medida text,
  tecnica_medicao text,
  insalubridade boolean NOT NULL DEFAULT false,
  periculosidade boolean NOT NULL DEFAULT false,
  aposentadoria_especial boolean NOT NULL DEFAULT false,
  utiliza_epc boolean,
  eficacia_epc boolean,
  utiliza_epi boolean,
  eficacia_epi boolean,
  justificativa_epi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_s2240_agentes TO authenticated;
GRANT ALL ON public.esocial_s2240_agentes TO service_role;
ALTER TABLE public.esocial_s2240_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_ag_all" ON public.esocial_s2240_agentes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER s2240_ag_updated_at BEFORE UPDATE ON public.esocial_s2240_agentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_s2240_ag_evento ON public.esocial_s2240_agentes(evento_id);

-- ---------- EPI DO EVENTO ----------
CREATE TABLE public.esocial_s2240_epi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2240(id) ON DELETE CASCADE,
  agente_evento_id uuid REFERENCES public.esocial_s2240_agentes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  epi_id uuid REFERENCES public.epis(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  ca_numero text,
  ca_validade date,
  eficaz boolean,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_s2240_epi TO authenticated;
GRANT ALL ON public.esocial_s2240_epi TO service_role;
ALTER TABLE public.esocial_s2240_epi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_epi_all" ON public.esocial_s2240_epi FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER s2240_epi_updated_at BEFORE UPDATE ON public.esocial_s2240_epi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_s2240_epi_evento ON public.esocial_s2240_epi(evento_id);

-- ---------- HISTÓRICO (append-only) ----------
CREATE TABLE public.esocial_s2240_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2240(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  status_anterior public.esocial_s2240_status,
  status_novo public.esocial_s2240_status NOT NULL,
  acao text NOT NULL,
  observacao text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.esocial_s2240_historico TO authenticated;
GRANT ALL ON public.esocial_s2240_historico TO service_role;
ALTER TABLE public.esocial_s2240_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_hist_select" ON public.esocial_s2240_historico FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "s2240_hist_insert" ON public.esocial_s2240_historico FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.s2240_hist_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'esocial_s2240_historico é append-only'; END;$$;
CREATE TRIGGER trg_s2240_hist_block_upd BEFORE UPDATE ON public.esocial_s2240_historico
  FOR EACH ROW EXECUTE FUNCTION public.s2240_hist_block_mutations();
CREATE TRIGGER trg_s2240_hist_block_del BEFORE DELETE ON public.esocial_s2240_historico
  FOR EACH ROW EXECUTE FUNCTION public.s2240_hist_block_mutations();
CREATE INDEX idx_s2240_hist_evento ON public.esocial_s2240_historico(evento_id);

-- ---------- OCORRÊNCIAS (validações/tentativas — append-only, sem XML) ----------
CREATE TABLE public.esocial_s2240_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2240(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  tipo public.esocial_s2240_ocorrencia_tipo NOT NULL,
  resultado public.esocial_s2240_ocorrencia_resultado NOT NULL,
  mensagens jsonb NOT NULL DEFAULT '[]'::jsonb,
  xml_sha256 text,
  erro_resumido text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.esocial_s2240_ocorrencias TO authenticated;
GRANT ALL ON public.esocial_s2240_ocorrencias TO service_role;
ALTER TABLE public.esocial_s2240_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_ocor_select" ON public.esocial_s2240_ocorrencias FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "s2240_ocor_insert" ON public.esocial_s2240_ocorrencias FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE OR REPLACE FUNCTION public.s2240_ocor_block_mutations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'esocial_s2240_ocorrencias é append-only'; END;$$;
CREATE TRIGGER trg_s2240_ocor_block_upd BEFORE UPDATE ON public.esocial_s2240_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.s2240_ocor_block_mutations();
CREATE TRIGGER trg_s2240_ocor_block_del BEFORE DELETE ON public.esocial_s2240_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.s2240_ocor_block_mutations();
CREATE INDEX idx_s2240_ocor_evento ON public.esocial_s2240_ocorrencias(evento_id);

-- ---------- TRANSMISSÕES (placeholder vazio para fase futura) ----------
CREATE TABLE public.esocial_s2240_transmissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2240(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  endpoint text,
  protocolo text,
  lote_id text,
  recibo text,
  ambiente smallint,
  status_transmissao text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_s2240_transmissoes TO authenticated;
GRANT ALL ON public.esocial_s2240_transmissoes TO service_role;
ALTER TABLE public.esocial_s2240_transmissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "s2240_tx_all" ON public.esocial_s2240_transmissoes FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE TRIGGER s2240_tx_updated_at BEFORE UPDATE ON public.esocial_s2240_transmissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- HISTÓRICO AUTOMÁTICO em mudanças de status ----------
CREATE OR REPLACE FUNCTION public.s2240_log_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.esocial_s2240_historico(evento_id, empresa_id, status_anterior, status_novo, acao, user_id)
    VALUES (NEW.id, NEW.empresa_id, NULL, NEW.status, 'criado', auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.esocial_s2240_historico(evento_id, empresa_id, status_anterior, status_novo, acao, user_id)
    VALUES (NEW.id, NEW.empresa_id, OLD.status, NEW.status, 'mudanca_status', auth.uid());
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_s2240_evt_log_status AFTER INSERT OR UPDATE OF status ON public.esocial_eventos_s2240
  FOR EACH ROW EXECUTE FUNCTION public.s2240_log_status_change();