
CREATE TABLE IF NOT EXISTS public.obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  codigo TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVA',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Obras select por empresa"
  ON public.obras FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR empresa_id IN (
      SELECT ue.empresa_id FROM public.usuario_empresas ue
      JOIN auth.users u ON u.email = ue.email
      WHERE u.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Obras insert por empresa"
  ON public.obras FOR INSERT
  TO authenticated
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR empresa_id IN (
      SELECT ue.empresa_id FROM public.usuario_empresas ue
      JOIN auth.users u ON u.email = ue.email
      WHERE u.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Obras update por empresa"
  ON public.obras FOR UPDATE
  TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR empresa_id IN (
      SELECT ue.empresa_id FROM public.usuario_empresas ue
      JOIN auth.users u ON u.email = ue.email
      WHERE u.id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Obras delete por empresa"
  ON public.obras FOR DELETE
  TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_obras_empresa ON public.obras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_status ON public.obras(status);

CREATE TRIGGER trg_obras_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conformidades
  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_especifico TEXT;

CREATE INDEX IF NOT EXISTS idx_conformidades_obra ON public.conformidades(obra_id);
