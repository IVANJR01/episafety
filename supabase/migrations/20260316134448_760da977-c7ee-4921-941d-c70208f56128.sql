
-- Allow all authenticated users to read global videos (empresa_id IS NULL)
CREATE POLICY "Read global videos_treinamento" ON public.videos_treinamento FOR SELECT TO authenticated USING (empresa_id IS NULL);
CREATE POLICY "Read global videos_perguntas" ON public.videos_perguntas FOR SELECT TO authenticated USING (empresa_id IS NULL);
CREATE POLICY "Read global videos_visualizacao" ON public.videos_visualizacao FOR SELECT TO authenticated USING (empresa_id IS NULL);

-- Allow all authenticated to insert/update their own visualizacao (for quiz results)
CREATE POLICY "Insert global videos_visualizacao" ON public.videos_visualizacao FOR INSERT TO authenticated WITH CHECK (empresa_id IS NULL OR empresa_id = get_user_empresa_id(auth.uid()));
CREATE POLICY "Update global videos_visualizacao" ON public.videos_visualizacao FOR UPDATE TO authenticated USING (empresa_id IS NULL OR empresa_id = get_user_empresa_id(auth.uid()));
