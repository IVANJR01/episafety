
-- ============= Parte 4 PGR: Plano de Ação =============

-- 1) Campos adicionais em pgr_acoes
ALTER TABLE public.pgr_acoes
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS prazo_original date,
  ADD COLUMN IF NOT EXISTS motivo_prorrogacao text,
  ADD COLUMN IF NOT EXISTS concluida_por uuid,
  ADD COLUMN IF NOT EXISTS what  text,
  ADD COLUMN IF NOT EXISTS why   text,
  ADD COLUMN IF NOT EXISTS where_local text,
  ADD COLUMN IF NOT EXISTS how   text;

COMMENT ON COLUMN public.pgr_acoes.what  IS '5W2H — O que será feito (resumo da ação).';
COMMENT ON COLUMN public.pgr_acoes.why   IS '5W2H — Por que será feito.';
COMMENT ON COLUMN public.pgr_acoes.where_local IS '5W2H — Onde será feito.';
COMMENT ON COLUMN public.pgr_acoes.how   IS '5W2H — Como será feito.';

-- 2) Tabela de evidências (Drive BYOK)
CREATE TABLE IF NOT EXISTS public.pgr_acao_evidencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id         uuid NOT NULL REFERENCES public.pgr_acoes(id) ON DELETE CASCADE,
  pgr_id          uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL REFERENCES public.empresa_config(id),
  nome_arquivo    text NOT NULL,
  mime_type       text,
  tamanho_bytes   bigint,
  drive_file_id   text NOT NULL,
  drive_view_link text,
  drive_path      text,
  descricao       text,
  uploaded_by     uuid,
  uploaded_by_email text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_acao_evidencias TO authenticated;
GRANT ALL ON public.pgr_acao_evidencias TO service_role;
ALTER TABLE public.pgr_acao_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pgr_evid_select_tenant" ON public.pgr_acao_evidencias
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );
CREATE POLICY "pgr_evid_insert_tenant" ON public.pgr_acao_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );
CREATE POLICY "pgr_evid_delete_tenant" ON public.pgr_acao_evidencias
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );
CREATE POLICY "pgr_evid_update_tenant" ON public.pgr_acao_evidencias
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_principal(auth.uid())
    OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

-- 3) Guard: empresa_id herdado da ação
CREATE OR REPLACE FUNCTION public.pgr_evid_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _emp uuid; _pgr uuid;
BEGIN
  SELECT empresa_id, pgr_id INTO _emp, _pgr FROM public.pgr_acoes WHERE id = NEW.acao_id;
  IF _emp IS NULL THEN RAISE EXCEPTION 'Ação inexistente'; END IF;
  NEW.empresa_id := _emp;
  NEW.pgr_id := _pgr;
  IF TG_OP = 'UPDATE' AND (NEW.acao_id <> OLD.acao_id OR NEW.drive_file_id <> OLD.drive_file_id) THEN
    RAISE EXCEPTION 'Não é permitido alterar a vinculação ou o arquivo da evidência (delete e crie nova)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pgr_evid_guard ON public.pgr_acao_evidencias;
CREATE TRIGGER trg_pgr_evid_guard
  BEFORE INSERT OR UPDATE ON public.pgr_acao_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.pgr_evid_guard();

CREATE INDEX IF NOT EXISTS idx_pgr_evid_acao ON public.pgr_acao_evidencias(acao_id);
CREATE INDEX IF NOT EXISTS idx_pgr_evid_empresa ON public.pgr_acao_evidencias(empresa_id);

