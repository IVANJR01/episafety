
-- =============================================================
-- FIX 6: Prevent users from changing their own empresa_id
-- Add WITH CHECK to restrict which fields can be modified
-- =============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND empresa_id IS NOT DISTINCT FROM (SELECT p2.empresa_id FROM profiles p2 WHERE p2.user_id = auth.uid()));

-- =============================================================
-- FIX 7: Add user_id column to funcionarios for secure identity matching
-- =============================================================
ALTER TABLE public.funcionarios ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Create a helper function to get funcionario IDs for the current user
CREATE OR REPLACE FUNCTION public.get_my_funcionario_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM funcionarios WHERE user_id = auth.uid()
$$;

-- =============================================================
-- FIX 8: Replace name-based matching policies with user_id-based
-- =============================================================

-- videos_atribuicao
DROP POLICY IF EXISTS "Func read own videos_atribuicao" ON public.videos_atribuicao;
CREATE POLICY "Func read own videos_atribuicao"
ON public.videos_atribuicao FOR SELECT
TO authenticated
USING (funcionario_id IN (SELECT get_my_funcionario_ids()));

-- cursos_atribuicao
DROP POLICY IF EXISTS "Func read own cursos_atribuicao" ON public.cursos_atribuicao;
CREATE POLICY "Func read own cursos_atribuicao"
ON public.cursos_atribuicao FOR SELECT
TO authenticated
USING (funcionario_id IN (SELECT get_my_funcionario_ids()));

-- videos_visualizacao
DROP POLICY IF EXISTS "Func read own videos_visualizacao" ON public.videos_visualizacao;
CREATE POLICY "Func read own videos_visualizacao"
ON public.videos_visualizacao FOR SELECT
TO authenticated
USING (funcionario_id IN (SELECT get_my_funcionario_ids()));

DROP POLICY IF EXISTS "Func insert own videos_visualizacao" ON public.videos_visualizacao;
CREATE POLICY "Func insert own videos_visualizacao"
ON public.videos_visualizacao FOR INSERT
TO authenticated
WITH CHECK (funcionario_id IN (SELECT get_my_funcionario_ids()));

DROP POLICY IF EXISTS "Func update own videos_visualizacao" ON public.videos_visualizacao;
CREATE POLICY "Func update own videos_visualizacao"
ON public.videos_visualizacao FOR UPDATE
TO authenticated
USING (funcionario_id IN (SELECT get_my_funcionario_ids()));

-- =============================================================
-- FIX 9: Scope admin role policies to same company
-- Use a security definer function to check admin's company
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_same_company_user(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.empresa_id = p2.empresa_id
    WHERE p1.user_id = auth.uid() AND p2.user_id = _target_user_id
  )
$$;

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND is_same_company_user(user_id));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role AND is_same_company_user(user_id));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role AND is_same_company_user(user_id))
WITH CHECK (role != 'super_admin'::app_role);

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role AND is_same_company_user(user_id));
