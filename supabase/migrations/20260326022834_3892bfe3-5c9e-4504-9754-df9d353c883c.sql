
-- Conferences table
CREATE TABLE public.conferencias_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.empresa_config(id),
  empresa_id uuid REFERENCES public.empresa_config(id),
  tipo text NOT NULL DEFAULT 'semanal',
  status text NOT NULL DEFAULT 'aberta',
  created_by uuid,
  finalizado_por uuid,
  finalizado_em timestamptz,
  observacao_geral text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Conference items
CREATE TABLE public.conferencia_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conferencia_id uuid NOT NULL REFERENCES public.conferencias_estoque(id) ON DELETE CASCADE,
  contrato_epi_id uuid NOT NULL REFERENCES public.contrato_epis(id),
  epi_id uuid NOT NULL REFERENCES public.epis(id),
  estoque_sistema integer NOT NULL DEFAULT 0,
  contagem_fisica integer,
  divergencia integer GENERATED ALWAYS AS (COALESCE(contagem_fisica, 0) - estoque_sistema) STORED,
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conferencias_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conferencia_itens ENABLE ROW LEVEL SECURITY;

-- RLS policies for conferencias_estoque
CREATE POLICY "Users can view conferences in their company tree"
ON public.conferencias_estoque FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_principal(auth.uid())
  OR public.is_in_user_company_tree(auth.uid(), empresa_id)
);

CREATE POLICY "Users can insert conferences"
ON public.conferencias_estoque FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_principal(auth.uid())
  OR public.is_in_user_company_tree(auth.uid(), empresa_id)
);

CREATE POLICY "Users can update conferences"
ON public.conferencias_estoque FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_principal(auth.uid())
  OR public.is_in_user_company_tree(auth.uid(), empresa_id)
);

-- RLS policies for conferencia_itens
CREATE POLICY "Users can view conference items"
ON public.conferencia_itens FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conferencias_estoque c
    WHERE c.id = conferencia_id
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), c.empresa_id)
    )
  )
);

CREATE POLICY "Users can insert conference items"
ON public.conferencia_itens FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conferencias_estoque c
    WHERE c.id = conferencia_id
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), c.empresa_id)
    )
  )
);

CREATE POLICY "Users can update conference items"
ON public.conferencia_itens FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conferencias_estoque c
    WHERE c.id = conferencia_id
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.is_in_user_company_tree(auth.uid(), c.empresa_id)
    )
  )
);
