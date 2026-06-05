
CREATE TABLE IF NOT EXISTS public.locais_emissao_aso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  cidade text,
  uf text,
  endereco text,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locais_emissao_empresa ON public.locais_emissao_aso(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_emissao_aso TO authenticated;
GRANT ALL ON public.locais_emissao_aso TO service_role;

ALTER TABLE public.locais_emissao_aso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locais_emissao_select" ON public.locais_emissao_aso
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
    OR empresa_id = ANY (public.get_user_empresa_ids((SELECT email FROM auth.users WHERE id = auth.uid())))
  );

CREATE POLICY "locais_emissao_insert" ON public.locais_emissao_aso
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "locais_emissao_update" ON public.locais_emissao_aso
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "locais_emissao_delete" ON public.locais_emissao_aso
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE TRIGGER trg_locais_emissao_updated
  BEFORE UPDATE ON public.locais_emissao_aso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.asos
  ADD COLUMN IF NOT EXISTS local_emissao_id uuid REFERENCES public.locais_emissao_aso(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_emissao_snapshot text;
