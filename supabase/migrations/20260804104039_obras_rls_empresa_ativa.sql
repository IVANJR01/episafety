-- =============================================================================
-- Atualiza as políticas de RLS da tabela 'obras' para usar 'is_empresa_authorized'
-- em vez da abordagem legada que usava email no JWT. Isso resolve o erro 
-- "new row violates row-level security policy" ao criar obras em empresas filhas.
-- =============================================================================

DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

CREATE POLICY "Obras select por empresa" ON public.obras
FOR SELECT TO authenticated
USING (public.is_empresa_authorized(auth.uid(), empresa_id));

CREATE POLICY "Obras insert por empresa" ON public.obras
FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_authorized(auth.uid(), empresa_id));

CREATE POLICY "Obras update por empresa" ON public.obras
FOR UPDATE TO authenticated
USING (public.is_empresa_authorized(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_authorized(auth.uid(), empresa_id));

CREATE POLICY "Obras delete por empresa" ON public.obras
FOR DELETE TO authenticated
USING (public.is_empresa_authorized(auth.uid(), empresa_id));
