-- ============================================================================
-- ARQUITETURA PCMSO - Documentos Base
-- ============================================================================
-- Este módulo introduz a emissão de documentos oficiais do PCMSO, apartados
-- do módulo de "Gestão Contínua" (ASOs), mas usando-o como base para as métricas.

-- Tabela principal de instâncias de documento PCMSO
CREATE TABLE IF NOT EXISTS public.pcmso_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL,
  
  -- Vinculação fundamental com a base de riscos (PGR Pai)
  pgr_base_id uuid REFERENCES public.pgr_documentos(id) ON DELETE SET NULL,
  
  versao int NOT NULL DEFAULT 1,
  -- Reutilizamos o enum pgr_status (rascunho, vigente, historico, inativo)
  status public.pgr_status NOT NULL DEFAULT 'rascunho', 
  
  data_emissao date,
  data_vigencia_inicio date,
  data_vigencia_fim date,
  
  -- Médico Coordenador Responsável
  medico_coordenador_id uuid REFERENCES public.aso_medicos(id) ON DELETE SET NULL,
  medico_nome text,
  medico_crm text,
  medico_uf text,
  
  observacoes text,
  relatorio_analitico text, -- Texto do balanço estatístico
  
  -- Controle de PDF Final
  pdf_hash text,
  pdf_drive_file_id text,
  pdf_drive_view_link text,
  pdf_gerado_em timestamptz,
  
  -- Vínculo de versionamento
  documento_origem_id uuid REFERENCES public.pcmso_documentos(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, unidade_id, versao)
);

-- Tabela de auditoria de versionamento
CREATE TABLE IF NOT EXISTS public.pcmso_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pcmso_id uuid NOT NULL REFERENCES public.pcmso_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  versao_anterior int,
  versao_nova int,
  status_anterior public.pgr_status,
  status_novo public.pgr_status,
  motivo_revisao text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cronograma Anual do PCMSO
CREATE TABLE IF NOT EXISTS public.pcmso_cronograma_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pcmso_id uuid NOT NULL REFERENCES public.pcmso_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  acao text NOT NULL,
  responsavel text,
  data_planejada date,
  status text NOT NULL DEFAULT 'Planejado',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Gatilhos e Políticas (RLS)
-- ============================================================================

DO $t$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pcmso_documentos', 'pcmso_revisoes', 'pcmso_cronograma_acoes'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_all ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_all ON public.%I FOR ALL TO authenticated
       USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id))
       WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
              OR public.is_in_user_company_tree(auth.uid(), empresa_id))', t, t);
  END LOOP;
END $t$;

DROP TRIGGER IF EXISTS trg_pcmso_doc_upd ON public.pcmso_documentos;
CREATE TRIGGER trg_pcmso_doc_upd BEFORE UPDATE ON public.pcmso_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pcmso_cron_upd ON public.pcmso_cronograma_acoes;
CREATE TRIGGER trg_pcmso_cron_upd BEFORE UPDATE ON public.pcmso_cronograma_acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
