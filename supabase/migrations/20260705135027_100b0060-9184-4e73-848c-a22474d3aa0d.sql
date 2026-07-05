-- Tabela de snapshots imutáveis para PPPs emitidos pela Central PPP
CREATE TABLE IF NOT EXISTS public.ppp_snapshots_emitidos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  funcionario_id uuid,
  funcionario_nome text,
  tipo text NOT NULL DEFAULT 'desligamento',
  nome_arquivo text,
  snapshot_json jsonb NOT NULL,
  gerado_por uuid,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ppp_snapshots_emitidos TO authenticated;
GRANT ALL ON public.ppp_snapshots_emitidos TO service_role;

ALTER TABLE public.ppp_snapshots_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppp_snap_select_v4 ON public.ppp_snapshots_emitidos
  FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

CREATE POLICY ppp_snap_insert_v4 ON public.ppp_snapshots_emitidos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

CREATE INDEX IF NOT EXISTS idx_ppp_snap_empresa ON public.ppp_snapshots_emitidos(empresa_id, gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ppp_snap_func ON public.ppp_snapshots_emitidos(funcionario_id);

COMMENT ON TABLE public.ppp_snapshots_emitidos IS
  'Snapshot imutável dos dados usados na emissão de um PPP pela Central PPP. Se o LTCAT for alterado depois, o PPP já emitido preserva o estado congelado aqui.';
