
-- Table to link employees to specific training videos
CREATE TABLE public.videos_atribuicao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos_treinamento(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, funcionario_id)
);

ALTER TABLE public.videos_atribuicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access videos_atribuicao" ON public.videos_atribuicao FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read videos_atribuicao" ON public.videos_atribuicao FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert videos_atribuicao" ON public.videos_atribuicao FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete videos_atribuicao" ON public.videos_atribuicao FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Principal read videos_atribuicao tree" ON public.videos_atribuicao FOR SELECT TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal insert videos_atribuicao tree" ON public.videos_atribuicao FOR INSERT TO authenticated WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal delete videos_atribuicao tree" ON public.videos_atribuicao FOR DELETE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
-- Allow global read for employees
CREATE POLICY "Read own videos_atribuicao" ON public.videos_atribuicao FOR SELECT TO authenticated USING (true);
