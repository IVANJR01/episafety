-- ============================================================================
-- LEVANTAMENTO EM CAMPO (MODO 3) — coleta pelo celular, com revisão obrigatória
-- ============================================================================
-- O que é coletado na obra NÃO entra no PGR automaticamente. Uma observação de
-- campo é matéria-prima: quem levantou pode ter identificado o GES errado,
-- descrito o perigo de forma imprecisa ou fotografado outra frente de serviço.
-- Por isso a coleta vive em tabela própria, com status explícito, e só vira item
-- do inventário quando um técnico revisa e valida — momento em que
-- inventario_item_id é preenchido e a coleta passa a 'validado'.
--
-- Guardar coleta direto em pgr_inventario_itens faria dado não revisado entrar
-- em documento legal assinado. Esta separação é o ponto inteiro da tabela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sst_coletas_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,

  -- PGR de destino. Opcional: dá para coletar antes de existir o documento.
  pgr_id uuid REFERENCES public.pgr_documentos(id) ON DELETE SET NULL,

  -- Contexto hierárquico observado
  estabelecimento_id uuid REFERENCES public.sst_estabelecimentos(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ges_id uuid REFERENCES public.sst_ges(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
  atividade_id uuid REFERENCES public.sst_atividades(id) ON DELETE SET NULL,

  -- Texto livre para o que ainda não está cadastrado. Em campo não se
  -- interrompe a coleta para abrir um cadastro; a revisão resolve depois.
  contexto_livre text,

  categoria text CHECK (categoria IN
    ('fisico', 'quimico', 'biologico', 'ergonomico', 'acidente', 'psicossocial', 'outro')),
  perigo_observado text NOT NULL,
  fonte_circunstancia text,
  situacao_encontrada text,
  possiveis_lesoes text,
  exposicao text,
  qtd_expostos integer CHECK (qtd_expostos >= 0),
  grupo_expostos text,
  medidas_existentes text,
  observacoes text,

  -- Rastreabilidade da coleta
  coletado_em timestamptz NOT NULL DEFAULT now(),
  coletado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coletado_por_nome text,
  latitude numeric,
  longitude numeric,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'aguardando_revisao', 'validado', 'descartado')),

  -- Preenchidos na revisão técnica
  revisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em timestamptz,
  revisao_observacao text,
  inventario_item_id uuid REFERENCES public.pgr_inventario_itens(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma coleta descartada precisa dizer por quê: é a evidência de que o perigo
-- observado foi considerado e conscientemente não entrou no inventário.
ALTER TABLE public.sst_coletas_campo
  DROP CONSTRAINT IF EXISTS sst_coleta_descarte_chk;
ALTER TABLE public.sst_coletas_campo
  ADD CONSTRAINT sst_coleta_descarte_chk CHECK (
    status <> 'descartado' OR length(btrim(coalesce(revisao_observacao, ''))) >= 5
  );

CREATE INDEX IF NOT EXISTS sst_coletas_empresa_idx ON public.sst_coletas_campo (empresa_id, status);
CREATE INDEX IF NOT EXISTS sst_coletas_pgr_idx     ON public.sst_coletas_campo (pgr_id) WHERE pgr_id IS NOT NULL;

-- Evidências (fotos e anexos). Tabela separada porque uma coleta tem N arquivos
-- e porque o histórico de anexos não deve ser perdido ao editar a coleta.
CREATE TABLE IF NOT EXISTS public.sst_coleta_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  coleta_id uuid NOT NULL REFERENCES public.sst_coletas_campo(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'documento', 'audio', 'outro')),
  url text NOT NULL,
  nome_arquivo text,
  descricao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sst_coleta_evid_idx ON public.sst_coleta_evidencias (coleta_id);

-- Histórico de alterações da coleta (exigência de trilha de auditoria).
CREATE TABLE IF NOT EXISTS public.sst_coleta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  coleta_id uuid NOT NULL REFERENCES public.sst_coletas_campo(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  observacao text
);

CREATE INDEX IF NOT EXISTS sst_coleta_hist_idx ON public.sst_coleta_historico (coleta_id, alterado_em DESC);

-- Registra automaticamente cada transição de status.
CREATE OR REPLACE FUNCTION public.sst_coleta_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.sst_coleta_historico
      (empresa_id, coleta_id, status_anterior, status_novo, alterado_por, observacao)
    VALUES
      (NEW.empresa_id, NEW.id, OLD.status, NEW.status, auth.uid(), NEW.revisao_observacao);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sst_coleta_log_status ON public.sst_coletas_campo;
CREATE TRIGGER trg_sst_coleta_log_status
  AFTER UPDATE ON public.sst_coletas_campo
  FOR EACH ROW EXECUTE FUNCTION public.sst_coleta_log_status();

DROP TRIGGER IF EXISTS trg_sst_coletas_updated ON public.sst_coletas_campo;
CREATE TRIGGER trg_sst_coletas_updated
  BEFORE UPDATE ON public.sst_coletas_campo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sst_coletas_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_coleta_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_coleta_historico ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_coletas_campo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_coleta_evidencias TO authenticated;
GRANT SELECT ON public.sst_coleta_historico TO authenticated;
GRANT ALL ON public.sst_coletas_campo TO service_role;
GRANT ALL ON public.sst_coleta_evidencias TO service_role;
GRANT ALL ON public.sst_coleta_historico TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_coletas_campo') THEN
    CREATE POLICY "Empresa tenant isolation sst_coletas_campo" ON public.sst_coletas_campo
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_coleta_evidencias') THEN
    CREATE POLICY "Empresa tenant isolation sst_coleta_evidencias" ON public.sst_coleta_evidencias
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_coleta_historico') THEN
    CREATE POLICY "Empresa tenant isolation sst_coleta_historico" ON public.sst_coleta_historico
      FOR SELECT USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
END $$;
