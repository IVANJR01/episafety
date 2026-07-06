
-- ============ SOLICITACOES DE MATERIAIS ============

CREATE TABLE public.solicitacoes_materiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  unidade_id UUID,
  contrato_id UUID,
  obra_id UUID,
  local_obra TEXT,
  numero_solicitacao TEXT NOT NULL,
  titulo TEXT NOT NULL,
  solicitante_id UUID,
  solicitante_nome TEXT,
  setor TEXT,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_necessidade DATE,
  prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  justificativa TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aprovada','recusada','comprada','recebida','recebida_parcial','cancelada')),
  motivo_recusa TEXT,
  aprovado_por UUID,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  comprada_em TIMESTAMPTZ,
  recebida_em TIMESTAMPTZ,
  recebida_por_nome TEXT,
  nota_fiscal TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero_solicitacao)
);

CREATE INDEX idx_solmat_empresa ON public.solicitacoes_materiais(empresa_id);
CREATE INDEX idx_solmat_status ON public.solicitacoes_materiais(status);
CREATE INDEX idx_solmat_obra ON public.solicitacoes_materiais(obra_id);
CREATE INDEX idx_solmat_data ON public.solicitacoes_materiais(data_solicitacao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_materiais TO authenticated;
GRANT ALL ON public.solicitacoes_materiais TO service_role;

ALTER TABLE public.solicitacoes_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solmat select por empresa" ON public.solicitacoes_materiais
FOR SELECT USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat insert por empresa" ON public.solicitacoes_materiais
FOR INSERT WITH CHECK (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat update por empresa" ON public.solicitacoes_materiais
FOR UPDATE USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat delete por empresa" ON public.solicitacoes_materiais
FOR DELETE USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============ ITENS ============

CREATE TABLE public.solicitacoes_materiais_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_materiais(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  tipo_item TEXT NOT NULL DEFAULT 'EPI' CHECK (tipo_item IN ('EPI','EPC','Material de Segurança','Ferramenta','Outro')),
  epi_id UUID,
  nome_item TEXT NOT NULL,
  descricao TEXT,
  ca TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  quantidade_solicitada NUMERIC NOT NULL DEFAULT 0,
  quantidade_aprovada NUMERIC,
  quantidade_comprada NUMERIC,
  quantidade_recebida NUMERIC,
  prioridade_item TEXT,
  justificativa_item TEXT,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solmat_itens_solic ON public.solicitacoes_materiais_itens(solicitacao_id);
CREATE INDEX idx_solmat_itens_empresa ON public.solicitacoes_materiais_itens(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_materiais_itens TO authenticated;
GRANT ALL ON public.solicitacoes_materiais_itens TO service_role;

ALTER TABLE public.solicitacoes_materiais_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solmat itens select por empresa" ON public.solicitacoes_materiais_itens
FOR SELECT USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat itens insert por empresa" ON public.solicitacoes_materiais_itens
FOR INSERT WITH CHECK (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat itens update por empresa" ON public.solicitacoes_materiais_itens
FOR UPDATE USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Solmat itens delete por empresa" ON public.solicitacoes_materiais_itens
FOR DELETE USING (
  (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid()))
  OR (empresa_id IN (SELECT p.empresa_id FROM profiles p WHERE p.email = (auth.jwt() ->> 'email'::text)))
  OR (empresa_id = ANY (get_user_empresa_ids((auth.jwt() ->> 'email'::text))))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============ UPDATED_AT TRIGGERS ============

CREATE TRIGGER trg_solmat_updated
BEFORE UPDATE ON public.solicitacoes_materiais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_solmat_itens_updated
BEFORE UPDATE ON public.solicitacoes_materiais_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NUMERACAO ============

CREATE OR REPLACE FUNCTION public.proximo_numero_solicitacao_material(_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ano TEXT;
  seq INT;
BEGIN
  ano := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX((regexp_replace(numero_solicitacao, '^SOL-\d{4}-', ''))::INT), 0) + 1
    INTO seq
  FROM public.solicitacoes_materiais
  WHERE empresa_id = _empresa_id
    AND numero_solicitacao LIKE 'SOL-' || ano || '-%';
  RETURN 'SOL-' || ano || '-' || lpad(seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_numero_solicitacao_material(UUID) TO authenticated;
