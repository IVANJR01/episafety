-- =====================================================================
-- Dossiê Digital do Colaborador — fecha o Arquivo Digital SST
--
-- O núcleo (20260808000000) já entregou documento + versões + situação
-- calculada + bucket privado. Esta migration acrescenta o que faltava
-- para o dossiê ser o arquivo interno da empresa, e não só controle de
-- treinamento:
--
--   1. Requisitos por função  → sustenta o status "Não aplicável"
--   2. Estado "em renovação"  → documento cuja renovação foi iniciada
--   3. Histórico com "Substituída" → versão anterior nunca some
--   4. Alertas por marco de prazo (60/30/15/7/1/0/vencido)
--   5. Responsáveis por tipo de documento
--   6. Auditoria de MUTAÇÃO (enviou/renovou/arquivou/desarquivou)
--   7. Tipos que faltavam: subtipos de ASO, CNH, pessoais, termos...
--
-- NOTA sobre auditoria: já existe `document_access_log`
-- (20260808060000) para LEITURA — quem abriu/baixou. Esta migration
-- acrescenta `document_audit_events` para MUTAÇÃO. São coisas
-- diferentes de propósito: leitura é volumosa e rotineira, mutação é
-- rara e é o que se apresenta numa fiscalização. Misturar as duas numa
-- tabela só faria o evento importante se perder no meio do ruído.
-- =====================================================================

-- ============ 1. ESTADO "EM RENOVAÇÃO" NO DOCUMENTO ============

ALTER TABLE public.internal_documents
  ADD COLUMN IF NOT EXISTS em_renovacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

COMMENT ON COLUMN public.internal_documents.em_renovacao IS
  'Renovação iniciada mas ainda sem arquivo novo publicado. Some sozinho quando a versão nova entra (trigger trg_idv_encerra_renovacao).';

-- Publicar versão nova encerra a renovação automaticamente — ninguém
-- precisa lembrar de desmarcar, e o estado não fica preso se a pessoa
-- fechar a tela no meio.
CREATE OR REPLACE FUNCTION public.encerrar_renovacao_documento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE public.internal_documents
     SET em_renovacao = false, updated_at = now()
   WHERE id = NEW.documento_id AND em_renovacao = true;
  RETURN NEW;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.encerrar_renovacao_documento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_idv_encerra_renovacao ON public.internal_document_versions;
CREATE TRIGGER trg_idv_encerra_renovacao AFTER INSERT ON public.internal_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.encerrar_renovacao_documento();

-- ============ 2. REQUISITOS POR FUNÇÃO ("Não aplicável") ============

-- Sem isto não há como distinguir "faltou enviar" de "não se aplica a
-- esta função" — e um dossiê que cobra NR-35 de quem trabalha sentado
-- vira ruído que ninguém olha.
CREATE TABLE IF NOT EXISTS public.internal_document_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  tipo_documento_id UUID NOT NULL REFERENCES public.internal_document_types(id) ON DELETE CASCADE,
  -- NULL = exigido de todo colaborador da empresa (ASO, Ficha de EPI...).
  -- Preenchido = exigido só de quem tem esse cargo (NR-35 de quem sobe).
  cargo TEXT,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idr_unico
  ON public.internal_document_requirements(empresa_id, tipo_documento_id, lower(COALESCE(cargo, '')));
CREATE INDEX IF NOT EXISTS idx_idr_empresa ON public.internal_document_requirements(empresa_id);

-- ============ 3. RESPONSÁVEIS ============

CREATE TABLE IF NOT EXISTS public.document_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  -- NULL = responsável por todo documento da empresa.
  tipo_documento_id UUID REFERENCES public.internal_document_types(id) ON DELETE CASCADE,
  usuario_id UUID,
  email TEXT NOT NULL,
  nome TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dr_unico
  ON public.document_responsibles(empresa_id, COALESCE(tipo_documento_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email));

-- ============ 4. ALERTAS POR MARCO DE PRAZO ============

