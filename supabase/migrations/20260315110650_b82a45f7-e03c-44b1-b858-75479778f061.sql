
CREATE TABLE public.medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  crm text DEFAULT NULL,
  especialidade text DEFAULT NULL,
  empresa_id uuid REFERENCES public.empresa_config(id) DEFAULT NULL,
  created_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access medicos" ON public.medicos FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read medicos" ON public.medicos FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert medicos" ON public.medicos FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update medicos" ON public.medicos FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete medicos" ON public.medicos FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
