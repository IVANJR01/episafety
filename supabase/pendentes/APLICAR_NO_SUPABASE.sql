-- ============================================================================
-- MIGRATIONS PENDENTES DO MÓDULO PGR — APLICAR NO SUPABASE
-- ============================================================================
-- Como aplicar:
--   Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
--
-- É seguro rodar mais de uma vez: tudo usa IF NOT EXISTS / DROP ... IF EXISTS,
-- e foi verificado aplicando e reaplicando em um Postgres 16 limpo.
--
-- Não altera nem apaga dado nenhum: só cria tabelas novas e acrescenta colunas.
-- Enquanto não for aplicado, o PGR continua funcionando — apenas as etapas de
-- Atividades, Perigos e o Levantamento em campo ficam indisponíveis, e o
-- assistente mostra um aviso explicando isso.
--
-- Conteúdo (na ordem, e a ordem importa):
--   1) 20260728000000_sst_atividades_e_contexto.sql
--   2) 20260728000100_sst_coletas_campo.sql
-- ============================================================================

BEGIN;

-- ─── 1/2 ─────────────────────────────────────────────────────────────────
-- ============================================================================
-- ATIVIDADE COMO ENTIDADE + CONTEXTO HIERÁRQUICO NO INVENTÁRIO
-- ============================================================================
-- A hierarquia técnica do PGR é:
--   Empresa > Unidade > Ambiente > Processo > Setor > GES > Função > Atividade
--   > Perigo > Avaliação > Ação > Risco residual
--
-- Dois elos faltavam:
--
-- 1) ATIVIDADE. Hoje ela existe apenas como texto livre em
--    sst_funcoes.descricao_atividades. Não dá para pendurar um perigo em uma
--    atividade, nem dizer que a mesma atividade é executada por duas funções.
--    Vira tabela própria, com vínculo N:N para função — uma atividade pode ser
--    de mais de uma função (ex.: "içamento de carga" para operador e sinaleiro).
--
-- 2) CONTEXTO EM FK NO INVENTÁRIO. pgr_inventario_itens guarda ambiente, setor e
--    processo como TEXTO livre (descricao_ambiente, setor, processo). Texto não
--    filtra, não agrega e diverge do cadastro assim que alguém renomeia o setor.
--    As colunas de texto ficam — PGRs já emitidos dependem delas e não podem ser
--    reescritos — e passam a conviver com as FKs, que são a fonte preferencial.
--
-- Tudo aditivo: nenhuma coluna é removida, nenhum dado é alterado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) sst_atividades
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sst_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,

  -- Função "dona" da atividade. Opcional: uma atividade pode ser cadastrada no
  -- nível do processo e só depois ser atribuída a funções via sst_atividade_funcoes.
  funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
  processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ges_id uuid REFERENCES public.sst_ges(id) ON DELETE SET NULL,

  nome text NOT NULL,
  codigo text,
  descricao text,

  -- Caracterização da execução (subsidia a análise de exposição)
  caracteristica text NOT NULL DEFAULT 'rotineira'
    CHECK (caracteristica IN ('rotineira', 'nao_rotineira', 'emergencia')),
  frequencia text,
  duracao text,
  habitualidade text,
  local_execucao text,
  maquinas text,
  ferramentas text,
  equipamentos text,
  produtos_utilizados text,
  postura_esforco text,
  trabalhadores_envolvidos integer CHECK (trabalhadores_envolvidos >= 0),
  observacoes text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sst_atividades_empresa_idx ON public.sst_atividades (empresa_id);
CREATE INDEX IF NOT EXISTS sst_atividades_funcao_idx  ON public.sst_atividades (funcao_id) WHERE funcao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sst_atividades_ges_idx     ON public.sst_atividades (ges_id) WHERE ges_id IS NOT NULL;

COMMENT ON TABLE public.sst_atividades IS
  'Atividades executadas. Nível entre Função e Perigo na hierarquia do PGR.';

-- Vínculo N:N atividade <-> função: a mesma atividade pode ser executada por
-- funções diferentes. funcao_id na tabela acima é apenas a função de origem.
CREATE TABLE IF NOT EXISTS public.sst_atividade_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.sst_atividades(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES public.sst_funcoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (atividade_id, funcao_id)
);

