
-- ============================================================
-- LTCAT — Parte 3: Agentes e Avaliações
-- ============================================================

-- 1) Campos extras em GHE/agentes/avaliações
ALTER TABLE public.ltcat_grupos_homogeneos
  ADD COLUMN IF NOT EXISTS descricao_atividade text,
  ADD COLUMN IF NOT EXISTS numero_trabalhadores integer NOT NULL DEFAULT 0;

ALTER TABLE public.ltcat_agentes
  ADD COLUMN IF NOT EXISTS trajetoria text,
  ADD COLUMN IF NOT EXISTS tipo_exposicao text,
  ADD COLUMN IF NOT EXISTS frequencia text,
  ADD COLUMN IF NOT EXISTS duracao text,
  ADD COLUMN IF NOT EXISTS epi_descricao text,
  ADD COLUMN IF NOT EXISTS epi_eficacia text,
  ADD COLUMN IF NOT EXISTS epi_ca text,
  ADD COLUMN IF NOT EXISTS epc_descricao text,
  ADD COLUMN IF NOT EXISTS epc_eficacia text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ltcat_ag_epi_eficacia_chk') THEN
    ALTER TABLE public.ltcat_agentes
      ADD CONSTRAINT ltcat_ag_epi_eficacia_chk
      CHECK (epi_eficacia IS NULL OR epi_eficacia IN ('sim','nao','parcial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ltcat_ag_epc_eficacia_chk') THEN
    ALTER TABLE public.ltcat_agentes
      ADD CONSTRAINT ltcat_ag_epc_eficacia_chk
      CHECK (epc_eficacia IS NULL OR epc_eficacia IN ('sim','nao','parcial'));
  END IF;
END$$;

ALTER TABLE public.ltcat_avaliacoes
  ADD COLUMN IF NOT EXISTS pgr_id uuid REFERENCES public.pgr_documentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_medicao date,
  ADD COLUMN IF NOT EXISTS tempo_medicao_minutos numeric(8,2),
  ADD COLUMN IF NOT EXISTS responsavel_medicao text,
  ADD COLUMN IF NOT EXISTS instrumento_calibracao_validade date,
  ADD COLUMN IF NOT EXISTS certificado_calibracao_drive_id text,
  ADD COLUMN IF NOT EXISTS certificado_calibracao_link text,
  ADD COLUMN IF NOT EXISTS justificativa_qualitativa text,
  ADD COLUMN IF NOT EXISTS norma_referencia text;

-- 2) Dedupe da importação assistida do PGR
CREATE UNIQUE INDEX IF NOT EXISTS ltcat_aval_dedupe_pgr
  ON public.ltcat_avaliacoes(ltcat_id, pgr_id, agente_id, tecnica, COALESCE(data_medicao, '1900-01-01'::date))
  WHERE pgr_id IS NOT NULL;

-- 3) Bloqueio de edição quando LTCAT está imutável
CREATE OR REPLACE FUNCTION public.ltcat_block_when_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st public.ltcat_status; _id uuid;
BEGIN
  _id := COALESCE(NEW.ltcat_id, OLD.ltcat_id);
  IF _id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO _st FROM public.ltcat_documentos WHERE id = _id;
  IF _st IN ('vigente','substituido','arquivado') THEN
    RAISE EXCEPTION 'LTCAT em status % não permite edição direta. Abra uma revisão.', _st;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;
REVOKE EXECUTE ON FUNCTION public.ltcat_block_when_imutavel() FROM PUBLIC, anon;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ltcat_grupos_homogeneos','ltcat_funcoes','ltcat_agentes',
    'ltcat_avaliacoes','ltcat_anexos','ltcat_setores_avaliados',
    'ltcat_responsaveis_tecnicos'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_block_imut ON public.%s', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_block_imut BEFORE INSERT OR UPDATE OR DELETE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.ltcat_block_when_imutavel()',
      t, t
    );
  END LOOP;
END$$;

-- 4) Audit nas tabelas-filhas que ainda não têm
DROP TRIGGER IF EXISTS trg_ltcat_ghe_audit ON public.ltcat_grupos_homogeneos;
CREATE TRIGGER trg_ltcat_ghe_audit AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_grupos_homogeneos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();

DROP TRIGGER IF EXISTS trg_ltcat_func_audit ON public.ltcat_funcoes;
CREATE TRIGGER trg_ltcat_func_audit AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();

DROP TRIGGER IF EXISTS trg_ltcat_ag_audit ON public.ltcat_agentes;
CREATE TRIGGER trg_ltcat_ag_audit AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_agentes
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();

DROP TRIGGER IF EXISTS trg_ltcat_anx_audit ON public.ltcat_anexos;
CREATE TRIGGER trg_ltcat_anx_audit AFTER INSERT OR UPDATE OR DELETE ON public.ltcat_anexos
  FOR EACH ROW EXECUTE FUNCTION public.ltcat_audit_trg();

