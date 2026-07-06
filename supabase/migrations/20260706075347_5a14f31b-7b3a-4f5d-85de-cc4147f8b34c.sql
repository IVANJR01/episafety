
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
  v_count    int;
  v_funcoes_norm text;
BEGIN
  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = _pgr_id;
  IF v_pgr.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  IF NOT public.is_active_empresa(auth.uid(), v_pgr.empresa_id) THEN
    RAISE EXCEPTION 'GES/GHE não pertence à empresa ativa ou você não tem permissão para importá-lo.';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR vigente/substituído não pode receber importação direta. Abra uma revisão primeiro.';
  END IF;

  -- Estrutura pura: uma linha por (GES x setor x processo) com as funções agrupadas.
  FOR r IN
    WITH ghes AS (
      SELECT g.id, g.codigo, g.nome, g.setor AS setor_default, g.processo AS processo_default, g.descricao_ambiente
      FROM public.ghe_ges g
      WHERE g.empresa_id = v_pgr.empresa_id
        AND g.status = 'ativo'
        AND (_ghe_ids IS NULL OR g.id = ANY(_ghe_ids))
    ),
    funcoes AS (
      SELECT
        g.id AS ghe_id, g.codigo AS ghe_codigo, g.nome AS ghe_nome, g.descricao_ambiente,
        COALESCE(NULLIF(trim(fn.setor),''), NULLIF(trim(g.setor_default),'')) AS setor,
        COALESCE(
          NULLIF(trim(fn.descricao_atividade),''),
          NULLIF(trim(fn.processo),''),
          (SELECT NULLIF(trim(s.processo),'')
             FROM public.ghe_setores s
            WHERE s.ghe_id = g.id AND s.nome = fn.setor
            LIMIT 1),
          NULLIF(trim(g.processo_default),'')
        ) AS processo,
        fn.nome_funcao
      FROM ghes g
      LEFT JOIN public.ghe_funcoes fn ON fn.ghe_id = g.id
    )
    SELECT
      ghe_id, ghe_codigo, ghe_nome, descricao_ambiente,
      setor, processo,
      COALESCE(
        array_remove(array_agg(DISTINCT nome_funcao) FILTER (WHERE nome_funcao IS NOT NULL), NULL),
        ARRAY[]::text[]
      ) AS funcoes_snapshot
    FROM funcoes
    GROUP BY ghe_id, ghe_codigo, ghe_nome, descricao_ambiente, setor, processo
  LOOP
    v_funcoes_norm := lower(array_to_string(COALESCE(r.funcoes_snapshot, ARRAY[]::text[]), '|'));

    SELECT EXISTS (
      SELECT 1 FROM public.pgr_inventario_itens i
       WHERE i.pgr_id = _pgr_id
         AND i.ghe_id = r.ghe_id
         AND lower(coalesce(i.setor,''))    = lower(coalesce(r.setor,''))
         AND lower(coalesce(i.processo,'')) = lower(coalesce(r.processo,''))
         AND lower(array_to_string(COALESCE(i.funcoes_snapshot, ARRAY[]::text[]), '|')) = v_funcoes_norm
    ) INTO v_dup;

    IF v_dup THEN
      v_ignorar := v_ignorar + 1;
      v_itens := v_itens || jsonb_build_object(
        'ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
        'descricao_ambiente', r.descricao_ambiente,
        'setor', r.setor, 'processo', r.processo,
        'funcoes_snapshot', to_jsonb(r.funcoes_snapshot),
        'acao', 'ignorar'
      );
      CONTINUE;
    END IF;

    v_criar := v_criar + 1;
    v_itens := v_itens || jsonb_build_object(
      'ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
      'descricao_ambiente', r.descricao_ambiente,
      'setor', r.setor, 'processo', r.processo,
      'funcoes_snapshot', to_jsonb(r.funcoes_snapshot),
      'acao', 'criar'
    );

    IF NOT _dry_run THEN
      -- contar trabalhadores expostos com base nos cargos das funções agrupadas
      IF array_length(r.funcoes_snapshot, 1) > 0 THEN
        SELECT count(*)::int INTO v_count FROM public.funcionarios f
         WHERE f.ghe_id = r.ghe_id
           AND lower(trim(coalesce(f.cargo,''))) = ANY (
             SELECT lower(trim(x)) FROM unnest(r.funcoes_snapshot) AS x
           )
           AND f.data_demissao IS NULL;
      ELSE
        SELECT count(*)::int INTO v_count FROM public.funcionarios f
          WHERE f.ghe_id = r.ghe_id AND f.data_demissao IS NULL;
      END IF;

      -- Insere apenas a estrutura. Campos de risco ficam pendentes.
      INSERT INTO public.pgr_inventario_itens(
        pgr_id, empresa_id, ghe_id, funcao_id, perigo_id,
        grupo, perigo_descricao,
        fonte_geradora, meio_propagacao, tipo_exposicao,
        trabalhadores_expostos, trabalhadores_calculados,
        avaliacao_tipo, severidade, probabilidade,
        classificacao, controles_existentes,
        processo, setor, funcoes_snapshot, descricao_ambiente,
        created_by
      ) VALUES (
        _pgr_id, v_pgr.empresa_id, r.ghe_id, NULL, NULL,
        'outro'::public.pgr_perigo_grupo, 'Pendente de risco',
        NULL, NULL, 'nao_aplicavel'::public.pgr_exposicao_tipo,
        COALESCE(v_count,0), COALESCE(v_count,0),
        'qualitativa'::public.pgr_avaliacao_tipo, 1, 1,
        NULL, NULL,
        r.processo, r.setor, r.funcoes_snapshot, r.descricao_ambiente,
        auth.uid()
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
