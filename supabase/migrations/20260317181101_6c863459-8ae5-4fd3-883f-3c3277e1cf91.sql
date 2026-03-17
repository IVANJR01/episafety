
-- =============================================================
-- FIX 5: Cross-tenant training records manipulation via global policies
-- Replace overly permissive global policies with tenant-scoped ones
-- =============================================================
DROP POLICY IF EXISTS "Insert global videos_visualizacao" ON public.videos_visualizacao;
DROP POLICY IF EXISTS "Read global videos_visualizacao" ON public.videos_visualizacao;
DROP POLICY IF EXISTS "Update global videos_visualizacao" ON public.videos_visualizacao;

-- Users can insert their own visualization records (tenant-scoped)
-- The existing "Tenant insert videos_visualizacao" already covers empresa_id = user's empresa
-- For funcionarios viewing their own videos, they need to insert with their empresa_id
-- No global insert needed.

-- For self-access reading (funcionario viewing own progress):
CREATE POLICY "Func read own videos_visualizacao"
ON public.videos_visualizacao FOR SELECT
TO authenticated
USING (
  funcionario_id IN (
    SELECT f.id FROM funcionarios f
    JOIN profiles p ON p.empresa_id = f.empresa_id AND lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);

-- For self-access insert (funcionario recording own progress):
CREATE POLICY "Func insert own videos_visualizacao"
ON public.videos_visualizacao FOR INSERT
TO authenticated
WITH CHECK (
  funcionario_id IN (
    SELECT f.id FROM funcionarios f
    JOIN profiles p ON p.empresa_id = f.empresa_id AND lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);

-- For self-access update (funcionario updating own progress):
CREATE POLICY "Func update own videos_visualizacao"
ON public.videos_visualizacao FOR UPDATE
TO authenticated
USING (
  funcionario_id IN (
    SELECT f.id FROM funcionarios f
    JOIN profiles p ON p.empresa_id = f.empresa_id AND lower(p.nome) = lower(f.nome)
    WHERE p.user_id = auth.uid()
  )
);
