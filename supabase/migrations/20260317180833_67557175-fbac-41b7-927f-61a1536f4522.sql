
-- =============================================================
-- FIX 1: Privilege Escalation - Admin can escalate to super_admin
-- Replace the ALL policy with separate SELECT/UPDATE/DELETE + restricted INSERT
-- =============================================================
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Admins can read all roles
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete non-super_admin roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role);

-- Admins can update non-super_admin roles (and cannot set to super_admin)
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role)
WITH CHECK (role != 'super_admin'::app_role);

-- Admins can insert roles EXCEPT super_admin
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role);

-- =============================================================
-- FIX 2: Cross-tenant video assignments exposure
-- Replace the overly permissive "Read own videos_atribuicao" (USING true)
-- with a proper tenant-scoped + self-access policy
-- =============================================================
DROP POLICY IF EXISTS "Read own videos_atribuicao" ON public.videos_atribuicao;

CREATE POLICY "Func read own videos_atribuicao"
ON public.videos_atribuicao FOR SELECT
TO authenticated
USING (
  funcionario_id IN (
    SELECT f.id FROM funcionarios f
    JOIN profiles p ON p.empresa_id = f.empresa_id AND lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);

-- =============================================================
-- FIX 3: Principal can update profiles across companies
-- Fix the USING clause to include company tree check
-- =============================================================
DROP POLICY IF EXISTS "Principal can update profiles in company tree" ON public.profiles;

CREATE POLICY "Principal can update profiles in company tree"
ON public.profiles FOR UPDATE
TO authenticated
USING (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id))
WITH CHECK (is_principal(auth.uid()) AND is_in_user_company_tree(auth.uid(), empresa_id));

-- =============================================================
-- FIX 4: Course assignments cross-tenant leak via name collision
-- Add empresa_id constraint to the self-access policy
-- =============================================================
DROP POLICY IF EXISTS "Func read own cursos_atribuicao" ON public.cursos_atribuicao;

CREATE POLICY "Func read own cursos_atribuicao"
ON public.cursos_atribuicao FOR SELECT
TO authenticated
USING (
  funcionario_id IN (
    SELECT f.id FROM funcionarios f
    JOIN profiles p ON p.empresa_id = f.empresa_id AND lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);
