
CREATE TABLE public.dispensas_requisito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  curso_nome TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, curso_nome)
);

ALTER TABLE public.dispensas_requisito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dispensas for their empresa"
  ON public.dispensas_requisito FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert dispensas for their empresa"
  ON public.dispensas_requisito FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete dispensas for their empresa"
  ON public.dispensas_requisito FOR DELETE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
  ));
