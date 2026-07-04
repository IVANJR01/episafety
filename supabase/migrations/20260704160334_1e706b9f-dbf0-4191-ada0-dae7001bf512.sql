
DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

-- Empresa do usuário lida diretamente do JWT (email) + fallback via profiles.id.
-- Evita JOIN em auth.users e cobre casos em que profiles.id != auth.uid().
CREATE POLICY "Obras select por empresa" ON public.obras
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras insert por empresa" ON public.obras
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras update por empresa" ON public.obras
FOR UPDATE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras delete por empresa" ON public.obras
FOR DELETE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