CREATE TABLE IF NOT EXISTS public.document_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  unidade_id UUID,
  documento_id UUID NOT NULL REFERENCES public.internal_documents(id) ON DELETE CASCADE,
  colaborador_id UUID,
  tipo_documento_id UUID,
  -- Dias que faltavam quando o alerta nasceu: 60/30/15/7/1, 0 no dia,
  -- negativo depois de vencido.
  marco INTEGER NOT NULL,
  data_validade DATE,
  responsavel_email TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','ignorado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID
);

-- Idempotência do gerador: o mesmo marco, para a mesma validade daquele
-- documento, nasce UMA vez. Sem isto o cron diário criaria alerta novo
-- todo dia e a caixa viraria spam — o mesmo motivo que levou o e-mail
-- diário a só disparar nos marcos exatos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_da_unico
  ON public.document_alerts(documento_id, marco, COALESCE(data_validade, '1900-01-01'::date));
CREATE INDEX IF NOT EXISTS idx_da_empresa_status ON public.document_alerts(empresa_id, status, created_at DESC);

-- ============ 5. AUDITORIA DE MUTAÇÃO ============

CREATE TABLE IF NOT EXISTS public.document_audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  documento_id UUID REFERENCES public.internal_documents(id) ON DELETE CASCADE,
  versao_id UUID,
  colaborador_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('enviou','renovou','iniciou_renovacao','cancelou_renovacao','arquivou','desarquivou','importou')),
  detalhe TEXT,
  usuario_id UUID,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dae_documento ON public.document_audit_events(documento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dae_empresa ON public.document_audit_events(empresa_id, created_at DESC);

-- ============ 6. VIEW DE SITUAÇÃO — acrescenta "em_renovacao" ============

CREATE OR REPLACE VIEW public.internal_documents_situacao AS
SELECT
  d.id, d.empresa_id, d.unidade_id, d.colaborador_id, d.tipo_documento_id,
  t.nome AS tipo_nome, t.categoria, t.dias_aviso, d.arquivado_em,
  d.arquivado_motivo, d.em_renovacao,
  v.id AS versao_id, v.versao AS versao_numero, v.caminho_arquivo,
  v.nome_original, v.hash_sha256, v.data_emissao, v.data_validade,
  v.created_at AS enviado_em, v.created_by AS enviado_por,
  (SELECT count(*) FROM public.internal_document_versions x WHERE x.documento_id = d.id) AS total_versoes,
  CASE
    WHEN d.arquivado_em IS NOT NULL     THEN 'arquivado'
    WHEN v.id IS NULL                   THEN 'nao_enviado'
    -- Em renovação vem DEPOIS de vencido de propósito: um documento
    -- vencido continua vencido enquanto o arquivo novo não chega. Marcar
    -- como "em renovação" esconderia a irregularidade que ainda existe.
    WHEN v.data_validade IS NOT NULL
         AND v.data_validade < CURRENT_DATE THEN 'vencido'
    WHEN d.em_renovacao                 THEN 'em_renovacao'
    WHEN v.data_validade IS NULL        THEN 'vigente'
    WHEN v.data_validade <= CURRENT_DATE
         + ((COALESCE((SELECT max(x) FROM unnest(t.dias_aviso) x), 30))::text || ' days')::interval
                                        THEN 'vence_em_breve'
    ELSE 'vigente'
  END AS situacao,
  CASE WHEN v.data_validade IS NULL THEN NULL ELSE (v.data_validade - CURRENT_DATE) END AS dias_para_vencer
FROM public.internal_documents d
JOIN public.internal_document_types t ON t.id = d.tipo_documento_id
LEFT JOIN LATERAL (
  SELECT * FROM public.internal_document_versions v2
  WHERE v2.documento_id = d.id ORDER BY v2.versao DESC LIMIT 1
) v ON true;

-- CREATE OR REPLACE preserva reloptions, mas reafirmar é barato e evita
-- que a correção de vazamento entre empresas (20260808040000) se perca
-- silenciosamente numa recriação futura.
ALTER VIEW public.internal_documents_situacao SET (security_invoker = true);

-- ============ 7. VIEW DE HISTÓRICO — versão anterior = "Substituída" ============

CREATE OR REPLACE VIEW public.internal_document_versions_historico AS
SELECT
  v.*,
  CASE WHEN v.versao = max(v.versao) OVER (PARTITION BY v.documento_id)
       THEN 'atual' ELSE 'substituida' END AS situacao_versao,
  max(v.versao) OVER (PARTITION BY v.documento_id) AS versao_atual
FROM public.internal_document_versions v;

ALTER VIEW public.internal_document_versions_historico SET (security_invoker = true);

COMMENT ON VIEW public.internal_document_versions_historico IS
  'Histórico completo. "substituida" é derivado (versão < a maior do documento), nunca gravado — versão nenhuma é apagada ou reescrita.';

-- ============ 8. GRANTS + RLS DAS TABELAS NOVAS ============

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_document_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_responsibles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_alerts TO authenticated;
GRANT SELECT, INSERT ON public.document_audit_events TO authenticated;
GRANT SELECT ON public.internal_document_versions_historico TO authenticated;

ALTER TABLE public.internal_document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_events ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de todo o Arquivo Digital: get_user_empresa_ids(email do
-- JWT) — cobre usuario_empresas E usuarios_liberados de uma vez.
DO $$
DECLARE
  t TEXT;
  escopo TEXT := '(empresa_id = ANY (public.get_user_empresa_ids(auth.jwt() ->> ''email'')) OR public.has_role(auth.uid(), ''admin''::public.app_role))';
BEGIN
  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles','document_alerts','document_audit_events']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING %s', t, t, escopo);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t, t, escopo);
  END LOOP;

  -- UPDATE só onde faz sentido: requisito/responsável se edita; alerta se
  -- resolve. Evento de auditoria não — registro que se edita não é prova.
  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles','document_alerts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING %s', t, t, escopo);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['internal_document_requirements','document_responsibles']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING %s', t, t, escopo);
  END LOOP;
