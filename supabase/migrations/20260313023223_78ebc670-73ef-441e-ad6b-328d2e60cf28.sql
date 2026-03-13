
CREATE POLICY "Read global cursos_documentos" ON public.cursos_documentos FOR SELECT TO authenticated USING (empresa_id IS NULL);
