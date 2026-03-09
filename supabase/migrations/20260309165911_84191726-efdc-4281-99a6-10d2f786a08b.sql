
-- Add empresa_id to all tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL;
ALTER TABLE public.epis ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.fichas_entrega ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.exames ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.inspecao_itens ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.treinamento_participantes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;
ALTER TABLE public.usuarios_liberados ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_epis_empresa_id ON public.epis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_empresa_id ON public.funcionarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_entregas_empresa_id ON public.entregas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fichas_entrega_empresa_id ON public.fichas_entrega(empresa_id);
CREATE INDEX IF NOT EXISTS idx_exames_empresa_id ON public.exames(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inspecoes_empresa_id ON public.inspecoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inspecao_itens_empresa_id ON public.inspecao_itens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_empresa_id ON public.ordens_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_treinamentos_empresa_id ON public.treinamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_participantes_empresa_id ON public.treinamento_participantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_liberados_empresa_id ON public.usuarios_liberados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON public.profiles(empresa_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Drop old RLS policies and create tenant-isolated ones

-- empresa_config
DROP POLICY IF EXISTS "Auth insert empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Auth read empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Auth update empresa_config" ON public.empresa_config;
CREATE POLICY "Super admin full access empresa_config" ON public.empresa_config FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "User read own empresa" ON public.empresa_config FOR SELECT TO authenticated USING (id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "User update own empresa" ON public.empresa_config FOR UPDATE TO authenticated USING (id = public.get_user_empresa_id(auth.uid()));

-- epis
DROP POLICY IF EXISTS "Auth delete epis" ON public.epis;
DROP POLICY IF EXISTS "Auth insert epis" ON public.epis;
DROP POLICY IF EXISTS "Auth read epis" ON public.epis;
DROP POLICY IF EXISTS "Auth update epis" ON public.epis;
CREATE POLICY "Super admin full access epis" ON public.epis FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read epis" ON public.epis FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert epis" ON public.epis FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update epis" ON public.epis FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete epis" ON public.epis FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- funcionarios
DROP POLICY IF EXISTS "Auth delete funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Auth insert funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Auth read funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Auth update funcionarios" ON public.funcionarios;
CREATE POLICY "Super admin full access funcionarios" ON public.funcionarios FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- entregas
DROP POLICY IF EXISTS "Auth delete entregas" ON public.entregas;
DROP POLICY IF EXISTS "Auth insert entregas" ON public.entregas;
DROP POLICY IF EXISTS "Auth read entregas" ON public.entregas;
DROP POLICY IF EXISTS "Auth update entregas" ON public.entregas;
CREATE POLICY "Super admin full access entregas" ON public.entregas FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read entregas" ON public.entregas FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert entregas" ON public.entregas FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update entregas" ON public.entregas FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete entregas" ON public.entregas FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- fichas_entrega
DROP POLICY IF EXISTS "Auth delete fichas_entrega" ON public.fichas_entrega;
DROP POLICY IF EXISTS "Auth insert fichas_entrega" ON public.fichas_entrega;
DROP POLICY IF EXISTS "Auth read fichas_entrega" ON public.fichas_entrega;
DROP POLICY IF EXISTS "Auth update fichas_entrega" ON public.fichas_entrega;
CREATE POLICY "Super admin full access fichas_entrega" ON public.fichas_entrega FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read fichas_entrega" ON public.fichas_entrega FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert fichas_entrega" ON public.fichas_entrega FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update fichas_entrega" ON public.fichas_entrega FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete fichas_entrega" ON public.fichas_entrega FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- exames
DROP POLICY IF EXISTS "Auth delete exames" ON public.exames;
DROP POLICY IF EXISTS "Auth insert exames" ON public.exames;
DROP POLICY IF EXISTS "Auth read exames" ON public.exames;
DROP POLICY IF EXISTS "Auth update exames" ON public.exames;
CREATE POLICY "Super admin full access exames" ON public.exames FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read exames" ON public.exames FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert exames" ON public.exames FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update exames" ON public.exames FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete exames" ON public.exames FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- inspecoes
DROP POLICY IF EXISTS "Auth delete inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Auth insert inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Auth read inspecoes" ON public.inspecoes;
DROP POLICY IF EXISTS "Auth update inspecoes" ON public.inspecoes;
CREATE POLICY "Super admin full access inspecoes" ON public.inspecoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read inspecoes" ON public.inspecoes FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert inspecoes" ON public.inspecoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update inspecoes" ON public.inspecoes FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete inspecoes" ON public.inspecoes FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- inspecao_itens
DROP POLICY IF EXISTS "Auth delete inspecao_itens" ON public.inspecao_itens;
DROP POLICY IF EXISTS "Auth insert inspecao_itens" ON public.inspecao_itens;
DROP POLICY IF EXISTS "Auth read inspecao_itens" ON public.inspecao_itens;
DROP POLICY IF EXISTS "Auth update inspecao_itens" ON public.inspecao_itens;
CREATE POLICY "Super admin full access inspecao_itens" ON public.inspecao_itens FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read inspecao_itens" ON public.inspecao_itens FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert inspecao_itens" ON public.inspecao_itens FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update inspecao_itens" ON public.inspecao_itens FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete inspecao_itens" ON public.inspecao_itens FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- ordens_servico
DROP POLICY IF EXISTS "Auth delete ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Auth insert ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Auth read ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Auth update ordens_servico" ON public.ordens_servico;
CREATE POLICY "Super admin full access ordens_servico" ON public.ordens_servico FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read ordens_servico" ON public.ordens_servico FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert ordens_servico" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update ordens_servico" ON public.ordens_servico FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete ordens_servico" ON public.ordens_servico FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- treinamentos
DROP POLICY IF EXISTS "Auth delete treinamentos" ON public.treinamentos;
DROP POLICY IF EXISTS "Auth insert treinamentos" ON public.treinamentos;
DROP POLICY IF EXISTS "Auth read treinamentos" ON public.treinamentos;
DROP POLICY IF EXISTS "Auth update treinamentos" ON public.treinamentos;
CREATE POLICY "Super admin full access treinamentos" ON public.treinamentos FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read treinamentos" ON public.treinamentos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert treinamentos" ON public.treinamentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update treinamentos" ON public.treinamentos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete treinamentos" ON public.treinamentos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- treinamento_participantes
DROP POLICY IF EXISTS "Auth delete treinamento_participantes" ON public.treinamento_participantes;
DROP POLICY IF EXISTS "Auth insert treinamento_participantes" ON public.treinamento_participantes;
DROP POLICY IF EXISTS "Auth read treinamento_participantes" ON public.treinamento_participantes;
DROP POLICY IF EXISTS "Auth update treinamento_participantes" ON public.treinamento_participantes;
CREATE POLICY "Super admin full access treinamento_participantes" ON public.treinamento_participantes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read treinamento_participantes" ON public.treinamento_participantes FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert treinamento_participantes" ON public.treinamento_participantes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update treinamento_participantes" ON public.treinamento_participantes FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete treinamento_participantes" ON public.treinamento_participantes FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));

-- usuarios_liberados
DROP POLICY IF EXISTS "Auth delete usuarios_liberados" ON public.usuarios_liberados;
DROP POLICY IF EXISTS "Auth insert usuarios_liberados" ON public.usuarios_liberados;
DROP POLICY IF EXISTS "Auth read usuarios_liberados" ON public.usuarios_liberados;
DROP POLICY IF EXISTS "Auth update usuarios_liberados" ON public.usuarios_liberados;
CREATE POLICY "Super admin full access usuarios_liberados" ON public.usuarios_liberados FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant read usuarios_liberados" ON public.usuarios_liberados FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant insert usuarios_liberados" ON public.usuarios_liberados FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant update usuarios_liberados" ON public.usuarios_liberados FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
CREATE POLICY "Tenant delete usuarios_liberados" ON public.usuarios_liberados FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id(auth.uid()));
