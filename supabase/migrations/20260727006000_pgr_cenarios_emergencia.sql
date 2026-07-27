-- ============================================================================
-- FASE 6 — Preparação e resposta a emergências (Etapa 7)
-- ============================================================================
-- A NR-01 1.5.6 exige que a organização esteja preparada para emergências
-- decorrentes dos riscos inventariados. O vínculo com o inventário é o ponto:
-- um cenário de emergência solto, sem origem em risco identificado, é papel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pgr_cenarios_emergencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,

  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'outro',
  grande_magnitude boolean NOT NULL DEFAULT false,

  -- Local
  estabelecimento_id uuid REFERENCES public.sst_estabelecimentos(id) ON DELETE SET NULL,
  ambiente_id uuid REFERENCES public.sst_ambientes(id) ON DELETE SET NULL,

  -- Resposta
  medidas_prevencao text,
  procedimento_resposta text,
  primeiros_socorros text,
  meios_recursos text,
  responsaveis text,
  encaminhamento_acidentados text,
  abandono_ponto_encontro text,
  comunicacao text,

  -- Simulados
  periodicidade_simulado text,
  ultimo_simulado date,
  proximo_simulado date,
  evidencia_url text,
  licoes_aprendidas text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_cenarios_emergencia DROP CONSTRAINT IF EXISTS pgr_emerg_tipo_chk;
ALTER TABLE public.pgr_cenarios_emergencia ADD CONSTRAINT pgr_emerg_tipo_chk CHECK (tipo IN (
  'incendio','explosao','vazamento_quimico','choque_eletrico','soterramento',
  'queda_altura','espaco_confinado','acidente_pessoal','desastre_natural',
  'contaminacao_biologica','falha_energia','outro'
));

COMMENT ON TABLE public.pgr_cenarios_emergencia IS
  'Cenários de emergência vinculados aos riscos do inventário (NR-01 1.5.6). Sem vínculo com risco identificado, um cenário é apenas papel.';
COMMENT ON COLUMN public.pgr_cenarios_emergencia.grande_magnitude IS
  'Emergência de grande magnitude, que extrapola a capacidade de resposta própria e exige acionamento externo.';

CREATE INDEX IF NOT EXISTS pgr_emerg_pgr_idx ON public.pgr_cenarios_emergencia (pgr_id);
CREATE INDEX IF NOT EXISTS pgr_emerg_simulado_idx
  ON public.pgr_cenarios_emergencia (proximo_simulado) WHERE proximo_simulado IS NOT NULL;

-- N:N cenário ↔ riscos que o originam
CREATE TABLE IF NOT EXISTS public.pgr_cenario_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  cenario_id uuid NOT NULL REFERENCES public.pgr_cenarios_emergencia(id) ON DELETE CASCADE,
  inventario_item_id uuid NOT NULL REFERENCES public.pgr_inventario_itens(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cenario_id, inventario_item_id)
);
CREATE INDEX IF NOT EXISTS pgr_cen_riscos_item_idx ON public.pgr_cenario_riscos (inventario_item_id);

DO $t$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pgr_cenarios_emergencia','pgr_cenario_riscos'] LOOP
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

DROP TRIGGER IF EXISTS trg_pgr_emerg_upd ON public.pgr_cenarios_emergencia;
CREATE TRIGGER trg_pgr_emerg_upd BEFORE UPDATE ON public.pgr_cenarios_emergencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
