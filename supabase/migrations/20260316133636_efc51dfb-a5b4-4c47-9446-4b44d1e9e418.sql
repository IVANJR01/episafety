
-- Tabela de vídeos de treinamento
CREATE TABLE public.videos_treinamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  video_url TEXT NOT NULL,
  duracao_segundos INTEGER DEFAULT 0,
  pontuacao_minima INTEGER DEFAULT 70,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de visualizações / pontuação
CREATE TABLE public.videos_visualizacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos_treinamento(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  percentual_assistido INTEGER DEFAULT 0,
  pontuacao INTEGER,
  concluido BOOLEAN DEFAULT false,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, funcionario_id)
);

-- Tabela de perguntas do quiz
CREATE TABLE public.videos_perguntas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos_treinamento(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  opcao_a TEXT NOT NULL,
  opcao_b TEXT NOT NULL,
  opcao_c TEXT,
  opcao_d TEXT,
  resposta_correta TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  empresa_id UUID REFERENCES public.empresa_config(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.videos_treinamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos_visualizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos_perguntas ENABLE ROW LEVEL SECURITY;

-- Super admin
CREATE POLICY "Super admin full access videos_treinamento" ON public.videos_treinamento FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admin full access videos_visualizacao" ON public.videos_visualizacao FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Super admin full access videos_perguntas" ON public.videos_perguntas FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- Tenant policies
CREATE POLICY "Tenant read videos_treinamento" ON public.videos_treinamento FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert videos_treinamento" ON public.videos_treinamento FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update videos_treinamento" ON public.videos_treinamento FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete videos_treinamento" ON public.videos_treinamento FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant read videos_visualizacao" ON public.videos_visualizacao FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert videos_visualizacao" ON public.videos_visualizacao FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update videos_visualizacao" ON public.videos_visualizacao FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete videos_visualizacao" ON public.videos_visualizacao FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));

CREATE POLICY "Tenant read videos_perguntas" ON public.videos_perguntas FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert videos_perguntas" ON public.videos_perguntas FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update videos_perguntas" ON public.videos_perguntas FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete videos_perguntas" ON public.videos_perguntas FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));

-- Principal policies (company tree)
CREATE POLICY "Principal read videos_treinamento tree" ON public.videos_treinamento FOR SELECT TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal insert videos_treinamento tree" ON public.videos_treinamento FOR INSERT TO authenticated WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal update videos_treinamento tree" ON public.videos_treinamento FOR UPDATE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal delete videos_treinamento tree" ON public.videos_treinamento FOR DELETE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal read videos_visualizacao tree" ON public.videos_visualizacao FOR SELECT TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal insert videos_visualizacao tree" ON public.videos_visualizacao FOR INSERT TO authenticated WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal update videos_visualizacao tree" ON public.videos_visualizacao FOR UPDATE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal delete videos_visualizacao tree" ON public.videos_visualizacao FOR DELETE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal read videos_perguntas tree" ON public.videos_perguntas FOR SELECT TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal insert videos_perguntas tree" ON public.videos_perguntas FOR INSERT TO authenticated WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal update videos_perguntas tree" ON public.videos_perguntas FOR UPDATE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Principal delete videos_perguntas tree" ON public.videos_perguntas FOR DELETE TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- Storage bucket for training videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos-treinamento', 'videos-treinamento', true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos-treinamento');
CREATE POLICY "Authenticated users can read videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos-treinamento');
CREATE POLICY "Authenticated users can delete own videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos-treinamento');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos_treinamento;
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos_visualizacao;
