
-- Table to track EPI stock per contract
CREATE TABLE public.contrato_epis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  estoque integer NOT NULL DEFAULT 0,
  empresa_id uuid REFERENCES public.empresa_config(id),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contrato_id, epi_id)
);

ALTER TABLE public.contrato_epis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access contrato_epis"
ON public.contrato_epis FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal full access contrato_epis"
ON public.contrato_epis FOR ALL TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read contrato_epis"
ON public.contrato_epis FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert contrato_epis"
ON public.contrato_epis FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update contrato_epis"
ON public.contrato_epis FOR UPDATE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete contrato_epis"
ON public.contrato_epis FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_contrato_epis_updated_at
BEFORE UPDATE ON public.contrato_epis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
