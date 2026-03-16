
-- Helper function: check if user is principal
CREATE OR REPLACE FUNCTION public.is_principal(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_liberados
    WHERE email = (SELECT email FROM auth.users WHERE id = _user_id)
    AND is_principal = true
  )
$$;

-- Helper function: check if an empresa belongs to user's company tree (same empresa or child)
CREATE OR REPLACE FUNCTION public.is_in_user_company_tree(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM empresa_config
    WHERE id = _empresa_id
    AND (
      id = get_user_empresa_id(_user_id)
      OR empresa_pai_id = get_user_empresa_id(_user_id)
    )
  )
$$;

-- Allow Principal users to update profiles of users in their company tree
CREATE POLICY "Principal can update profiles in company tree"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
)
WITH CHECK (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
);

-- Allow Principal users to insert usuarios_liberados for their company tree
CREATE POLICY "Principal insert usuarios_liberados company tree"
ON public.usuarios_liberados
FOR INSERT
TO authenticated
WITH CHECK (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
);

-- Allow Principal users to update usuarios_liberados for their company tree
CREATE POLICY "Principal update usuarios_liberados company tree"
ON public.usuarios_liberados
FOR UPDATE
TO authenticated
USING (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
)
WITH CHECK (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
);

-- Allow Principal users to read usuarios_liberados for their company tree
CREATE POLICY "Principal read usuarios_liberados company tree"
ON public.usuarios_liberados
FOR SELECT
TO authenticated
USING (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
);

-- Allow Principal users to delete usuarios_liberados for their company tree
CREATE POLICY "Principal delete usuarios_liberados company tree"
ON public.usuarios_liberados
FOR DELETE
TO authenticated
USING (
  is_principal(auth.uid())
  AND is_in_user_company_tree(auth.uid(), empresa_id)
);
