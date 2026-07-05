
-- =============================================================================
-- M1a — Funções novas (criadas ANTES da tabela user_active_empresa,
--        pois suas policies dependem de is_empresa_authorized).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_empresas(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT empresa_id
      FROM public.profiles
     WHERE user_id = _user_id AND empresa_id IS NOT NULL
    UNION
    SELECT ue.empresa_id
      FROM public.usuario_empresas ue
      JOIN public.profiles p ON lower(p.email) = lower(ue.email)
     WHERE p.user_id = _user_id
  )
  SELECT COALESCE(array_agg(DISTINCT e), ARRAY[]::uuid[])
  FROM (
    SELECT empresa_id AS e FROM base
    UNION
    SELECT ec.id AS e
      FROM public.empresa_config ec
      JOIN base b ON ec.empresa_pai_id = b.empresa_id
  ) s
  WHERE e IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_empresa_authorized(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _empresa_id IS NOT NULL
    AND (
      public.is_super_admin(_user_id)
      OR _empresa_id = ANY(public.get_user_empresas(_user_id))
    );
$$;

-- get_active_empresa_id e is_active_empresa: criadas depois da tabela.

-- =============================================================================
-- M1b — Tabela de sessão user_active_empresa
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_active_empresa (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_active_empresa TO authenticated;
GRANT ALL ON public.user_active_empresa TO service_role;

ALTER TABLE public.user_active_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_active_empresa_select_own
  ON public.user_active_empresa FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_active_empresa_insert_own
  ON public.user_active_empresa FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_empresa_authorized(auth.uid(), empresa_id)
  );

CREATE POLICY user_active_empresa_update_own
  ON public.user_active_empresa FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_empresa_authorized(auth.uid(), empresa_id)
  );

CREATE POLICY user_active_empresa_delete_own
  ON public.user_active_empresa FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_user_active_empresa_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_active_empresa_touch ON public.user_active_empresa;
CREATE TRIGGER trg_user_active_empresa_touch
  BEFORE UPDATE ON public.user_active_empresa
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_active_empresa_touch();

-- =============================================================================
-- M1c — Funções dependentes da tabela
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_active_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin(_user_id) THEN
      (SELECT empresa_id FROM public.user_active_empresa WHERE user_id = _user_id)
    ELSE
      COALESCE(
        (SELECT empresa_id FROM public.user_active_empresa WHERE user_id = _user_id),
        (SELECT empresa_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_empresa(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _empresa_id IS NOT NULL
    AND _empresa_id = public.get_active_empresa_id(_user_id)
    AND public.is_empresa_authorized(_user_id, _empresa_id);
$$;

-- =============================================================================
-- M2 — Seed a partir dos profiles existentes
-- =============================================================================

INSERT INTO public.user_active_empresa (user_id, empresa_id)
SELECT p.user_id, p.empresa_id
  FROM public.profiles p
 WHERE p.empresa_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)
   AND EXISTS (SELECT 1 FROM public.empresa_config ec WHERE ec.id = p.empresa_id)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- M3 — MÓDULO EXAMES: substituir policies para usar is_active_empresa.
--
-- Sem `is_super_admin OR ...` como bypass externo: Super Admin passa por
-- is_active_empresa e fica limitado à empresa ativa. Dentro do bloco de
-- papéis is_super_admin serve apenas para dispensar checagem de papel.
-- =============================================================================

-- ---------- asos ----------
DROP POLICY IF EXISTS asos_select_v3   ON public.asos;
DROP POLICY IF EXISTS asos_insert_v3   ON public.asos;
DROP POLICY IF EXISTS asos_update_v3   ON public.asos;
DROP POLICY IF EXISTS asos_delete_v3   ON public.asos;
DROP POLICY IF EXISTS asos_super_admin ON public.asos;

CREATE POLICY asos_select_v4 ON public.asos FOR SELECT TO authenticated
  USING (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
      OR (public.has_permission(auth.uid(), 'portal_rh:aso:visualizar') AND liberado_portal_rh = true)
    )
  );

CREATE POLICY asos_insert_v4 ON public.asos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
    )
  );

CREATE POLICY asos_update_v4 ON public.asos FOR UPDATE TO authenticated
  USING (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
    )
  )
  WITH CHECK (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
    )
  );

CREATE POLICY asos_delete_v4 ON public.asos FOR DELETE TO authenticated
  USING (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
    )
  );

