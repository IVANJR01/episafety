-- ============================================================================
-- FASE 4.2 — N:N ação↔riscos, marcos e verificação de eficácia
-- ============================================================================
-- pgr_acoes.inventario_item_id só permitia UMA ação por risco. Uma mesma medida
-- (ex.: enclausurar um compressor) normalmente trata vários riscos de uma vez.
-- A coluna antiga é mantida como "risco principal" e continua alimentando as
-- telas e o PDF atuais.
--
-- A verificação de eficácia existe porque concluir a ação NÃO encerra o risco
-- (NR-01 1.5.4.4.6): é preciso aferir se a medida funcionou e só então reavaliar
-- o risco residual. O trigger materializa essa tarefa automaticamente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pgr_acao_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  acao_id uuid NOT NULL REFERENCES public.pgr_acoes(id) ON DELETE CASCADE,
  inventario_item_id uuid NOT NULL REFERENCES public.pgr_inventario_itens(id) ON DELETE CASCADE,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acao_id, inventario_item_id)
);
CREATE INDEX IF NOT EXISTS pgr_acao_riscos_item_idx ON public.pgr_acao_riscos (inventario_item_id);
CREATE INDEX IF NOT EXISTS pgr_acao_riscos_acao_idx ON public.pgr_acao_riscos (acao_id);

CREATE TABLE IF NOT EXISTS public.pgr_acao_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  acao_id uuid NOT NULL REFERENCES public.pgr_acoes(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  prazo date,
  concluido boolean NOT NULL DEFAULT false,
  data_conclusao date,
  ordem smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pgr_acao_marcos_acao_idx ON public.pgr_acao_marcos (acao_id, ordem);

CREATE TABLE IF NOT EXISTS public.pgr_acao_eficacia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  acao_id uuid NOT NULL REFERENCES public.pgr_acoes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  data_prevista date,
  data_verificacao date,
  responsavel_nome text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metodo_afericao text,
  resultado text,
  evidencia_url text,
  necessita_ajuste boolean,
  ajuste_descricao text,
  risco_residual_confirmado boolean,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pgr_acao_eficacia DROP CONSTRAINT IF EXISTS pgr_efic_status_chk;
ALTER TABLE public.pgr_acao_eficacia ADD CONSTRAINT pgr_efic_status_chk
  CHECK (status IN ('pendente','em_verificacao','eficaz','parcialmente_eficaz','ineficaz'));

-- Concluir a verificação exige registrar COMO foi aferida e o resultado.
ALTER TABLE public.pgr_acao_eficacia DROP CONSTRAINT IF EXISTS pgr_efic_conclusao_chk;
ALTER TABLE public.pgr_acao_eficacia ADD CONSTRAINT pgr_efic_conclusao_chk
  CHECK (status IN ('pendente','em_verificacao')
         OR (data_verificacao IS NOT NULL
             AND metodo_afericao IS NOT NULL AND length(btrim(metodo_afericao)) > 0
             AND resultado IS NOT NULL AND length(btrim(resultado)) > 0));

COMMENT ON TABLE public.pgr_acao_eficacia IS
  'Verificação de eficácia da ação (NR-01 1.5.4.4.6). Criada automaticamente quando a ação é concluída: concluir a ação não encerra o risco.';

CREATE INDEX IF NOT EXISTS pgr_efic_acao_idx ON public.pgr_acao_eficacia (acao_id);
CREATE INDEX IF NOT EXISTS pgr_efic_pendente_idx
  ON public.pgr_acao_eficacia (pgr_id) WHERE status IN ('pendente','em_verificacao');

-- Guards, grants e RLS idênticos nas três tabelas — aplicados em laço para
-- evitar 30 linhas repetidas e divergirem com o tempo.
DO $t$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pgr_acao_riscos','pgr_acao_marcos','pgr_acao_eficacia'] LOOP
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

DROP TRIGGER IF EXISTS trg_pgr_marcos_upd ON public.pgr_acao_marcos;
CREATE TRIGGER trg_pgr_marcos_upd BEFORE UPDATE ON public.pgr_acao_marcos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_pgr_efic_upd ON public.pgr_acao_eficacia;
CREATE TRIGGER trg_pgr_efic_upd BEFORE UPDATE ON public.pgr_acao_eficacia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pgr_acao_abrir_eficacia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NOT EXISTS (SELECT 1 FROM public.pgr_acao_eficacia e WHERE e.acao_id = NEW.id) THEN
      INSERT INTO public.pgr_acao_eficacia (pgr_id, empresa_id, acao_id, status, data_prevista)
      VALUES (NEW.pgr_id, NEW.empresa_id, NEW.id, 'pendente',
              COALESCE(NEW.data_conclusao, current_date) + 30);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pgr_acao_abrir_eficacia() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_pgr_acao_eficacia ON public.pgr_acoes;
CREATE TRIGGER trg_pgr_acao_eficacia AFTER INSERT OR UPDATE ON public.pgr_acoes
  FOR EACH ROW EXECUTE FUNCTION public.pgr_acao_abrir_eficacia();

-- Backfill: o vínculo 1:1 existente vira a linha "principal" do N:N.
INSERT INTO public.pgr_acao_riscos (pgr_id, empresa_id, acao_id, inventario_item_id, principal)
SELECT a.pgr_id, a.empresa_id, a.id, a.inventario_item_id, true
  FROM public.pgr_acoes a
 WHERE a.inventario_item_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.pgr_acao_riscos r
                    WHERE r.acao_id = a.id AND r.inventario_item_id = a.inventario_item_id);

COMMENT ON COLUMN public.pgr_acoes.inventario_item_id IS
  'LEGADO/conveniência: risco principal da ação. A relação completa está em pgr_acao_riscos.';