END $$;

-- ============ 9. TIPOS QUE FALTAVAM (catálogo global) ============

-- Subtipos de ASO: o tipo genérico "ASO - Atestado de Saúde Ocupacional"
-- (20260808020000) continua existindo e com os documentos já anexados
-- nele — não se mexe em documento publicado. Os subtipos entram para o
-- ASO novo nascer classificado pelo tipo de exame, que é como a NR-07
-- trata o assunto.
INSERT INTO public.internal_document_types
  (empresa_id, nome, categoria, validade_meses, exige_arquivo, dias_aviso, ativo)
SELECT NULL, nome, categoria, NULL, true, '{60,30,15,7,1}', true
FROM (VALUES
  ('ASO Admissional',                  'saude'),
  ('ASO Periódico',                    'saude'),
  ('ASO Mudança de Risco/Função',      'saude'),
  ('ASO Retorno ao Trabalho',          'saude'),
  ('ASO Demissional',                  'saude'),
  ('Integração',                       'capacitacao'),
  ('NR-10 SEP',                        'capacitacao'),
  ('CNH',                              'pessoal'),
  ('Documentos Pessoais (RG/CPF)',     'pessoal'),
  ('Termo de Autorização',             'pessoal'),
  ('Procedimento Assinado',            'empresa')
) AS novos(nome, categoria)
WHERE NOT EXISTS (
  SELECT 1 FROM public.internal_document_types t
  WHERE t.empresa_id IS NULL AND lower(t.nome) = lower(novos.nome)
);

COMMENT ON TABLE public.internal_document_requirements IS
  'Quais tipos de documento cada função precisa ter. É o que sustenta o status "Não aplicável" no dossiê — sem isso, o dossiê cobraria NR-35 de quem nunca sobe em altura.';
COMMENT ON TABLE public.document_audit_events IS
  'Auditoria de MUTAÇÃO (enviou/renovou/arquivou). Leitura fica em document_access_log — separadas de propósito: leitura é volumosa e rotineira, mutação é o que se apresenta numa fiscalização.';