-- ---------- exames ----------
DROP POLICY IF EXISTS "Principal delete exames company tree" ON public.exames;
DROP POLICY IF EXISTS "Principal insert exames company tree" ON public.exames;
DROP POLICY IF EXISTS "Principal read exames company tree"   ON public.exames;
DROP POLICY IF EXISTS "Principal update exames company tree" ON public.exames;
DROP POLICY IF EXISTS "Super admin full access exames"       ON public.exames;
DROP POLICY IF EXISTS "Tenant delete exames" ON public.exames;
DROP POLICY IF EXISTS "Tenant insert exames" ON public.exames;
DROP POLICY IF EXISTS "Tenant read exames"   ON public.exames;
DROP POLICY IF EXISTS "Tenant update exames" ON public.exames;

CREATE POLICY exames_select_v4 ON public.exames FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY exames_insert_v4 ON public.exames FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY exames_update_v4 ON public.exames FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY exames_delete_v4 ON public.exames FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_medicos ----------
DROP POLICY IF EXISTS aso_medicos_isolation_delete ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_isolation_insert ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_isolation_select ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_isolation_update ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_rh_select_v3     ON public.aso_medicos;
DROP POLICY IF EXISTS aso_medicos_super_admin      ON public.aso_medicos;

CREATE POLICY aso_medicos_select_v4 ON public.aso_medicos FOR SELECT TO authenticated
  USING (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
      OR public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
    )
  );
CREATE POLICY aso_medicos_insert_v4 ON public.aso_medicos FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_medicos_update_v4 ON public.aso_medicos FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_medicos_delete_v4 ON public.aso_medicos FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_exames_catalogo ----------
DROP POLICY IF EXISTS aso_cat_isolation_select ON public.aso_exames_catalogo;
DROP POLICY IF EXISTS aso_cat_isolation_write  ON public.aso_exames_catalogo;

CREATE POLICY aso_cat_select_v4 ON public.aso_exames_catalogo FOR SELECT TO authenticated
  USING (
    empresa_id IS NULL
    OR public.is_active_empresa(auth.uid(), empresa_id)
  );
CREATE POLICY aso_cat_insert_v4 ON public.aso_exames_catalogo FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_cat_update_v4 ON public.aso_exames_catalogo FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_cat_delete_v4 ON public.aso_exames_catalogo FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_funcoes ----------
DROP POLICY IF EXISTS aso_funcoes_select ON public.aso_funcoes;
DROP POLICY IF EXISTS aso_funcoes_insert ON public.aso_funcoes;
DROP POLICY IF EXISTS aso_funcoes_update ON public.aso_funcoes;
DROP POLICY IF EXISTS aso_funcoes_delete ON public.aso_funcoes;

CREATE POLICY aso_funcoes_select_v4 ON public.aso_funcoes FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_funcoes_insert_v4 ON public.aso_funcoes FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_funcoes_update_v4 ON public.aso_funcoes FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_funcoes_delete_v4 ON public.aso_funcoes FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_setores ----------
DROP POLICY IF EXISTS aso_setores_select ON public.aso_setores;
DROP POLICY IF EXISTS aso_setores_insert ON public.aso_setores;
DROP POLICY IF EXISTS aso_setores_update ON public.aso_setores;
DROP POLICY IF EXISTS aso_setores_delete ON public.aso_setores;

CREATE POLICY aso_setores_select_v4 ON public.aso_setores FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_setores_insert_v4 ON public.aso_setores FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_setores_update_v4 ON public.aso_setores FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_setores_delete_v4 ON public.aso_setores FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_riscos_funcao ----------
DROP POLICY IF EXISTS aso_riscos_funcao_select ON public.aso_riscos_funcao;
DROP POLICY IF EXISTS aso_riscos_funcao_insert ON public.aso_riscos_funcao;
DROP POLICY IF EXISTS aso_riscos_funcao_update ON public.aso_riscos_funcao;
DROP POLICY IF EXISTS aso_riscos_funcao_delete ON public.aso_riscos_funcao;

CREATE POLICY aso_riscos_funcao_select_v4 ON public.aso_riscos_funcao FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_riscos_funcao_insert_v4 ON public.aso_riscos_funcao FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_riscos_funcao_update_v4 ON public.aso_riscos_funcao FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_riscos_funcao_delete_v4 ON public.aso_riscos_funcao FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_numeracao ----------
DROP POLICY IF EXISTS aso_num_select ON public.aso_numeracao;
DROP POLICY IF EXISTS aso_num_insert ON public.aso_numeracao;
DROP POLICY IF EXISTS aso_num_update ON public.aso_numeracao;

