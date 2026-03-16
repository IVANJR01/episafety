
-- Add Principal access policies for ALL data tables so Principal users
-- can see/manage data from all units in their company tree (matriz + filiais)

-- ============ epis ============
CREATE POLICY "Principal read epis company tree" ON public.epis
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert epis company tree" ON public.epis
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update epis company tree" ON public.epis
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete epis company tree" ON public.epis
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ entregas ============
CREATE POLICY "Principal read entregas company tree" ON public.entregas
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert entregas company tree" ON public.entregas
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update entregas company tree" ON public.entregas
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete entregas company tree" ON public.entregas
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ funcionarios ============
CREATE POLICY "Principal read funcionarios company tree" ON public.funcionarios
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert funcionarios company tree" ON public.funcionarios
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update funcionarios company tree" ON public.funcionarios
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete funcionarios company tree" ON public.funcionarios
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ dds ============
CREATE POLICY "Principal read dds company tree" ON public.dds
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert dds company tree" ON public.dds
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update dds company tree" ON public.dds
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete dds company tree" ON public.dds
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ dds_participantes ============
CREATE POLICY "Principal read dds_participantes company tree" ON public.dds_participantes
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert dds_participantes company tree" ON public.dds_participantes
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update dds_participantes company tree" ON public.dds_participantes
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete dds_participantes company tree" ON public.dds_participantes
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ exames ============
CREATE POLICY "Principal read exames company tree" ON public.exames
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert exames company tree" ON public.exames
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update exames company tree" ON public.exames
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete exames company tree" ON public.exames
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ fichas_entrega ============
CREATE POLICY "Principal read fichas_entrega company tree" ON public.fichas_entrega
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert fichas_entrega company tree" ON public.fichas_entrega
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update fichas_entrega company tree" ON public.fichas_entrega
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete fichas_entrega company tree" ON public.fichas_entrega
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ inspecoes ============
CREATE POLICY "Principal read inspecoes company tree" ON public.inspecoes
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert inspecoes company tree" ON public.inspecoes
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update inspecoes company tree" ON public.inspecoes
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete inspecoes company tree" ON public.inspecoes
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ inspecao_itens ============
CREATE POLICY "Principal read inspecao_itens company tree" ON public.inspecao_itens
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert inspecao_itens company tree" ON public.inspecao_itens
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update inspecao_itens company tree" ON public.inspecao_itens
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete inspecao_itens company tree" ON public.inspecao_itens
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ inspecoes_subestacao ============
CREATE POLICY "Principal read inspecoes_subestacao company tree" ON public.inspecoes_subestacao
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert inspecoes_subestacao company tree" ON public.inspecoes_subestacao
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update inspecoes_subestacao company tree" ON public.inspecoes_subestacao
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete inspecoes_subestacao company tree" ON public.inspecoes_subestacao
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ treinamentos ============
CREATE POLICY "Principal read treinamentos company tree" ON public.treinamentos
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert treinamentos company tree" ON public.treinamentos
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update treinamentos company tree" ON public.treinamentos
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete treinamentos company tree" ON public.treinamentos
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ treinamento_participantes ============
CREATE POLICY "Principal read treinamento_part company tree" ON public.treinamento_participantes
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert treinamento_part company tree" ON public.treinamento_participantes
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update treinamento_part company tree" ON public.treinamento_participantes
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete treinamento_part company tree" ON public.treinamento_participantes
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ controle_treinamentos ============
CREATE POLICY "Principal read controle_treinamentos company tree" ON public.controle_treinamentos
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert controle_treinamentos company tree" ON public.controle_treinamentos
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update controle_treinamentos company tree" ON public.controle_treinamentos
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete controle_treinamentos company tree" ON public.controle_treinamentos
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ ordens_servico ============
CREATE POLICY "Principal read ordens_servico company tree" ON public.ordens_servico
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert ordens_servico company tree" ON public.ordens_servico
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update ordens_servico company tree" ON public.ordens_servico
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete ordens_servico company tree" ON public.ordens_servico
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ conformidades ============
CREATE POLICY "Principal read conformidades company tree" ON public.conformidades
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert conformidades company tree" ON public.conformidades
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update conformidades company tree" ON public.conformidades
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete conformidades company tree" ON public.conformidades
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ cursos_documentos ============
CREATE POLICY "Principal read cursos_documentos company tree" ON public.cursos_documentos
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert cursos_documentos company tree" ON public.cursos_documentos
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update cursos_documentos company tree" ON public.cursos_documentos
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete cursos_documentos company tree" ON public.cursos_documentos
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- ============ medicos ============
CREATE POLICY "Principal read medicos company tree" ON public.medicos
FOR SELECT TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal insert medicos company tree" ON public.medicos
FOR INSERT TO authenticated
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal update medicos company tree" ON public.medicos
FOR UPDATE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

CREATE POLICY "Principal delete medicos company tree" ON public.medicos
FOR DELETE TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));
