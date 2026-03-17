-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users in the same company tree can read profiles (for Filiais page etc.)
CREATE POLICY "Users can read profiles in company tree"
ON public.profiles FOR SELECT TO authenticated
USING (is_in_user_company_tree(auth.uid(), empresa_id));