CREATE POLICY aso_num_select_v4 ON public.aso_numeracao FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_num_insert_v4 ON public.aso_numeracao FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_num_update_v4 ON public.aso_numeracao FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- aso_assinaturas ----------
DROP POLICY IF EXISTS aso_assinaturas_select_v3 ON public.aso_assinaturas;
DROP POLICY IF EXISTS aso_assinaturas_insert_v3 ON public.aso_assinaturas;
DROP POLICY IF EXISTS aso_assinaturas_update_v3 ON public.aso_assinaturas;
DROP POLICY IF EXISTS aso_assinaturas_delete_v3 ON public.aso_assinaturas;

CREATE POLICY aso_assinaturas_select_v4 ON public.aso_assinaturas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_assinaturas.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
       AND (
         public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.has_aso_full_access(auth.uid())
         OR (public.has_permission(auth.uid(), 'portal_rh:aso:visualizar') AND a.liberado_portal_rh = true)
       )
  ));
CREATE POLICY aso_assinaturas_insert_v4 ON public.aso_assinaturas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_assinaturas.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
       AND (
         public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.has_aso_full_access(auth.uid())
       )
  ));
CREATE POLICY aso_assinaturas_update_v4 ON public.aso_assinaturas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_assinaturas.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
       AND (
         public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.has_aso_full_access(auth.uid())
       )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_assinaturas.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
       AND (
         public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.has_aso_full_access(auth.uid())
       )
  ));
CREATE POLICY aso_assinaturas_delete_v4 ON public.aso_assinaturas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_assinaturas.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
       AND (
         public.is_super_admin(auth.uid())
         OR public.is_principal(auth.uid())
         OR public.has_aso_full_access(auth.uid())
       )
  ));

-- ---------- aso_verificacao (link público mantido) ----------
DROP POLICY IF EXISTS aso_verif_auth_write ON public.aso_verificacao;

CREATE POLICY aso_verif_auth_write_v4 ON public.aso_verificacao FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.asos a
     WHERE a.id = aso_verificacao.aso_id
       AND public.is_active_empresa(auth.uid(), a.empresa_id)
  ));

-- ---------- aso_download_logs ----------
DROP POLICY IF EXISTS aso_logs_select ON public.aso_download_logs;
DROP POLICY IF EXISTS aso_logs_insert ON public.aso_download_logs;

CREATE POLICY aso_logs_select_v4 ON public.aso_download_logs FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY aso_logs_insert_v4 ON public.aso_download_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- locais_emissao_aso ----------
DROP POLICY IF EXISTS locais_emissao_isolation_select ON public.locais_emissao_aso;
DROP POLICY IF EXISTS locais_emissao_isolation_insert ON public.locais_emissao_aso;
DROP POLICY IF EXISTS locais_emissao_isolation_update ON public.locais_emissao_aso;
DROP POLICY IF EXISTS locais_emissao_isolation_delete ON public.locais_emissao_aso;
DROP POLICY IF EXISTS locais_emissao_rh_select_v3     ON public.locais_emissao_aso;

CREATE POLICY locais_emissao_select_v4 ON public.locais_emissao_aso FOR SELECT TO authenticated
  USING (
    public.is_active_empresa(auth.uid(), empresa_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_principal(auth.uid())
      OR public.has_aso_full_access(auth.uid())
      OR public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
    )
  );
CREATE POLICY locais_emissao_insert_v4 ON public.locais_emissao_aso FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY locais_emissao_update_v4 ON public.locais_emissao_aso FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY locais_emissao_delete_v4 ON public.locais_emissao_aso FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));

-- ---------- medicos ----------
DROP POLICY IF EXISTS "Principal delete medicos company tree" ON public.medicos;
DROP POLICY IF EXISTS "Principal insert medicos company tree" ON public.medicos;
DROP POLICY IF EXISTS "Principal read medicos company tree"   ON public.medicos;
DROP POLICY IF EXISTS "Principal update medicos company tree" ON public.medicos;
DROP POLICY IF EXISTS "Super admin full access medicos"       ON public.medicos;
DROP POLICY IF EXISTS "Tenant delete medicos" ON public.medicos;
DROP POLICY IF EXISTS "Tenant insert medicos" ON public.medicos;
DROP POLICY IF EXISTS "Tenant read medicos"   ON public.medicos;
DROP POLICY IF EXISTS "Tenant update medicos" ON public.medicos;

CREATE POLICY medicos_select_v4 ON public.medicos FOR SELECT TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY medicos_insert_v4 ON public.medicos FOR INSERT TO authenticated
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY medicos_update_v4 ON public.medicos FOR UPDATE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.is_active_empresa(auth.uid(), empresa_id));
CREATE POLICY medicos_delete_v4 ON public.medicos FOR DELETE TO authenticated
  USING (public.is_active_empresa(auth.uid(), empresa_id));
