
-- Enum for risk type
CREATE TYPE public.tipo_risco_ppp AS ENUM ('fisico', 'quimico', 'biologico', 'ergonomico', 'acidente');

-- Table: risk configuration per cargo
CREATE TABLE public.ppp_riscos_cargo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresa_config(id),
  cargo TEXT NOT NULL,
  tipo_risco tipo_risco_ppp NOT NULL,
  fator_risco TEXT NOT NULL,
  intensidade_concentracao TEXT,
  tecnica_utilizada TEXT,
  epc_eficaz BOOLEAN DEFAULT false,
  epi_eficaz BOOLEAN DEFAULT false,
  ca_epi TEXT,
  profissiografia TEXT,
  cbo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ppp_riscos_cargo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ppp_riscos_cargo of their company"
ON public.ppp_riscos_cargo FOR SELECT TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can insert ppp_riscos_cargo"
ON public.ppp_riscos_cargo FOR INSERT TO authenticated
WITH CHECK (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can update ppp_riscos_cargo"
ON public.ppp_riscos_cargo FOR UPDATE TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can delete ppp_riscos_cargo"
ON public.ppp_riscos_cargo FOR DELETE TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE TRIGGER update_ppp_riscos_cargo_updated_at
BEFORE UPDATE ON public.ppp_riscos_cargo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: PPP responsáveis (engineers and doctors)
CREATE TABLE public.ppp_responsaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresa_config(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('engenheiro', 'medico')),
  nome TEXT NOT NULL,
  nit TEXT,
  registro_conselho TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ppp_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ppp_responsaveis of their company"
ON public.ppp_responsaveis FOR SELECT TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can insert ppp_responsaveis"
ON public.ppp_responsaveis FOR INSERT TO authenticated
WITH CHECK (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can update ppp_responsaveis"
ON public.ppp_responsaveis FOR UPDATE TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE POLICY "Users can delete ppp_responsaveis"
ON public.ppp_responsaveis FOR DELETE TO authenticated
USING (empresa_id IN (
  SELECT id FROM empresa_config WHERE id = public.get_user_empresa_id(auth.uid()) OR empresa_pai_id = public.get_user_empresa_id(auth.uid())
));

CREATE TRIGGER update_ppp_responsaveis_updated_at
BEFORE UPDATE ON public.ppp_responsaveis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
