
CREATE TABLE public.aso_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  aso_id uuid REFERENCES public.asos(id) ON DELETE SET NULL,
  funcionario_id uuid,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  perfil_usuario text,
  acao text NOT NULL CHECK (acao IN ('visualizou_aso','baixou_pdf','imprimiu_aso')),
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.aso_download_logs TO authenticated;
GRANT ALL ON public.aso_download_logs TO service_role;
ALTER TABLE public.aso_download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aso_logs_select" ON public.aso_download_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()) OR public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "aso_logs_insert" ON public.aso_download_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_in_user_company_tree(auth.uid(), empresa_id) OR public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid()));

CREATE INDEX idx_aso_logs_empresa ON public.aso_download_logs(empresa_id);
CREATE INDEX idx_aso_logs_aso ON public.aso_download_logs(aso_id);
