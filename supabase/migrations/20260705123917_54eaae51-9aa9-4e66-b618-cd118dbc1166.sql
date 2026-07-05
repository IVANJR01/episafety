
-- Fix residual v3 policies on aso_exames (child of asos)
DROP POLICY IF EXISTS aso_exames_select_v3 ON public.aso_exames;
DROP POLICY IF EXISTS aso_exames_insert_v3 ON public.aso_exames;
DROP POLICY IF EXISTS aso_exames_update_v3 ON public.aso_exames;
DROP POLICY IF EXISTS aso_exames_delete_v3 ON public.aso_exames;

CREATE POLICY aso_exames_select_v4 ON public.aso_exames
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (
        public.is_principal(auth.uid())
        OR public.has_aso_full_access(auth.uid())
        OR (public.has_permission(auth.uid(), 'portal_rh:aso:visualizar') AND a.liberado_portal_rh = true)
      )
  )
);

CREATE POLICY aso_exames_insert_v4 ON public.aso_exames
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);

CREATE POLICY aso_exames_update_v4 ON public.aso_exames
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);

CREATE POLICY aso_exames_delete_v4 ON public.aso_exames
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_exames.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);

-- Fix aso_riscos (single ALL policy on old model)
DROP POLICY IF EXISTS aso_riscos_via_aso ON public.aso_riscos;

CREATE POLICY aso_riscos_select_v4 ON public.aso_riscos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_riscos.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (
        public.is_principal(auth.uid())
        OR public.has_aso_full_access(auth.uid())
        OR (public.has_permission(auth.uid(), 'portal_rh:aso:visualizar') AND a.liberado_portal_rh = true)
      )
  )
);

CREATE POLICY aso_riscos_insert_v4 ON public.aso_riscos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_riscos.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);

CREATE POLICY aso_riscos_update_v4 ON public.aso_riscos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_riscos.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_riscos.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);

CREATE POLICY aso_riscos_delete_v4 ON public.aso_riscos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.asos a
    WHERE a.id = aso_riscos.aso_id
      AND public.is_active_empresa(auth.uid(), a.empresa_id)
      AND (public.is_principal(auth.uid()) OR public.has_aso_full_access(auth.uid()))
  )
);
