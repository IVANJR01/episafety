
-- Create status enum for faturas
CREATE TYPE public.status_fatura AS ENUM ('aberto', 'vencido', 'pago', 'cancelado');

-- Create faturas table
CREATE TABLE public.faturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresa_config(id) ON DELETE CASCADE NOT NULL,
  ciclo INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC NOT NULL DEFAULT 0,
  situacao status_fatura NOT NULL DEFAULT 'aberto',
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_vencimento DATE NOT NULL,
  fatura_url TEXT,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

-- Only super_admin has full access
CREATE POLICY "Super admin full access faturas"
  ON public.faturas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Principal can read faturas for their company tree
CREATE POLICY "Principal read faturas company tree"
  ON public.faturas FOR SELECT TO authenticated
  USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- Updated_at trigger
CREATE TRIGGER update_faturas_updated_at
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
