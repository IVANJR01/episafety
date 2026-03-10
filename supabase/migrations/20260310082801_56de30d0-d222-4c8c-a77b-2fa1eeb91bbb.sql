
-- Create conformidades table for conformity management
CREATE TABLE public.conformidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero SERIAL,
  data_inspecao DATE NOT NULL DEFAULT CURRENT_DATE,
  situacao_detectada TEXT NOT NULL,
  foto_antes TEXT,
  foto_depois TEXT,
  gravidade TEXT NOT NULL DEFAULT 'LEVE',
  acao_corretiva TEXT,
  responsavel TEXT,
  local TEXT,
  data_realizado DATE,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conformidades ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admin full access conformidades" ON public.conformidades FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Tenant read conformidades" ON public.conformidades FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert conformidades" ON public.conformidades FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update conformidades" ON public.conformidades FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete conformidades" ON public.conformidades FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_conformidades_updated_at
  BEFORE UPDATE ON public.conformidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for conformidade photos
INSERT INTO storage.buckets (id, name, public) VALUES ('conformidades', 'conformidades', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users upload conformidades" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conformidades');

CREATE POLICY "Auth users read conformidades" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'conformidades');

CREATE POLICY "Auth users update conformidades" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'conformidades');

CREATE POLICY "Auth users delete conformidades" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'conformidades');

CREATE POLICY "Public read conformidades" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'conformidades');
