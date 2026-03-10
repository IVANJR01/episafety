
-- Create inspection table for substation inspections
CREATE TABLE public.inspecoes_subestacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_inspecao DATE NOT NULL DEFAULT CURRENT_DATE,
  inspetor TEXT NOT NULL,
  identificacao_se TEXT NOT NULL,
  clima TEXT,
  itens_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  fotos TEXT[] DEFAULT '{}'::text[],
  observacoes TEXT,
  status_geral TEXT NOT NULL DEFAULT 'Conforme',
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspecoes_subestacao ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin full access inspecoes_subestacao"
  ON public.inspecoes_subestacao FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Tenant read inspecoes_subestacao"
  ON public.inspecoes_subestacao FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert inspecoes_subestacao"
  ON public.inspecoes_subestacao FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update inspecoes_subestacao"
  ON public.inspecoes_subestacao FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete inspecoes_subestacao"
  ON public.inspecoes_subestacao FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Updated at trigger
CREATE TRIGGER set_updated_at_inspecoes_subestacao
  BEFORE UPDATE ON public.inspecoes_subestacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspecoes', 'inspecoes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Public read inspecoes"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'inspecoes');

CREATE POLICY "Auth insert inspecoes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspecoes');

CREATE POLICY "Auth update inspecoes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'inspecoes');

CREATE POLICY "Auth delete inspecoes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'inspecoes');
