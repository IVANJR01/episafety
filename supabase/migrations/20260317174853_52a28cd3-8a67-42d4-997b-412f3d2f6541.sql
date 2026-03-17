
-- Table to track stock movements (additions/removals) per contract EPI
CREATE TABLE public.contrato_epis_movimentacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_epi_id uuid NOT NULL REFERENCES public.contrato_epis(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  epi_id uuid NOT NULL REFERENCES public.epis(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresa_config(id),
  tipo text NOT NULL DEFAULT 'entrada', -- 'entrada' or 'saida'
  quantidade integer NOT NULL DEFAULT 0,
  motivo text,
  responsavel_nome text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contrato_epis_movimentacoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admin full access contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Principal full access contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR ALL TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Tenant read contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant insert contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant update contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR UPDATE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant delete contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Index for common queries
CREATE INDEX idx_contrato_epis_mov_contrato ON public.contrato_epis_movimentacoes(contrato_id);
CREATE INDEX idx_contrato_epis_mov_epi ON public.contrato_epis_movimentacoes(epi_id);
CREATE INDEX idx_contrato_epis_mov_created ON public.contrato_epis_movimentacoes(created_at);