-- 4) Transição de status com história (concluir/cancelar/prorrogar/iniciar/reabrir)
CREATE OR REPLACE FUNCTION public.pgr_acao_set_status(
  _acao_id           uuid,
  _novo_status       text,             -- pendente|em_andamento|concluida|atrasada|cancelada
  _motivo            text DEFAULT NULL, -- obrigatório p/ cancelar e prorrogar
  _data_conclusao    date DEFAULT NULL, -- obrigatório p/ concluir
  _novo_prazo        date DEFAULT NULL  -- obrigatório p/ prorrogar (sem mudar status)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao   public.pgr_acoes%ROWTYPE;
  v_pgr    public.pgr_documentos%ROWTYPE;
  v_email  text := lower(COALESCE(auth.jwt() ->> 'email',''));
  v_status_ant public.pgr_acao_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_acao FROM public.pgr_acoes WHERE id = _acao_id;
  IF v_acao.id IS NULL THEN RAISE EXCEPTION 'Ação não encontrada'; END IF;

  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = v_acao.pgr_id;
  IF NOT public.is_in_user_company_tree(auth.uid(), v_pgr.empresa_id)
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.is_principal(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR % — abra uma revisão para alterar o Plano de Ação', v_pgr.status;
  END IF;

  v_status_ant := v_acao.status;

  -- Prorrogação (sem trocar status, exige _novo_prazo + _motivo)
  IF _novo_prazo IS NOT NULL THEN
    IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
      RAISE EXCEPTION 'Justificativa obrigatória para prorrogar prazo';
    END IF;
    UPDATE public.pgr_acoes
       SET prazo_original = COALESCE(prazo_original, prazo),
           prazo = _novo_prazo,
           motivo_prorrogacao = _motivo,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;
    INSERT INTO public.pgr_acao_historico(
      acao_id, pgr_id, empresa_id, status_anterior, status_novo,
      campo_alterado, valor_anterior, valor_novo, motivo, user_id, user_email
    ) VALUES (
      _acao_id, v_acao.pgr_id, v_acao.empresa_id, v_status_ant, v_status_ant,
      'prazo', v_acao.prazo::text, _novo_prazo::text, _motivo, auth.uid(), NULLIF(v_email,'')
    );
    RETURN jsonb_build_object('success', true, 'acao', 'prorrogar', 'novo_prazo', _novo_prazo);
  END IF;

  -- Transições de status
  IF _novo_status NOT IN ('pendente','em_andamento','concluida','atrasada','cancelada') THEN
    RAISE EXCEPTION 'Status inválido: %', _novo_status;
  END IF;

  IF _novo_status = 'concluida' THEN
    IF _data_conclusao IS NULL THEN
      RAISE EXCEPTION 'Data de conclusão obrigatória para concluir a ação';
    END IF;
    UPDATE public.pgr_acoes
       SET status = 'concluida'::public.pgr_acao_status,
           data_conclusao = _data_conclusao,
           concluida_por = auth.uid(),
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;

  ELSIF _novo_status = 'cancelada' THEN
    IF _motivo IS NULL OR length(btrim(_motivo)) < 5 THEN
      RAISE EXCEPTION 'Motivo obrigatório para cancelar a ação';
    END IF;
    UPDATE public.pgr_acoes
       SET status = 'cancelada'::public.pgr_acao_status,
           motivo_cancelamento = _motivo,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;

  ELSE
    UPDATE public.pgr_acoes
       SET status = _novo_status::public.pgr_acao_status,
           updated_by = auth.uid(),
           updated_at = now()
     WHERE id = _acao_id;
  END IF;

  INSERT INTO public.pgr_acao_historico(
    acao_id, pgr_id, empresa_id, status_anterior, status_novo,
    campo_alterado, valor_anterior, valor_novo, motivo, user_id, user_email
  ) VALUES (
    _acao_id, v_acao.pgr_id, v_acao.empresa_id, v_status_ant, _novo_status::public.pgr_acao_status,
    'status', v_status_ant::text, _novo_status,
    CASE WHEN _novo_status IN ('cancelada','concluida') THEN _motivo ELSE NULL END,
    auth.uid(), NULLIF(v_email,'')
  );

  RETURN jsonb_build_object('success', true, 'status', _novo_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pgr_acao_set_status(uuid, text, text, date, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pgr_acao_set_status(uuid, text, text, date, date) TO authenticated;

-- 5) Marcar atrasadas (chamável on-demand pela UI)
CREATE OR REPLACE FUNCTION public.pgr_marcar_atrasadas(_pgr_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  WITH upd AS (
    UPDATE public.pgr_acoes a
       SET status = 'atrasada'::public.pgr_acao_status,
           updated_at = now()
     WHERE a.pgr_id = _pgr_id
       AND a.status IN ('pendente','em_andamento')
       AND a.prazo IS NOT NULL
       AND a.prazo < CURRENT_DATE
       AND (public.is_super_admin(auth.uid())
            OR public.is_principal(auth.uid())
            OR public.is_in_user_company_tree(auth.uid(), a.empresa_id))
    RETURNING a.id, a.empresa_id, a.pgr_id
  )
  INSERT INTO public.pgr_acao_historico(
    acao_id, pgr_id, empresa_id, status_anterior, status_novo,
    campo_alterado, motivo, user_id, user_email
  )
  SELECT id, pgr_id, empresa_id, NULL, 'atrasada'::public.pgr_acao_status,
         'status', 'Prazo vencido (auto)', auth.uid(), lower(COALESCE(auth.jwt() ->> 'email',''))
    FROM upd;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN COALESCE(v_n,0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pgr_marcar_atrasadas(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pgr_marcar_atrasadas(uuid) TO authenticated;
