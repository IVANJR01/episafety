-- Tabela de Cursos (agrupador de módulos/vídeos)
CREATE TABLE public.cursos_video (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  pontuacao_minima integer NOT NULL DEFAULT 70,
  empresa_id uuid REFERENCES public.empresa_config(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar curso_id e ordem em videos_treinamento para vincular módulos
ALTER TABLE public.videos_treinamento
  ADD COLUMN curso_id uuid REFERENCES public.cursos_video(id) ON DELETE CASCADE,
  ADD COLUMN ordem integer NOT NULL DEFAULT 1;

-- Habilitar RLS
ALTER TABLE public.cursos_video ENABLE ROW LEVEL SECURITY;

-- Policies para cursos_video (espelha videos_treinamento)
CREATE POLICY "Super admin full access cursos_video" ON public.cursos_video FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Principal read cursos_video" ON public.cursos_video FOR SELECT TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Tenant read cursos_video" ON public.cursos_video FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Authenticated read cursos_video" ON public.cursos_video FOR SELECT TO authenticated USING (empresa_id IS NULL);

-- Atribuição de cursos a funcionários
CREATE TABLE public.cursos_atribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos_video(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresa_config(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(curso_id, funcionario_id)
);

ALTER TABLE public.cursos_atribuicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin full access cursos_atribuicao" ON public.cursos_atribuicao FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Principal full access cursos_atribuicao" ON public.cursos_atribuicao FOR ALL TO authenticated USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id)) WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "Tenant read cursos_atribuicao" ON public.cursos_atribuicao FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Func read own cursos_atribuicao" ON public.cursos_atribuicao FOR SELECT TO authenticated USING (
  funcionario_id IN (
    SELECT f.id FROM public.funcionarios f
    JOIN public.profiles p ON lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);