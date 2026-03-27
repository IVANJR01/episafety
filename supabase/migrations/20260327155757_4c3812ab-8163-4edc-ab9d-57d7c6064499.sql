
CREATE TABLE public.analises_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresa_config(id),
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE NOT NULL,
  arquivo_nome TEXT NOT NULL,
  ia_metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analises_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analises for their empresa"
  ON public.analises_ia FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert analises for their empresa"
  ON public.analises_ia FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update analises for their empresa"
  ON public.analises_ia FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete analises for their empresa"
  ON public.analises_ia FOR DELETE TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()));