-- ---------------------------------------------------------------------------
-- 2) Campos organizacionais que o documento exige e não existiam
-- ---------------------------------------------------------------------------
ALTER TABLE public.sst_setores
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS turnos text,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.sst_funcoes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS turnos text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- O GES é o conceito mais confundido com "setor". Estes campos existem para
-- forçar a distinção: um GES precisa declarar POR QUE aquelas pessoas têm
-- exposição semelhante, e isso não se deduz do setor.
ALTER TABLE public.sst_ges
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS jornada text,
  ADD COLUMN IF NOT EXISTS frequencia_exposicao text,
  ADD COLUMN IF NOT EXISTS justificativa_similaridade text,
  ADD COLUMN IF NOT EXISTS observacoes text;

COMMENT ON COLUMN public.sst_ges.justificativa_similaridade IS
  'Por que estes trabalhadores têm exposição semelhante. Sem isso o GES é apenas um setor renomeado.';

ALTER TABLE public.sst_ambientes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS localizacao text,
  ADD COLUMN IF NOT EXISTS area_m2 numeric CHECK (area_m2 >= 0),
  ADD COLUMN IF NOT EXISTS qtd_trabalhadores integer CHECK (qtd_trabalhadores >= 0),
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.sst_processos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entradas text,
  ADD COLUMN IF NOT EXISTS saida text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- ---------------------------------------------------------------------------
-- 3) Contexto hierárquico em FK no inventário
-- ---------------------------------------------------------------------------
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS setor_id uuid REFERENCES public.sst_setores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.sst_atividades(id) ON DELETE SET NULL,
  -- Campos descritivos exigidos pela NR-01 que não tinham coluna própria.
  ADD COLUMN IF NOT EXISTS circunstancia text,
  ADD COLUMN IF NOT EXISTS medidas_existentes text,
  ADD COLUMN IF NOT EXISTS grupo_expostos text;

COMMENT ON COLUMN public.pgr_inventario_itens.ambiente_id IS
  'Fonte preferencial. A coluna de texto descricao_ambiente permanece para PGRs já emitidos.';
COMMENT ON COLUMN public.pgr_inventario_itens.circunstancia IS
  'Circunstância em que o perigo se manifesta — distinta da fonte geradora.';

CREATE INDEX IF NOT EXISTS pgr_inv_ambiente_idx  ON public.pgr_inventario_itens (ambiente_id) WHERE ambiente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pgr_inv_setor_idx     ON public.pgr_inventario_itens (setor_id) WHERE setor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pgr_inv_atividade_idx ON public.pgr_inventario_itens (atividade_id) WHERE atividade_id IS NOT NULL;

-- Mesmo contexto no levantamento preliminar, que já tinha ambiente/setor/GES.
ALTER TABLE public.pgr_levantamento_preliminar
  ADD COLUMN IF NOT EXISTS funcao_id uuid REFERENCES public.sst_funcoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atividade_id uuid REFERENCES public.sst_atividades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.sst_processos(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4) RLS — mesmo isolamento multiempresa das demais tabelas sst_*
-- ---------------------------------------------------------------------------
ALTER TABLE public.sst_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_atividade_funcoes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_atividades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sst_atividade_funcoes TO authenticated;
GRANT ALL ON public.sst_atividades TO service_role;
GRANT ALL ON public.sst_atividade_funcoes TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_atividades') THEN
    CREATE POLICY "Empresa tenant isolation sst_atividades" ON public.sst_atividades
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Empresa tenant isolation sst_atividade_funcoes') THEN
    CREATE POLICY "Empresa tenant isolation sst_atividade_funcoes" ON public.sst_atividade_funcoes
      FOR ALL USING (is_active_empresa(auth.uid(), empresa_id));
  END IF;
END $$;

-- updated_at automático, no mesmo padrão das demais tabelas do Núcleo Mestre.
DROP TRIGGER IF EXISTS trg_sst_atividades_updated ON public.sst_atividades;
CREATE TRIGGER trg_sst_atividades_updated
  BEFORE UPDATE ON public.sst_atividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2/2 ─────────────────────────────────────────────────────────────────
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

COMMIT;