-- 5) RPC: importação assistida das avaliações quantitativas do PGR
CREATE OR REPLACE FUNCTION public.ltcat_importar_avaliacoes_pgr(
  _ltcat_id uuid,
  _pgr_id uuid,
  _item_ids uuid[] DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.ltcat_documentos%ROWTYPE;
  _has_perm boolean := false;
  _item record;
  _ghe_id uuid;
  _agente_id uuid;
  _cat_id uuid;
  _cat_codigo text;
  _criadas int := 0;
  _ignoradas int := 0;
  _sem_agente int := 0;
  _sem_ghe int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO _doc FROM public.ltcat_documentos WHERE id = _ltcat_id;
  IF _doc.id IS NULL THEN RAISE EXCEPTION 'LTCAT não encontrado'; END IF;
  IF _doc.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'LTCAT em status % não permite importação. Abra uma revisão.', _doc.status;
  END IF;

  _has_perm := public.is_super_admin(auth.uid())
            OR public.is_principal(auth.uid())
            OR public.is_in_user_company_tree(auth.uid(), _doc.empresa_id);
  IF NOT _has_perm THEN RAISE EXCEPTION 'Sem permissão para esta empresa'; END IF;

  PERFORM 1 FROM public.pgr_documentos
   WHERE id = _pgr_id AND empresa_id = _doc.empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PGR de outra empresa ou inexistente'; END IF;

  FOR _item IN
    SELECT i.*, p.nome AS perigo_nome
      FROM public.pgr_inventario_itens i
      LEFT JOIN public.pgr_perigos_catalogo p ON p.id = i.perigo_id
     WHERE i.pgr_id = _pgr_id
       AND i.empresa_id = _doc.empresa_id
       AND i.avaliacao_tipo = 'quantitativa'
       AND (_item_ids IS NULL OR i.id = ANY(_item_ids))
  LOOP
    IF _item.ghe_id IS NULL THEN _sem_ghe := _sem_ghe + 1; CONTINUE; END IF;

    -- snapshot/lookup do GHE no LTCAT
    SELECT id INTO _ghe_id FROM public.ltcat_grupos_homogeneos
     WHERE ltcat_id = _ltcat_id AND ghe_origem_id = _item.ghe_id LIMIT 1;
    IF _ghe_id IS NULL THEN
      INSERT INTO public.ltcat_grupos_homogeneos(
        ltcat_id, empresa_id, ghe_origem_id, codigo, nome, descricao, setor_nome,
        numero_trabalhadores, created_by
      )
      SELECT _ltcat_id, _doc.empresa_id, g.id, g.codigo, g.nome, g.descricao, g.setor,
             COALESCE(_item.trabalhadores_expostos,0), auth.uid()
        FROM public.ghe_ges g WHERE g.id = _item.ghe_id
      RETURNING id INTO _ghe_id;
    END IF;

    -- resolução do agente via catálogo (global ou da empresa)
    _cat_id := NULL; _cat_codigo := NULL;
    SELECT id, codigo_esocial INTO _cat_id, _cat_codigo
      FROM public.ltcat_catalogo_agentes
     WHERE ativo = true
       AND (empresa_id IS NULL OR empresa_id = _doc.empresa_id)
       AND lower(nome) = lower(COALESCE(_item.perigo_nome, _item.perigo_descricao))
     ORDER BY (empresa_id IS NULL)
     LIMIT 1;

    IF _cat_id IS NULL THEN _sem_agente := _sem_agente + 1; CONTINUE; END IF;

    SELECT id INTO _agente_id FROM public.ltcat_agentes
     WHERE grupo_homogeneo_id = _ghe_id AND codigo_esocial = _cat_codigo LIMIT 1;
    IF _agente_id IS NULL THEN
      INSERT INTO public.ltcat_agentes(
        ltcat_id, empresa_id, grupo_homogeneo_id, catalogo_id, codigo_esocial, nome,
        grupo, fonte_geradora, meio_propagacao, created_by
      )
      SELECT _ltcat_id, _doc.empresa_id, _ghe_id, _cat_id, c.codigo_esocial, c.nome,
             c.grupo, _item.fonte_geradora, _item.meio_propagacao, auth.uid()
        FROM public.ltcat_catalogo_agentes c WHERE c.id = _cat_id
      RETURNING id INTO _agente_id;
    END IF;

    BEGIN
      INSERT INTO public.ltcat_avaliacoes(
        ltcat_id, empresa_id, agente_id, grupo_homogeneo_id, tecnica,
        metodologia, intensidade, unidade_medida,
        limite_tolerancia, base_normativa_limite,
        origem_pgr_item_id, pgr_id, observacoes, created_by
      ) VALUES (
        _ltcat_id, _doc.empresa_id, _agente_id, _ghe_id,
        'quantitativa'::public.ltcat_tecnica_avaliacao,
        'Importado do PGR (revisão técnica recomendada)',
        _item.medicao_valor, _item.medicao_unidade,
        NULLIF(regexp_replace(COALESCE(_item.limite_tolerancia,''),'[^0-9.]','','g'),'')::numeric,
        _item.limite_tolerancia, _item.id, _pgr_id,
        'Importado automaticamente do PGR', auth.uid()
      );
      _criadas := _criadas + 1;
    EXCEPTION WHEN unique_violation THEN
      _ignoradas := _ignoradas + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'criadas', _criadas,
    'ignoradas', _ignoradas,
    'sem_agente_no_catalogo', _sem_agente,
    'sem_ghe', _sem_ghe
  );
END;$$;

REVOKE EXECUTE ON FUNCTION public.ltcat_importar_avaliacoes_pgr(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ltcat_importar_avaliacoes_pgr(uuid, uuid, uuid[]) TO authenticated;
