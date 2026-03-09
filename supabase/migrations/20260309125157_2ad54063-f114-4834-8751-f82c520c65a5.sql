
-- Add CPF to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Company config table
CREATE TABLE public.empresa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT '',
  cnpj TEXT,
  endereco TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read empresa_config" ON public.empresa_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert empresa_config" ON public.empresa_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update empresa_config" ON public.empresa_config FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_empresa_config_updated_at BEFORE UPDATE ON public.empresa_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fichas de entrega (signed delivery forms)
CREATE TABLE public.fichas_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  assinatura_colaborador TEXT,
  assinatura_responsavel TEXT,
  responsavel_nome TEXT,
  responsavel_cargo TEXT,
  data_assinatura TIMESTAMPTZ,
  pdf_url TEXT,
  entrega_ids UUID[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fichas_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read fichas_entrega" ON public.fichas_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert fichas_entrega" ON public.fichas_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update fichas_entrega" ON public.fichas_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete fichas_entrega" ON public.fichas_entrega FOR DELETE TO authenticated USING (true);
