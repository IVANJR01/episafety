
-- Create status enum for solicitations
CREATE TYPE public.status_solicitacao AS ENUM ('pendente', 'aprovada', 'rejeitada', 'entregue');

-- Create EPI solicitation table
CREATE TABLE public.solicitacoes_epi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  epi_id UUID NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_config(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  motivo TEXT,
  status status_solicitacao NOT NULL DEFAULT 'pendente',
  solicitante_nome TEXT,
  aprovador_nome TEXT,
  observacao_resposta TEXT,
  created_by UUID,
  aprovado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitacoes_epi ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admin full access solicitacoes_epi"
  ON public.solicitacoes_epi FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal full access solicitacoes_epi"
  ON public.solicitacoes_epi FOR ALL TO authenticated
  USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read solicitacoes_epi"
  ON public.solicitacoes_epi FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert solicitacoes_epi"
  ON public.solicitacoes_epi FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant read solicitacoes_epi by unidade"
  ON public.solicitacoes_epi FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = solicitacoes_epi.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  ));

CREATE POLICY "Tenant insert solicitacoes_epi by unidade"
  ON public.solicitacoes_epi FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = solicitacoes_epi.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  ));

CREATE POLICY "Tenant update solicitacoes_epi"
  ON public.solicitacoes_epi FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update solicitacoes_epi by unidade"
  ON public.solicitacoes_epi FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM contratos c
    WHERE c.id = solicitacoes_epi.contrato_id
    AND c.unidade_id = get_user_empresa_id(auth.uid())
  ));

-- Updated_at trigger
CREATE TRIGGER update_solicitacoes_epi_updated_at
  BEFORE UPDATE ON public.solicitacoes_epi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
