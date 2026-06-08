-- 1. Padronização de Colunas (empresa_id)
-- Adicionar empresa_id onde falta

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aso_assinaturas' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.aso_assinaturas ADD COLUMN empresa_id UUID REFERENCES public.empresa_config(id);
        UPDATE public.aso_assinaturas t SET empresa_id = p.empresa_id FROM public.asos p WHERE t.aso_id = p.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aso_exames' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.aso_exames ADD COLUMN empresa_id UUID REFERENCES public.empresa_config(id);
        UPDATE public.aso_exames t SET empresa_id = p.empresa_id FROM public.asos p WHERE t.aso_id = p.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aso_riscos' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.aso_riscos ADD COLUMN empresa_id UUID REFERENCES public.empresa_config(id);
        UPDATE public.aso_riscos t SET empresa_id = p.empresa_id FROM public.asos p WHERE t.aso_id = p.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aso_verificacao' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.aso_verificacao ADD COLUMN empresa_id UUID REFERENCES public.empresa_config(id);
        UPDATE public.aso_verificacao t SET empresa_id = p.empresa_id FROM public.asos p WHERE t.aso_id = p.id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conferencia_itens' AND column_name = 'empresa_id') THEN
        ALTER TABLE public.conferencia_itens ADD COLUMN empresa_id UUID REFERENCES public.empresa_config(id);
        UPDATE public.conferencia_itens t SET empresa_id = p.empresa_id FROM public.conferencias_estoque p WHERE t.conferencia_id = p.id;
    END IF;
END $$;

-- 2. Reforçar RLS (Row Level Security)
-- Padronizar políticas em tabelas críticas

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own company data" ON public.funcionarios;
CREATE POLICY "Users can manage their own company data" ON public.funcionarios
FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

ALTER TABLE public.ghe_ges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company ghes" ON public.ghe_ges;
CREATE POLICY "Users can manage their company ghes" ON public.ghe_ges
FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

ALTER TABLE public.asos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company asos" ON public.asos;
CREATE POLICY "Users can manage their company asos" ON public.asos
FOR ALL TO authenticated
USING (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_super_admin(auth.uid()) OR is_principal(auth.uid()) OR is_in_user_company_tree(auth.uid(), empresa_id));

-- Grant permissions (Essential for PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_assinaturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_exames TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_riscos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aso_verificacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conferencia_itens TO authenticated;

GRANT ALL ON public.aso_assinaturas TO service_role;
GRANT ALL ON public.aso_exames TO service_role;
GRANT ALL ON public.aso_riscos TO service_role;
GRANT ALL ON public.aso_verificacao TO service_role;
GRANT ALL ON public.conferencia_itens TO service_role;
