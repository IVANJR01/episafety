
-- Corrigir políticas RLS da tabela obras: o JOIN direto em auth.users causa
-- "permission denied for table users" para o role authenticated.
-- Substituir pela busca de e-mail via public.profiles.

DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

CREATE POLICY "Obras select por empresa"
ON public.obras FOR SELECT
TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id = ANY (public.get_user_empresa_ids((SELECT email FROM public.profiles WHERE id = auth.uid())))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras insert por empresa"
ON public.obras FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id = ANY (public.get_user_empresa_ids((SELECT email FROM public.profiles WHERE id = auth.uid())))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras update por empresa"
ON public.obras FOR UPDATE
TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id = ANY (public.get_user_empresa_ids((SELECT email FROM public.profiles WHERE id = auth.uid())))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras delete por empresa"
ON public.obras FOR DELETE
TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
