
CREATE TABLE public.controle_treinamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  nome_curso TEXT NOT NULL,
  data_realizacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_renovacao DATE,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.controle_treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access controle_treinamentos" ON public.controle_treinamentos FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read controle_treinamentos" ON public.controle_treinamentos FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert controle_treinamentos" ON public.controle_treinamentos FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update controle_treinamentos" ON public.controle_treinamentos FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete controle_treinamentos" ON public.controle_treinamentos FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
