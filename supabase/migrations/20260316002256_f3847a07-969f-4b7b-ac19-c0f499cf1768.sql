
-- Drop and recreate the Principal profiles update policy to handle null empresa_id cases
DROP POLICY IF EXISTS "Principal can update profiles in company tree" ON public.profiles;

CREATE POLICY "Principal can update profiles in company tree"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  is_principal(auth.uid())
)
WITH CHECK (
  is_principal(auth.uid())
  AND (empresa_id IS NULL OR is_in_user_company_tree(auth.uid(), empresa_id))
);
