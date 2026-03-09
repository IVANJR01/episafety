
-- Table for DDS (Diálogo Diário de Segurança)
CREATE TABLE public.dds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresa_config(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tema TEXT NOT NULL,
  palestrante TEXT,
  local TEXT,
  duracao TEXT,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for DDS participants with digital signature
CREATE TABLE public.dds_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dds_id UUID NOT NULL REFERENCES public.dds(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id),
  assinatura TEXT,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dds_participantes ENABLE ROW LEVEL SECURITY;

-- RLS policies for dds
CREATE POLICY "Super admin full access dds" ON public.dds FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read dds" ON public.dds FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert dds" ON public.dds FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update dds" ON public.dds FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete dds" ON public.dds FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- RLS policies for dds_participantes
CREATE POLICY "Super admin full access dds_participantes" ON public.dds_participantes FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read dds_participantes" ON public.dds_participantes FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert dds_participantes" ON public.dds_participantes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update dds_participantes" ON public.dds_participantes FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete dds_participantes" ON public.dds_participantes FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
