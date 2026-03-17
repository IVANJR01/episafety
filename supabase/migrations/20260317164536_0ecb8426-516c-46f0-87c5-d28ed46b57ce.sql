
-- Table to link responsible users to contracts for stock management
CREATE TABLE public.contrato_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresa_config(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(contrato_id, funcionario_id)
);

ALTER TABLE public.contrato_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access contrato_responsaveis"
ON public.contrato_responsaveis FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal full access contrato_responsaveis"
ON public.contrato_responsaveis FOR ALL TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read contrato_responsaveis"
ON public.contrato_responsaveis FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert contrato_responsaveis"
ON public.contrato_responsaveis FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete contrato_responsaveis"
ON public.contrato_responsaveis FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));
