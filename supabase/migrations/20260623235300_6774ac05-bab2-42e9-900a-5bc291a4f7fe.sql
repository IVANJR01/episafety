
-- ============================================================
-- 1. has_permission helper (security definer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_principal(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.usuarios_liberados u
      WHERE u.email = (SELECT email FROM auth.users WHERE id = _user_id)
        AND COALESCE(u.ativo, true) = true
        AND (
          _permission = ANY(u.modulos_permitidos)
          OR split_part(_permission, ':', 1) = ANY(u.modulos_permitidos)
        )
    )
$$;

-- ============================================================
-- 2. asos.liberado_portal_rh column + backfill + trigger
-- ============================================================
ALTER TABLE public.asos
  ADD COLUMN IF NOT EXISTS liberado_portal_rh boolean NOT NULL DEFAULT false;

-- Backfill: ASOs já assinados/concluídos com PDF ficam liberados
UPDATE public.asos
SET liberado_portal_rh = true
WHERE status IN ('assinado', 'concluido', 'finalizado')
  AND pdf_url IS NOT NULL
  AND liberado_portal_rh = false;

-- Trigger para manter a flag em sincronia
CREATE OR REPLACE FUNCTION public.sync_aso_liberado_portal_rh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.liberado_portal_rh := (
    NEW.status IN ('assinado', 'concluido', 'finalizado')
    AND NEW.pdf_url IS NOT NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_aso_liberado_portal_rh ON public.asos;
CREATE TRIGGER trg_sync_aso_liberado_portal_rh
  BEFORE INSERT OR UPDATE OF status, pdf_url
  ON public.asos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_aso_liberado_portal_rh();

-- ============================================================
-- 3. Policies aditivas para Portal RH (somente SELECT)
-- ============================================================

-- asos: RH vê apenas ASO liberado da árvore de empresa
DROP POLICY IF EXISTS "RH read asos liberados" ON public.asos;
CREATE POLICY "RH read asos liberados"
ON public.asos FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  AND public.is_in_user_company_tree(auth.uid(), empresa_id)
  AND liberado_portal_rh = true
);

-- funcionarios: RH vê funcionários da empresa
DROP POLICY IF EXISTS "RH read funcionarios" ON public.funcionarios;
CREATE POLICY "RH read funcionarios"
ON public.funcionarios FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:funcionarios:visualizar')
  AND public.is_in_user_company_tree(auth.uid(), empresa_id)
);

-- aso_medicos: RH lê médicos da empresa (empresa_id nunca null)
DROP POLICY IF EXISTS "RH read aso_medicos" ON public.aso_medicos;
CREATE POLICY "RH read aso_medicos"
ON public.aso_medicos FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  AND empresa_id IS NOT NULL
  AND public.is_in_user_company_tree(auth.uid(), empresa_id)
);

-- locais_emissao_aso
DROP POLICY IF EXISTS "RH read locais_emissao_aso" ON public.locais_emissao_aso;
CREATE POLICY "RH read locais_emissao_aso"
ON public.locais_emissao_aso FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  AND public.is_in_user_company_tree(auth.uid(), empresa_id)
);

-- aso_exames: via aso liberado
DROP POLICY IF EXISTS "RH read aso_exames" ON public.aso_exames;
CREATE POLICY "RH read aso_exames"
ON public.aso_exames FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  AND EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND a.liberado_portal_rh = true
      AND public.is_in_user_company_tree(auth.uid(), a.empresa_id)
  )
);

-- aso_assinaturas: via aso liberado
DROP POLICY IF EXISTS "RH read aso_assinaturas" ON public.aso_assinaturas;
CREATE POLICY "RH read aso_assinaturas"
ON public.aso_assinaturas FOR SELECT
TO authenticated
USING (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  AND EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_assinaturas.aso_id
      AND a.liberado_portal_rh = true
      AND public.is_in_user_company_tree(auth.uid(), a.empresa_id)
  )
);
