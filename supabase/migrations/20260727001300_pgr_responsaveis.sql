-- ============================================================================
-- FASE 1.4 — Responsáveis do PGR (elaborador, revisor, aprovador, RT)
-- ============================================================================
-- Hoje o PGR tem UM responsável técnico, em duas colunas de texto solto
-- (resp_tec_nome / resp_tec_registro). A NR-01 1.5.7.3.2 exige documentos
-- datados e assinados, e o fluxo de aprovação precisa distinguir quem elaborou,
-- quem revisou tecnicamente e quem aprovou pela organização.
--
-- Modelo espelhado de public.ltcat_responsaveis_tecnicos, que já resolve o mesmo
-- problema no LTCAT — mesma forma, mesmas políticas de RLS, mesma UI reaproveitável.
--
-- As colunas antigas são MANTIDAS como fallback de leitura e continuam populadas
-- pelo RT de ordem 1, para não quebrar telas e PDFs existentes.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.pgr_responsavel_papel AS ENUM (
    'elaborador',      -- profissional SST que elaborou o programa
    'responsavel_tecnico',
    'revisor_tecnico',
    'aprovador',       -- representante legal / responsável pela organização
    'responsavel_organizacao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pgr_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  papel public.pgr_responsavel_papel NOT NULL DEFAULT 'responsavel_tecnico',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf text,
  profissao text,
  registro_profissional text,
  uf_registro text,
  numero_art text,
  email text,
  telefone text,
  ordem smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.pgr_responsaveis IS
  'Responsáveis vinculados a um PGR. Substitui resp_tec_nome/resp_tec_registro, que passam a ser fallback do responsável de ordem 1.';
COMMENT ON COLUMN public.pgr_responsaveis.ordem IS
  'Ordem de exibição na tabela de habilitação técnica e no bloco de assinaturas.';

CREATE INDEX IF NOT EXISTS pgr_resp_pgr_idx
  ON public.pgr_responsaveis (pgr_id, papel, ordem);
CREATE INDEX IF NOT EXISTS pgr_resp_empresa_idx
  ON public.pgr_responsaveis (empresa_id);

-- empresa_id é derivado do PGR, nunca informado pelo cliente: reaproveita o
-- guard já usado pelas demais tabelas-filhas do módulo.
DROP TRIGGER IF EXISTS trg_pgr_resp_child_guard ON public.pgr_responsaveis;
CREATE TRIGGER trg_pgr_resp_child_guard
  BEFORE INSERT OR UPDATE ON public.pgr_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.pgr_child_guard();

DROP TRIGGER IF EXISTS trg_pgr_resp_updated_at ON public.pgr_responsaveis;
CREATE TRIGGER trg_pgr_resp_updated_at
  BEFORE UPDATE ON public.pgr_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_responsaveis TO authenticated;
GRANT ALL ON public.pgr_responsaveis TO service_role;
ALTER TABLE public.pgr_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgr_resp_select ON public.pgr_responsaveis;
CREATE POLICY pgr_resp_select ON public.pgr_responsaveis FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_resp_insert ON public.pgr_responsaveis;
CREATE POLICY pgr_resp_insert ON public.pgr_responsaveis FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_resp_update ON public.pgr_responsaveis;
CREATE POLICY pgr_resp_update ON public.pgr_responsaveis FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

DROP POLICY IF EXISTS pgr_resp_delete ON public.pgr_responsaveis;
CREATE POLICY pgr_resp_delete ON public.pgr_responsaveis FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_principal(auth.uid())
         OR public.is_in_user_company_tree(auth.uid(), empresa_id));

-- Migração dos responsáveis técnicos já cadastrados em texto solto.
INSERT INTO public.pgr_responsaveis (pgr_id, empresa_id, papel, nome, registro_profissional, ordem)
SELECT d.id, d.empresa_id, 'responsavel_tecnico', btrim(d.resp_tec_nome),
       NULLIF(btrim(COALESCE(d.resp_tec_registro,'')), ''), 1
  FROM public.pgr_documentos d
 WHERE COALESCE(btrim(d.resp_tec_nome), '') <> ''
   AND NOT EXISTS (
     SELECT 1 FROM public.pgr_responsaveis r
      WHERE r.pgr_id = d.id AND r.papel = 'responsavel_tecnico'
   );

COMMENT ON COLUMN public.pgr_documentos.resp_tec_nome IS
  'LEGADO/fallback: espelha o responsável técnico de ordem 1 em pgr_responsaveis. Não editar diretamente.';
COMMENT ON COLUMN public.pgr_documentos.resp_tec_registro IS
  'LEGADO/fallback: espelha o registro do responsável técnico de ordem 1 em pgr_responsaveis. Não editar diretamente.';
