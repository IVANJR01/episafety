
-- Create junction table for multi-empresa access
CREATE TABLE public.usuario_empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(email, empresa_id)
);

-- Index for fast lookups
CREATE INDEX idx_usuario_empresas_email ON public.usuario_empresas (lower(email));
CREATE INDEX idx_usuario_empresas_empresa_id ON public.usuario_empresas (empresa_id);

-- Enable RLS
ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admins can do everything"
  ON public.usuario_empresas FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Principals can manage their tree"
  ON public.usuario_empresas FOR ALL
  USING (
    public.is_principal(auth.uid())
    AND public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "Users can view own empresas"
  ON public.usuario_empresas FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Security definer function to get all empresa_ids for a user
CREATE OR REPLACE FUNCTION public.get_user_empresa_ids(_email text)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT empresa_id), '{}')
  FROM (
    -- From the new junction table
    SELECT empresa_id FROM public.usuario_empresas WHERE lower(email) = lower(_email) AND empresa_id IS NOT NULL
    UNION
    -- Fallback: from usuarios_liberados (backward compat)
    SELECT empresa_id FROM public.usuarios_liberados WHERE lower(email) = lower(_email) AND empresa_id IS NOT NULL
  ) sub
$$;

-- Migrate existing empresa_id from usuarios_liberados into the junction table
INSERT INTO public.usuario_empresas (email, empresa_id)
SELECT DISTINCT lower(ul.email), ul.empresa_id
FROM public.usuarios_liberados ul
WHERE ul.empresa_id IS NOT NULL
ON CONFLICT (email, empresa_id) DO NOTHING;
