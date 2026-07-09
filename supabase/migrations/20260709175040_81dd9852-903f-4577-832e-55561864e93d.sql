
-- ============================================================================
-- MÓDULO COMERCIAL — Orçamentos e Cotações (Fase 1)
-- 4 tabelas: clientes_comerciais, catalogo_servicos, orcamentos, orcamentos_itens
-- Padrão RLS: is_super_admin OR (empresa_id = get_user_empresa_id(auth.uid()))
-- ============================================================================

-- ============ clientes_comerciais ============
CREATE TABLE public.clientes_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj_cpf TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  contato_responsavel TEXT,
  segmento TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_comerciais_empresa ON public.clientes_comerciais(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_comerciais TO authenticated;
GRANT ALL ON public.clientes_comerciais TO service_role;
ALTER TABLE public.clientes_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full clientes_comerciais" ON public.clientes_comerciais FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read clientes_comerciais" ON public.clientes_comerciais FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert clientes_comerciais" ON public.clientes_comerciais FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update clientes_comerciais" ON public.clientes_comerciais FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete clientes_comerciais" ON public.clientes_comerciais FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE TRIGGER update_clientes_comerciais_updated_at
BEFORE UPDATE ON public.clientes_comerciais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ catalogo_servicos ============
CREATE TABLE public.catalogo_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  unidade TEXT,
  valor_padrao NUMERIC(14,2) NOT NULL DEFAULT 0,
  custo_estimado NUMERIC(14,2) DEFAULT 0,
  margem_padrao NUMERIC(6,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalogo_servicos_empresa ON public.catalogo_servicos(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_servicos TO authenticated;
GRANT ALL ON public.catalogo_servicos TO service_role;
ALTER TABLE public.catalogo_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full catalogo_servicos" ON public.catalogo_servicos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read catalogo_servicos" ON public.catalogo_servicos FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert catalogo_servicos" ON public.catalogo_servicos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update catalogo_servicos" ON public.catalogo_servicos FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete catalogo_servicos" ON public.catalogo_servicos FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE TRIGGER update_catalogo_servicos_updated_at
BEFORE UPDATE ON public.catalogo_servicos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ orcamentos ============
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  numero_orcamento TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes_comerciais(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  cliente_cnpj_cpf TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  responsavel_cliente TEXT,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,
  status TEXT NOT NULL DEFAULT 'rascunho',
  prioridade TEXT,
  observacoes TEXT,
  condicoes_pagamento TEXT,
  prazo_execucao TEXT,
  validade_proposta TEXT,
  modelo TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto_tipo TEXT DEFAULT 'valor',
  desconto_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  impostos_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_extra NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  aprovado_em TIMESTAMPTZ,
  recusado_em TIMESTAMPTZ,
  visualizado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, numero_orcamento)
);
CREATE INDEX idx_orcamentos_empresa ON public.orcamentos(empresa_id);
CREATE INDEX idx_orcamentos_cliente ON public.orcamentos(cliente_id);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full orcamentos" ON public.orcamentos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read orcamentos" ON public.orcamentos FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE TRIGGER update_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ orcamentos_itens ============
CREATE TABLE public.orcamentos_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'servico',
  codigo TEXT,
  descricao TEXT NOT NULL,
  detalhe TEXT,
  unidade TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_item NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orcamentos_itens_orc ON public.orcamentos_itens(orcamento_id);
CREATE INDEX idx_orcamentos_itens_empresa ON public.orcamentos_itens(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos_itens TO authenticated;
GRANT ALL ON public.orcamentos_itens TO service_role;
ALTER TABLE public.orcamentos_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full orcamentos_itens" ON public.orcamentos_itens FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read orcamentos_itens" ON public.orcamentos_itens FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert orcamentos_itens" ON public.orcamentos_itens FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update orcamentos_itens" ON public.orcamentos_itens FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete orcamentos_itens" ON public.orcamentos_itens FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE TRIGGER update_orcamentos_itens_updated_at
BEFORE UPDATE ON public.orcamentos_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Numeração automática: ORC-YYYY-NNNN por empresa ============
CREATE OR REPLACE FUNCTION public.next_orcamento_numero(_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ano TEXT := to_char(now(), 'YYYY');
  _prefixo TEXT := 'ORC-' || _ano || '-';
  _seq INT;
  _numero TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN numero_orcamento LIKE _prefixo || '%'
        AND substring(numero_orcamento FROM length(_prefixo)+1) ~ '^[0-9]+$'
      THEN substring(numero_orcamento FROM length(_prefixo)+1)::INT
      ELSE 0
    END
  ), 0) + 1
  INTO _seq
  FROM public.orcamentos
  WHERE empresa_id = _empresa_id;

  _numero := _prefixo || lpad(_seq::TEXT, 4, '0');
  RETURN _numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_orcamento_numero(UUID) TO authenticated;
