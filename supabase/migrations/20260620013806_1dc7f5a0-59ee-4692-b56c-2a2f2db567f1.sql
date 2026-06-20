
-- =====================================================================
-- eSocial S-2210 — Parte 1: estrutura, RLS, triggers, permissões, seeds
-- Stub apenas — sem envio real ao Ambiente Nacional, sem ICP-Brasil.
-- =====================================================================

-- ---------- ENUMS ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.esocial_evento_status AS ENUM (
    'pendente',
    'pronto_envio',
    'validado_stub',
    'homologacao_stub',
    'simulado',
    'aceito',
    'rejeitado',
    'retificar',
    'excluido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.esocial_ind_retif AS ENUM ('original', 'retificacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.esocial_tp_amb AS ENUM ('producao', 'homologacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.esocial_acao_hist AS ENUM (
    'gerado','validado','assinatura_simulada','envio_simulado',
    'consulta_simulada','aceito','rejeitado','retificado',
    'marcado_exclusao','erro','config_alterada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- esocial_config -----------------------------------------------
CREATE TABLE public.esocial_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  tp_amb public.esocial_tp_amb NOT NULL DEFAULT 'homologacao',
  proc_emi smallint NOT NULL DEFAULT 1,
  ver_proc text NOT NULL DEFAULT 'safety-1.0',
  cnpj_raiz text,
  certificado_alias text,
  certificado_validade date,
  ativo boolean NOT NULL DEFAULT false,
  observacoes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_config TO authenticated;
GRANT ALL ON public.esocial_config TO service_role;
ALTER TABLE public.esocial_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_config select scoped" ON public.esocial_config
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_config write super/principal only" ON public.esocial_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- ---------- esocial_eventos_s2210 ----------------------------------------
CREATE TABLE public.esocial_eventos_s2210 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id uuid NOT NULL REFERENCES public.cat_comunicacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  id_evento text UNIQUE,
  versao_layout text NOT NULL DEFAULT 'S-1.3',
  ind_retif public.esocial_ind_retif NOT NULL DEFAULT 'original',
  nr_recibo_origem text,
  tp_amb public.esocial_tp_amb NOT NULL DEFAULT 'homologacao',
  status public.esocial_evento_status NOT NULL DEFAULT 'pendente',
  xml_gerado text,                      -- XML cru, sem assinatura
  xml_assinado_simulado text,           -- placeholder rotulado como simulação
  assinatura_simulada boolean NOT NULL DEFAULT false,
  xml_hash_sha256 text,
  nr_protocolo_simulado text,
  nr_recibo_simulado text,
  dh_processamento timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro_resumo text,
  aviso_nao_enviado text NOT NULL DEFAULT 'Não enviado ao Ambiente Nacional — assinatura ICP-Brasil ainda não implementada — XML gerado apenas para validação técnica',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esocial_evt_cat ON public.esocial_eventos_s2210(cat_id);
CREATE INDEX idx_esocial_evt_empresa ON public.esocial_eventos_s2210(empresa_id);
CREATE INDEX idx_esocial_evt_status ON public.esocial_eventos_s2210(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esocial_eventos_s2210 TO authenticated;
GRANT ALL ON public.esocial_eventos_s2210 TO service_role;
ALTER TABLE public.esocial_eventos_s2210 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_evt select scoped" ON public.esocial_eventos_s2210
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_evt insert scoped" ON public.esocial_eventos_s2210
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_evt update scoped" ON public.esocial_eventos_s2210
  FOR UPDATE TO authenticated
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

CREATE POLICY "esocial_evt delete super/principal only" ON public.esocial_eventos_s2210
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

-- ---------- esocial_eventos_historico (append-only) ----------------------
CREATE TABLE public.esocial_eventos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2210(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  acao public.esocial_acao_hist NOT NULL,
  status_anterior public.esocial_evento_status,
  status_novo public.esocial_evento_status,
  xml_hash_sha256 text,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,   -- nunca XML completo
  erro_resumo text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esocial_hist_evento ON public.esocial_eventos_historico(evento_id);
CREATE INDEX idx_esocial_hist_empresa ON public.esocial_eventos_historico(empresa_id);

GRANT SELECT, INSERT ON public.esocial_eventos_historico TO authenticated;
GRANT ALL ON public.esocial_eventos_historico TO service_role;
ALTER TABLE public.esocial_eventos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_hist select scoped" ON public.esocial_eventos_historico
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_hist insert scoped" ON public.esocial_eventos_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- Append-only: nenhuma policy de UPDATE/DELETE → bloqueado por RLS.
-- Defesa adicional via trigger (caso role bypasse RLS):
CREATE OR REPLACE FUNCTION public.esocial_hist_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'esocial_eventos_historico é append-only';
END;
$$;

CREATE TRIGGER trg_esocial_hist_no_update
  BEFORE UPDATE ON public.esocial_eventos_historico
  FOR EACH ROW EXECUTE FUNCTION public.esocial_hist_block_mutations();

CREATE TRIGGER trg_esocial_hist_no_delete
  BEFORE DELETE ON public.esocial_eventos_historico
  FOR EACH ROW EXECUTE FUNCTION public.esocial_hist_block_mutations();

-- ---------- esocial_retorno_ocorrencias ----------------------------------
CREATE TABLE public.esocial_retorno_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.esocial_eventos_s2210(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  tipo smallint NOT NULL CHECK (tipo IN (1,2)),     -- 1=erro, 2=advertência
  codigo text,
  descricao text NOT NULL,
  localizacao text,
  origem text NOT NULL DEFAULT 'validador_local',   -- nunca AN nesta fase
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esocial_occ_evento ON public.esocial_retorno_ocorrencias(evento_id);

GRANT SELECT, INSERT ON public.esocial_retorno_ocorrencias TO authenticated;
GRANT ALL ON public.esocial_retorno_ocorrencias TO service_role;
ALTER TABLE public.esocial_retorno_ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_occ select scoped" ON public.esocial_retorno_ocorrencias
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_occ insert scoped" ON public.esocial_retorno_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- ---------- esocial_cid10 (referência pública, sem empresa) --------------
CREATE TABLE public.esocial_cid10 (
  codigo text PRIMARY KEY,
  descricao text NOT NULL,
  categoria text
);
GRANT SELECT ON public.esocial_cid10 TO authenticated;
GRANT ALL ON public.esocial_cid10 TO service_role;
ALTER TABLE public.esocial_cid10 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esocial_cid10 read authenticated" ON public.esocial_cid10
  FOR SELECT TO authenticated USING (true);

-- ---------- esocial_municipios_ibge --------------------------------------
CREATE TABLE public.esocial_municipios_ibge (
  codigo text PRIMARY KEY,            -- 7 dígitos
  nome text NOT NULL,
  uf text NOT NULL
);
CREATE INDEX idx_esocial_mun_uf ON public.esocial_municipios_ibge(uf);
GRANT SELECT ON public.esocial_municipios_ibge TO authenticated;
GRANT ALL ON public.esocial_municipios_ibge TO service_role;
ALTER TABLE public.esocial_municipios_ibge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esocial_mun read authenticated" ON public.esocial_municipios_ibge
  FOR SELECT TO authenticated USING (true);

-- ---------- updated_at triggers ------------------------------------------
CREATE TRIGGER trg_esocial_config_updated
  BEFORE UPDATE ON public.esocial_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_esocial_evt_updated
  BEFORE UPDATE ON public.esocial_eventos_s2210
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Audit log triggers (reaproveita public.audit_trigger) --------
CREATE TRIGGER trg_audit_esocial_config
  AFTER INSERT OR UPDATE OR DELETE ON public.esocial_config
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_audit_esocial_evt
  AFTER INSERT OR UPDATE OR DELETE ON public.esocial_eventos_s2210
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ---------- Histórico append-only: trigger automático no evento ----------
CREATE OR REPLACE FUNCTION public.esocial_evt_log_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(COALESCE(auth.jwt() ->> 'email',''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.esocial_eventos_historico(
      evento_id, empresa_id, acao, status_anterior, status_novo,
      xml_hash_sha256, metadados, user_id, user_email
    ) VALUES (
      NEW.id, NEW.empresa_id, 'gerado', NULL, NEW.status,
      NEW.xml_hash_sha256,
      jsonb_build_object(
        'tp_amb', NEW.tp_amb,
        'ind_retif', NEW.ind_retif,
        'versao_layout', NEW.versao_layout
      ),
      auth.uid(), NULLIF(_email,'')
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.esocial_eventos_historico(
      evento_id, empresa_id, acao, status_anterior, status_novo,
      xml_hash_sha256, metadados, erro_resumo, user_id, user_email
    ) VALUES (
      NEW.id, NEW.empresa_id,
      CASE NEW.status
        WHEN 'validado_stub' THEN 'validado'::public.esocial_acao_hist
        WHEN 'homologacao_stub' THEN 'envio_simulado'::public.esocial_acao_hist
        WHEN 'simulado' THEN 'envio_simulado'::public.esocial_acao_hist
        WHEN 'aceito' THEN 'aceito'::public.esocial_acao_hist
        WHEN 'rejeitado' THEN 'rejeitado'::public.esocial_acao_hist
        WHEN 'retificar' THEN 'retificado'::public.esocial_acao_hist
        WHEN 'excluido' THEN 'marcado_exclusao'::public.esocial_acao_hist
        ELSE 'validado'::public.esocial_acao_hist
      END,
      OLD.status, NEW.status,
      NEW.xml_hash_sha256,
      jsonb_build_object('tentativas', NEW.tentativas, 'assinatura_simulada', NEW.assinatura_simulada),
      NEW.ultimo_erro_resumo,
      auth.uid(), NULLIF(_email,'')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_esocial_evt_log_status
  AFTER INSERT OR UPDATE ON public.esocial_eventos_s2210
  FOR EACH ROW EXECUTE FUNCTION public.esocial_evt_log_status();

-- ---------- Guard: empresa_id imutável + status legais -------------------
CREATE OR REPLACE FUNCTION public.esocial_evt_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat_empresa uuid;
BEGIN
  SELECT empresa_id INTO _cat_empresa FROM public.cat_comunicacoes WHERE id = NEW.cat_id;
  IF _cat_empresa IS NULL THEN
    RAISE EXCEPTION 'CAT inexistente';
  END IF;
  IF NEW.empresa_id IS DISTINCT FROM _cat_empresa THEN
    RAISE EXCEPTION 'empresa_id do evento difere da empresa da CAT';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'empresa_id não pode ser alterado';
    END IF;
    IF NEW.cat_id IS DISTINCT FROM OLD.cat_id THEN
      RAISE EXCEPTION 'cat_id não pode ser alterado';
    END IF;
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_esocial_evt_guard
  BEFORE INSERT OR UPDATE ON public.esocial_eventos_s2210
  FOR EACH ROW EXECUTE FUNCTION public.esocial_evt_guard();

-- ---------- Seeds mínimos -------------------------------------------------
INSERT INTO public.esocial_cid10(codigo, descricao, categoria) VALUES
  ('S00','Traumatismo superficial da cabeça','S00-S09'),
  ('S01','Ferimento da cabeça','S00-S09'),
  ('S20','Traumatismo superficial do tórax','S20-S29'),
  ('S40','Traumatismo superficial do ombro e braço','S40-S49'),
  ('S60','Traumatismo superficial do punho e mão','S60-S69'),
  ('S61','Ferimento do punho e mão','S60-S69'),
  ('S62','Fratura ao nível do punho e mão','S60-S69'),
  ('S80','Traumatismo superficial da perna','S80-S89'),
  ('S81','Ferimento da perna','S80-S89'),
  ('S82','Fratura da perna, incluindo tornozelo','S80-S89'),
  ('S90','Traumatismo superficial do tornozelo e pé','S90-S99'),
  ('T14','Traumatismo de região não especificada do corpo','T08-T14'),
  ('T20','Queimadura e corrosão da cabeça e pescoço','T20-T32'),
  ('T75','Outros efeitos de causas externas','T66-T78')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.esocial_municipios_ibge(codigo, nome, uf) VALUES
  ('3550308','São Paulo','SP'),
  ('3304557','Rio de Janeiro','RJ'),
  ('3106200','Belo Horizonte','MG'),
  ('5300108','Brasília','DF'),
  ('2611606','Recife','PE'),
  ('2927408','Salvador','BA'),
  ('2304400','Fortaleza','CE'),
  ('1302603','Manaus','AM'),
  ('1501402','Belém','PA'),
  ('4106902','Curitiba','PR'),
  ('4314902','Porto Alegre','RS'),
  ('4205407','Florianópolis','SC'),
  ('5208707','Goiânia','GO'),
  ('5002704','Campo Grande','MS'),
  ('5103403','Cuiabá','MT')
ON CONFLICT (codigo) DO NOTHING;
