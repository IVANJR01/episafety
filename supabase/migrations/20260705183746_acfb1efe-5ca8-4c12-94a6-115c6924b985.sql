
-- 1) Add snapshot columns for grouped GES common risks
ALTER TABLE public.pgr_inventario_itens
  ADD COLUMN IF NOT EXISTS setor text,
  ADD COLUMN IF NOT EXISTS funcoes_snapshot text[];

-- 2) Rewrite import to group common GES risks (funcao_id IS NULL) by
--    (ghe_id, setor, processo, perigo, fonte, exposicao, sev, prob),
--    creating ONE inventory row that lists all exposed funcoes.
--    Function-specific risks (funcao_id IS NOT NULL) still produce one row per function.

CREATE OR REPLACE FUNCTION public.pgr_importar_ghe(_pgr_id uuid, _dry_run boolean DEFAULT true, _ghe_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_sev      int;
  v_prob     int;
  v_ctrls    text[];
  v_perigo   text;
BEGIN
  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = _pgr_id;
  IF v_pgr.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  IF NOT public.is_active_empresa(auth.uid(), v_pgr.empresa_id) THEN
    RAISE EXCEPTION 'GES/GHE não pertence à empresa ativa ou você não tem permissão para importá-lo.';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR vigente/substituído não pode receber importação direta. Abra uma revisão primeiro.';
  END IF;

  -- Unified grouped query:
  --  * risco COMUM (gr.funcao_id IS NULL):
  --      LEFT JOIN ghe_funcoes por setor para agrupar por (setor, processo)
  --      e listar todas as funcoes daquele setor.
  --  * risco ESPECÍFICO (gr.funcao_id NOT NULL):
  --      1 linha para a função, processo = descricao_atividade/processo da função.
  FOR r IN
    WITH base AS (
      SELECT
        gr.id                 AS risco_id,
        gr.ghe_id,
        gr.funcao_id          AS risco_funcao_id,
        gr.grupo,
        gr.tipo_agente,
        gr.perigo_fonte,
        gr.exposicao,
        g.codigo              AS ghe_codigo,
        g.nome                AS ghe_nome,
        g.setor               AS ghe_setor_default,
        g.severidade          AS ghe_sev,
        g.probabilidade       AS ghe_prob,
        g.medidas_controle_existentes  AS ghe_mce,
        g.medidas_controle_recomendadas AS ghe_mcr,
        g.epcs                AS ghe_epcs,
        g.processo            AS ghe_processo
      FROM public.ghe_riscos gr
      JOIN public.ghe_ges g ON g.id = gr.ghe_id
      WHERE g.empresa_id = v_pgr.empresa_id
        AND g.status = 'ativo'
        AND (_ghe_ids IS NULL OR g.id = ANY(_ghe_ids))
    ),
    -- risco específico da função (1 linha por função)
    especificos AS (
      SELECT
        b.ghe_id, b.ghe_codigo, b.ghe_nome,
        b.grupo, b.tipo_agente, b.perigo_fonte, b.exposicao,
        b.ghe_sev, b.ghe_prob, b.ghe_mce, b.ghe_mcr, b.ghe_epcs,
        b.risco_funcao_id AS funcao_id,
        COALESCE(NULLIF(trim(fn.setor),''), NULLIF(trim(b.ghe_setor_default),'')) AS setor,
        COALESCE(
          NULLIF(trim(fn.descricao_atividade),''),
          NULLIF(trim(fn.processo),''),
          (SELECT NULLIF(trim(s.processo),'')
             FROM public.ghe_setores s
            WHERE s.ghe_id = b.ghe_id AND s.nome = fn.setor
            LIMIT 1),
          NULLIF(trim(b.ghe_processo),'')
        ) AS processo,
        ARRAY[fn.nome]::text[] AS funcoes_snapshot
      FROM base b
      JOIN public.ghe_funcoes fn ON fn.id = b.risco_funcao_id
      WHERE b.risco_funcao_id IS NOT NULL
    ),
    -- risco comum: agrupa por setor + processo (via função) e lista funções
    comuns_expandidos AS (
      SELECT
        b.ghe_id, b.ghe_codigo, b.ghe_nome,
        b.grupo, b.tipo_agente, b.perigo_fonte, b.exposicao,
        b.ghe_sev, b.ghe_prob, b.ghe_mce, b.ghe_mcr, b.ghe_epcs,
        COALESCE(NULLIF(trim(fn.setor),''), NULLIF(trim(b.ghe_setor_default),'')) AS setor,
        COALESCE(
          NULLIF(trim(fn.descricao_atividade),''),
          NULLIF(trim(fn.processo),''),
          (SELECT NULLIF(trim(s.processo),'')
             FROM public.ghe_setores s
            WHERE s.ghe_id = b.ghe_id AND s.nome = fn.setor
            LIMIT 1),
          NULLIF(trim(b.ghe_processo),'')
        ) AS processo,
        fn.nome AS funcao_nome
      FROM base b
      LEFT JOIN public.ghe_funcoes fn ON fn.ghe_id = b.ghe_id
      WHERE b.risco_funcao_id IS NULL
    ),
    comuns AS (
      SELECT
        ghe_id, ghe_codigo, ghe_nome,
        grupo, tipo_agente, perigo_fonte, exposicao,
        ghe_sev, ghe_prob, ghe_mce, ghe_mcr, ghe_epcs,
        NULL::uuid AS funcao_id,
        setor, processo,
        COALESCE(
          array_remove(array_agg(DISTINCT funcao_nome) FILTER (WHERE funcao_nome IS NOT NULL), NULL),
          ARRAY[]::text[]
        ) AS funcoes_snapshot
      FROM comuns_expandidos
      GROUP BY
        ghe_id, ghe_codigo, ghe_nome,
        grupo, tipo_agente, perigo_fonte, exposicao,
        ghe_sev, ghe_prob, ghe_mce, ghe_mcr, ghe_epcs,
        setor, processo
    )
    SELECT * FROM especificos
    UNION ALL
    SELECT * FROM comuns
  LOOP
    BEGIN v_grupo := lower(r.grupo)::public.pgr_perigo_grupo;
    EXCEPTION WHEN others THEN v_grupo := 'outro'; END;

    v_exp := CASE lower(coalesce(r.exposicao,''))
               WHEN 'continua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'contínua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'intermitente' THEN 'intermitente'::public.pgr_exposicao_tipo
               WHEN 'eventual' THEN 'eventual'::public.pgr_exposicao_tipo
               ELSE 'nao_aplicavel'::public.pgr_exposicao_tipo
             END;

    v_sev  := COALESCE(r.ghe_sev, 3);
    v_prob := COALESCE(r.ghe_prob, 3);
    v_perigo := coalesce(r.tipo_agente, r.perigo_fonte, 'Risco');

    v_ctrls := NULL;
    IF r.ghe_mce IS NOT NULL AND length(trim(r.ghe_mce)) > 0 THEN
      v_ctrls := array_append(v_ctrls, 'Medidas existentes: ' || r.ghe_mce);
    END IF;
    IF r.ghe_epcs IS NOT NULL AND length(trim(r.ghe_epcs)) > 0 THEN
      v_ctrls := array_append(v_ctrls, 'EPCs: ' || r.ghe_epcs);
    END IF;
    IF r.ghe_mcr IS NOT NULL AND length(trim(r.ghe_mcr)) > 0 THEN
      v_ctrls := array_append(v_ctrls, 'Recomendadas: ' || r.ghe_mcr);
    END IF;

    -- Deduplicação ampla considerando setor + processo + fonte + sev/prob
    SELECT EXISTS (
      SELECT 1 FROM public.pgr_inventario_itens i
       WHERE i.pgr_id = _pgr_id
         AND i.ghe_id = r.ghe_id
         AND coalesce(i.funcao_id::text,'') = coalesce(r.funcao_id::text,'')
         AND lower(coalesce(i.setor,''))    = lower(coalesce(r.setor,''))
         AND lower(coalesce(i.processo,'')) = lower(coalesce(r.processo,''))
         AND lower(i.perigo_descricao)      = lower(v_perigo)
         AND lower(coalesce(i.fonte_geradora,'')) = lower(coalesce(r.perigo_fonte,''))
         AND i.severidade    = v_sev
         AND i.probabilidade = v_prob
    ) INTO v_dup;

    IF v_dup THEN
      v_ignorar := v_ignorar + 1;
      v_itens := v_itens || jsonb_build_object(
        'ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
        'setor', r.setor, 'processo', r.processo,
        'funcoes_snapshot', to_jsonb(r.funcoes_snapshot),
        'perigo_descricao', v_perigo, 'fonte_geradora', r.perigo_fonte,
        'severidade', v_sev, 'probabilidade', v_prob,
        'acao', 'ignorar'
      );
      CONTINUE;
    END IF;

    v_criar := v_criar + 1;
    v_itens := v_itens || jsonb_build_object(
      'ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
      'setor', r.setor, 'processo', r.processo,
      'funcoes_snapshot', to_jsonb(r.funcoes_snapshot),
      'perigo_descricao', v_perigo,
      'grupo', v_grupo, 'fonte_geradora', r.perigo_fonte, 'exposicao', v_exp,
      'severidade', v_sev, 'probabilidade', v_prob,
      'acao', 'criar'
    );

    IF NOT _dry_run THEN
      IF r.funcao_id IS NOT NULL THEN
        SELECT count(*)::int INTO v_count FROM public.funcionarios
          WHERE ghe_id = r.ghe_id AND funcao_id = r.funcao_id AND data_demissao IS NULL;
      ELSIF array_length(r.funcoes_snapshot,1) > 0 THEN
        SELECT count(*)::int INTO v_count FROM public.funcionarios f
          JOIN public.ghe_funcoes gf ON gf.id = f.funcao_id
         WHERE f.ghe_id = r.ghe_id
           AND gf.nome = ANY(r.funcoes_snapshot)
           AND f.data_demissao IS NULL;
      ELSE
        SELECT count(*)::int INTO v_count FROM public.funcionarios
          WHERE ghe_id = r.ghe_id AND data_demissao IS NULL;
      END IF;

      INSERT INTO public.pgr_inventario_itens(
        pgr_id, empresa_id, ghe_id, funcao_id, perigo_id, grupo, perigo_descricao,
        fonte_geradora, meio_propagacao, tipo_exposicao,
        trabalhadores_expostos, trabalhadores_calculados,
        avaliacao_tipo, severidade, probabilidade,
        controles_existentes, processo, setor, funcoes_snapshot, created_by
      ) VALUES (
        _pgr_id, v_pgr.empresa_id, r.ghe_id, r.funcao_id, NULL,
        v_grupo, v_perigo, r.perigo_fonte, NULL, v_exp,
        COALESCE(v_count,0), COALESCE(v_count,0),
        v_aval, v_sev, v_prob,
        v_ctrls, r.processo, r.setor, r.funcoes_snapshot, auth.uid()
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
$function$;
