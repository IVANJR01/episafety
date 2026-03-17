
-- Create contracts table linked to units (empresa_config)
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin full access contratos"
ON public.contratos FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal full access contratos company tree"
ON public.contratos FOR ALL TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read contratos"
ON public.contratos FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert contratos"
ON public.contratos FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update contratos"
ON public.contratos FOR UPDATE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete contratos"
ON public.contratos FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_contratos_updated_at
BEFORE UPDATE ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
