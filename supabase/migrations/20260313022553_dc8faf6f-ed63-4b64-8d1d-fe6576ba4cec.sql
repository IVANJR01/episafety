
CREATE TABLE public.cursos_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  validade_meses integer NOT NULL DEFAULT 0,
  empresa_id uuid REFERENCES public.empresa_config(id),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cursos_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access cursos_documentos" ON public.cursos_documentos FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "Tenant read cursos_documentos" ON public.cursos_documentos FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert cursos_documentos" ON public.cursos_documentos FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update cursos_documentos" ON public.cursos_documentos FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete cursos_documentos" ON public.cursos_documentos FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id(auth.uid()));
