-- ============================================================================
-- FASE 5.2 — Gatilhos de revisão e trilha de aprovações
-- ============================================================================
-- A NR-01 1.5.4.4.5 lista os eventos que OBRIGAM revisar a avaliação de riscos.
-- Sem registro, não há como demonstrar que o gatilho foi tratado — nem como
-- saber que ele ocorreu.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pgr_gatilhos_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  data_ocorrencia date NOT NULL DEFAULT current_date,
  origem_registro text,
  origem_id uuid,
  status text NOT NULL DEFAULT 'aberto',
  revisao_id uuid REFERENCES public.pgr_revisoes(id) ON DELETE SET NULL,
  tratado_em date,
  tratado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  justificativa_dispensa text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_gatilhos_revisao DROP CONSTRAINT IF EXISTS pgr_gat_tipo_chk;
ALTER TABLE public.pgr_gatilhos_revisao ADD CONSTRAINT pgr_gat_tipo_chk CHECK (tipo IN (
  'medida_implementada', 'mudanca_tecnologia', 'mudanca_ambiente', 'mudanca_processo',
  'mudanca_organizacao', 'controle_inadequado', 'acidente', 'doenca_ocupacional',
  'requisito_legal', 'solicitacao_trabalhadores', 'solicitacao_cipa', 'prazo_vencido', 'outro'
));

ALTER TABLE public.pgr_gatilhos_revisao DROP CONSTRAINT IF EXISTS pgr_gat_status_chk;
ALTER TABLE public.pgr_gatilhos_revisao ADD CONSTRAINT pgr_gat_status_chk
  CHECK (status IN ('aberto','em_tratamento','tratado','dispensado'));

-- Dispensar um gatilho normativo sem justificativa é exatamente o que a
-- fiscalização questiona.
ALTER TABLE public.pgr_gatilhos_revisao DROP CONSTRAINT IF EXISTS pgr_gat_dispensa_chk;
ALTER TABLE public.pgr_gatilhos_revisao ADD CONSTRAINT pgr_gat_dispensa_chk
  CHECK (status <> 'dispensado'
         OR (justificativa_dispensa IS NOT NULL
             AND length(btrim(justificativa_dispensa)) >= 10));

COMMENT ON TABLE public.pgr_gatilhos_revisao IS
  'Eventos que obrigam revisar a avaliação de riscos (NR-01 1.5.4.4.5). Um gatilho aberto bloqueia a emissão até ser tratado ou dispensado com justificativa.';
COMMENT ON COLUMN public.pgr_gatilhos_revisao.origem_registro IS
  'Tabela de onde veio o gatilho (ex.: cat_comunicacoes, pgr_acoes), para rastrear a origem sem duplicar o dado.';

CREATE INDEX IF NOT EXISTS pgr_gat_pgr_idx ON public.pgr_gatilhos_revisao (pgr_id, status);
CREATE INDEX IF NOT EXISTS pgr_gat_aberto_idx ON public.pgr_gatilhos_revisao (pgr_id)
  WHERE status IN ('aberto','em_tratamento');

CREATE TABLE IF NOT EXISTS public.pgr_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  etapa text NOT NULL,
  decisao text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  responsavel_nome text,
  comentario text,
  pgr_versao integer,
  decidido_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_aprovacoes DROP CONSTRAINT IF EXISTS pgr_aprov_etapa_chk;
ALTER TABLE public.pgr_aprovacoes ADD CONSTRAINT pgr_aprov_etapa_chk
  CHECK (etapa IN ('revisao_tecnica','aprovacao','assinatura'));

ALTER TABLE public.pgr_aprovacoes DROP CONSTRAINT IF EXISTS pgr_aprov_decisao_chk;
ALTER TABLE public.pgr_aprovacoes ADD CONSTRAINT pgr_aprov_decisao_chk
  CHECK (decisao IN ('aprovado','reprovado','devolvido'));

-- Reprovar ou devolver sem dizer por quê torna o fluxo inútil para quem recebe.
ALTER TABLE public.pgr_aprovacoes DROP CONSTRAINT IF EXISTS pgr_aprov_comentario_chk;
ALTER TABLE public.pgr_aprovacoes ADD CONSTRAINT pgr_aprov_comentario_chk
  CHECK (decisao = 'aprovado'
         OR (comentario IS NOT NULL AND length(btrim(comentario)) >= 5));

COMMENT ON TABLE public.pgr_aprovacoes IS
  'Trilha de decisões do fluxo de aprovação. Append-only por convenção: uma nova decisão é uma nova linha, nunca um UPDATE.';

CREATE INDEX IF NOT EXISTS pgr_aprov_pgr_idx ON public.pgr_aprovacoes (pgr_id, decidido_em DESC);

DO $t$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pgr_gatilhos_revisao','pgr_aprovacoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE INSERT OR UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard()', t, t);
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

DROP TRIGGER IF EXISTS trg_pgr_gat_upd ON public.pgr_gatilhos_revisao;
CREATE TRIGGER trg_pgr_gat_upd BEFORE UPDATE ON public.pgr_gatilhos_revisao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NR-01 1.5.4.4.5 alínea a): implementada a medida, o risco residual precisa ser
-- reavaliado. O gatilho nasce do próprio sistema, sem depender de alguém lembrar.
CREATE OR REPLACE FUNCTION public.pgr_gatilho_medida_implementada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pgr_gatilhos_revisao g
       WHERE g.origem_registro = 'pgr_acoes' AND g.origem_id = NEW.id
    ) THEN
      INSERT INTO public.pgr_gatilhos_revisao
        (pgr_id, empresa_id, tipo, descricao, data_ocorrencia, origem_registro, origem_id)
      VALUES (NEW.pgr_id, NEW.empresa_id, 'medida_implementada',
              'Medida concluída: ' || left(COALESCE(NEW.descricao,''), 200)
              || ' — reavaliar o risco residual.',
              COALESCE(NEW.data_conclusao, current_date), 'pgr_acoes', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pgr_gatilho_medida_implementada() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_pgr_gatilho_medida ON public.pgr_acoes;
CREATE TRIGGER trg_pgr_gatilho_medida AFTER INSERT OR UPDATE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_gatilho_medida_implementada();
