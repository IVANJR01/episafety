
-- ============= Parte 3 PGR: Inventário — colunas auxiliares + RPCs =============

-- 1) Colunas auxiliares em pgr_inventario_itens
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS trabalhadores_calculados int,
  ADD COLUMN IF NOT EXISTS trabalhadores_ajuste_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pgr_inventario_itens.trabalhadores_calculados IS
  'Quantidade calculada a partir de funcionarios.ghe_id no momento do cadastro/importação.';
COMMENT ON COLUMN public.pgr_inventario_itens.trabalhadores_ajuste_manual IS
  'Indica que o técnico ajustou manualmente trabalhadores_expostos; nesse caso "justificativa" é obrigatória.';

-- Guard: se ajuste manual, justificativa é obrigatória
CREATE OR REPLACE FUNCTION public.pgr_inv_justificativa_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trabalhadores_ajuste_manual = true
     AND (NEW.justificativa IS NULL OR length(btrim(NEW.justificativa)) < 5) THEN
    RAISE EXCEPTION 'Justificativa obrigatória (>=5 caracteres) quando há ajuste manual de trabalhadores expostos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pgr_inv_justificativa ON public.pgr_inventario_itens;
CREATE TRIGGER trg_pgr_inv_justificativa
  BEFORE INSERT OR UPDATE ON public.pgr_inventario_itens
  FOR EACH ROW EXECUTE FUNCTION public.pgr_inv_justificativa_guard();

-- 2) RPC: contagem de funcionários por GHE (respeita tenant)
CREATE OR REPLACE FUNCTION public.pgr_funcionarios_por_ghe(_ghe_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_total   int;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.ghe_ges WHERE id = _ghe_id;
  IF v_empresa IS NULL THEN RETURN 0; END IF;
  IF NOT public.is_in_user_company_tree(v_empresa)
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.is_principal(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT count(*)::int INTO v_total
    FROM public.funcionarios
   WHERE ghe_id = _ghe_id
     AND data_demissao IS NULL;
  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pgr_funcionarios_por_ghe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_funcionarios_por_ghe(uuid) TO authenticated;

-- 3) RPC: importar GHE/GES no inventário (com dry_run para preview)
--    Dedup lógica: (pgr_id, ghe_id, lower(perigo_descricao), lower(coalesce(fonte_geradora,'')), avaliacao_tipo)
CREATE OR REPLACE FUNCTION public.pgr_importar_ghe(_pgr_id uuid, _dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pgr      public.pgr_documentos%ROWTYPE;
  v_criar    int := 0;
  v_ignorar  int := 0;
  v_itens    jsonb := '[]'::jsonb;
  r          record;
  v_dup      boolean;
  v_grupo    public.pgr_perigo_grupo;
  v_aval     public.pgr_avaliacao_tipo := 'qualitativa';
  v_exp      public.pgr_exposicao_tipo;
  v_count    int;
BEGIN
  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = _pgr_id;
  IF v_pgr.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  IF NOT public.is_in_user_company_tree(v_pgr.empresa_id)
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.is_principal(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR vigente/substituído não pode receber importação direta. Abra uma revisão primeiro.';
  END IF;

  FOR r IN
    SELECT gr.*, g.id AS ghe_pk
      FROM public.ghe_riscos gr
      JOIN public.ghe_ges g ON g.id = gr.ghe_id
     WHERE g.empresa_id = v_pgr.empresa_id
       AND g.status = 'ativo'
  LOOP
    -- mapear grupo do ghe_riscos.grupo (texto) -> enum
    BEGIN
      v_grupo := lower(r.grupo)::public.pgr_perigo_grupo;
    EXCEPTION WHEN others THEN
      v_grupo := 'outro';
    END;

    -- mapear exposição
    v_exp := CASE lower(coalesce(r.exposicao,''))
               WHEN 'continua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'contínua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'intermitente' THEN 'intermitente'::public.pgr_exposicao_tipo
               WHEN 'eventual' THEN 'eventual'::public.pgr_exposicao_tipo
               ELSE 'nao_aplicavel'::public.pgr_exposicao_tipo
             END;

    -- dedup
    SELECT EXISTS (
      SELECT 1 FROM public.pgr_inventario_itens i
       WHERE i.pgr_id = _pgr_id
         AND i.ghe_id = r.ghe_id
         AND lower(i.perigo_descricao) = lower(coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'))
         AND lower(coalesce(i.fonte_geradora,'')) = lower(coalesce(r.perigo_fonte,''))
         AND i.avaliacao_tipo = v_aval
    ) INTO v_dup;

    IF v_dup THEN
      v_ignorar := v_ignorar + 1;
      v_itens := v_itens || jsonb_build_object(
        'ghe_id', r.ghe_id, 'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
        'acao', 'ignorar'
      );
      CONTINUE;
    END IF;

    v_criar := v_criar + 1;
    v_itens := v_itens || jsonb_build_object(
      'ghe_id', r.ghe_id, 'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
      'grupo', v_grupo, 'fonte_geradora', r.perigo_fonte, 'exposicao', v_exp,
      'acao', 'criar'
    );

    IF NOT _dry_run THEN
      SELECT count(*)::int INTO v_count FROM public.funcionarios
        WHERE ghe_id = r.ghe_id AND data_demissao IS NULL;

      INSERT INTO public.pgr_inventario_itens(
        pgr_id, empresa_id, ghe_id, perigo_id,
        grupo, perigo_descricao, fonte_geradora, meio_propagacao,
        tipo_exposicao, trabalhadores_expostos, trabalhadores_calculados,
        avaliacao_tipo, severidade, probabilidade,
        controles_existentes, created_by
      ) VALUES (
        _pgr_id, v_pgr.empresa_id, r.ghe_id, NULL,
        v_grupo, coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
        r.perigo_fonte, NULL,
        v_exp, COALESCE(v_count,0), COALESCE(v_count,0),
        v_aval, 3, 3,
        NULL, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', _dry_run,
    'criar',   v_criar,
    'ignorar', v_ignorar,
    'total_origem', v_criar + v_ignorar,
    'itens', v_itens
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pgr_importar_ghe(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_importar_ghe(uuid, boolean) TO authenticated;
