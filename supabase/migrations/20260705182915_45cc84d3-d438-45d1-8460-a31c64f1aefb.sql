
-- Corrige RPC pgr_importar_ghe: substitui chamada errada
-- is_in_user_company_tree(uuid) por is_active_empresa(auth.uid(), empresa_id)

CREATE OR REPLACE FUNCTION public.pgr_importar_ghe(_pgr_id uuid, _dry_run boolean DEFAULT true)
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
BEGIN
  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = _pgr_id;
  IF v_pgr.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  IF NOT public.is_active_empresa(auth.uid(), v_pgr.empresa_id) THEN
    RAISE EXCEPTION 'GES/GHE não pertence à empresa ativa ou você não tem permissão para importá-lo.';
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
    BEGIN
      v_grupo := lower(r.grupo)::public.pgr_perigo_grupo;
    EXCEPTION WHEN others THEN
      v_grupo := 'outro';
    END;

    v_exp := CASE lower(coalesce(r.exposicao,''))
               WHEN 'continua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'contínua' THEN 'continua'::public.pgr_exposicao_tipo
               WHEN 'intermitente' THEN 'intermitente'::public.pgr_exposicao_tipo
               WHEN 'eventual' THEN 'eventual'::public.pgr_exposicao_tipo
               ELSE 'nao_aplicavel'::public.pgr_exposicao_tipo
             END;

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
$function$;


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
  f          record;
  v_dup      boolean;
  v_grupo    public.pgr_perigo_grupo;
  v_aval     public.pgr_avaliacao_tipo := 'qualitativa';
  v_exp      public.pgr_exposicao_tipo;
  v_count    int;
  v_sev      int;
  v_prob     int;
  v_ctrls    text[];
  v_target_funcao_id uuid;
  v_has_funcoes boolean;
  v_processo text;
  v_func_processo text;
  v_setor_nome text;
  v_setor_processo text;
BEGIN
  SELECT * INTO v_pgr FROM public.pgr_documentos WHERE id = _pgr_id;
  IF v_pgr.id IS NULL THEN RAISE EXCEPTION 'PGR não encontrado'; END IF;

  IF NOT public.is_active_empresa(auth.uid(), v_pgr.empresa_id) THEN
    RAISE EXCEPTION 'GES/GHE não pertence à empresa ativa ou você não tem permissão para importá-lo.';
  END IF;

  IF v_pgr.status NOT IN ('rascunho','em_revisao') THEN
    RAISE EXCEPTION 'PGR vigente/substituído não pode receber importação direta. Abra uma revisão primeiro.';
  END IF;

  FOR r IN
    SELECT gr.*,
           g.id  AS ghe_pk,
           g.codigo AS ghe_codigo,
           g.nome   AS ghe_nome,
           g.setor  AS ghe_setor,
           g.severidade   AS ghe_sev,
           g.probabilidade AS ghe_prob,
           g.medidas_controle_existentes AS ghe_mce,
           g.medidas_controle_recomendadas AS ghe_mcr,
           g.epcs AS ghe_epcs,
           g.processo AS ghe_processo
      FROM public.ghe_riscos gr
      JOIN public.ghe_ges g ON g.id = gr.ghe_id
     WHERE g.empresa_id = v_pgr.empresa_id
       AND g.status = 'ativo'
       AND (_ghe_ids IS NULL OR g.id = ANY(_ghe_ids))
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

    SELECT EXISTS(SELECT 1 FROM public.ghe_funcoes WHERE ghe_id = r.ghe_id) INTO v_has_funcoes;

    IF r.funcao_id IS NOT NULL THEN
      v_target_funcao_id := r.funcao_id;

      SELECT NULLIF(trim(COALESCE(descricao_atividade, processo)),''), NULLIF(trim(setor),'')
        INTO v_func_processo, v_setor_nome
        FROM public.ghe_funcoes WHERE id = v_target_funcao_id;

      v_setor_processo := NULL;
      IF v_setor_nome IS NOT NULL THEN
        SELECT NULLIF(trim(processo),'') INTO v_setor_processo
          FROM public.ghe_setores WHERE ghe_id = r.ghe_id AND nome = v_setor_nome LIMIT 1;
      END IF;

      v_processo := COALESCE(v_func_processo, v_setor_processo, NULLIF(trim(r.ghe_processo),''));

      SELECT EXISTS (
        SELECT 1 FROM public.pgr_inventario_itens i
         WHERE i.pgr_id = _pgr_id AND i.ghe_id = r.ghe_id
           AND coalesce(i.funcao_id::text,'') = coalesce(v_target_funcao_id::text,'')
           AND lower(i.perigo_descricao) = lower(coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'))
      ) INTO v_dup;

      IF v_dup THEN
        v_ignorar := v_ignorar + 1;
        v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
          'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), 'acao', 'ignorar');
      ELSE
        v_criar := v_criar + 1;
        v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
          'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
          'grupo', v_grupo, 'fonte_geradora', r.perigo_fonte, 'exposicao', v_exp,
          'severidade', v_sev, 'probabilidade', v_prob, 'acao', 'criar');
        IF NOT _dry_run THEN
          SELECT count(*)::int INTO v_count FROM public.funcionarios WHERE ghe_id = r.ghe_id AND data_demissao IS NULL;
          INSERT INTO public.pgr_inventario_itens(
            pgr_id, empresa_id, ghe_id, funcao_id, perigo_id, grupo, perigo_descricao, fonte_geradora, meio_propagacao,
            tipo_exposicao, trabalhadores_expostos, trabalhadores_calculados, avaliacao_tipo, severidade, probabilidade,
            controles_existentes, processo, created_by
          ) VALUES (
            _pgr_id, v_pgr.empresa_id, r.ghe_id, v_target_funcao_id, NULL,
            v_grupo, coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), r.perigo_fonte, NULL,
            v_exp, COALESCE(v_count,0), COALESCE(v_count,0),
            v_aval, v_sev, v_prob, v_ctrls, v_processo, auth.uid()
          );
        END IF;
      END IF;

    ELSIF v_has_funcoes THEN
      FOR f IN SELECT id, processo, descricao_atividade, setor FROM public.ghe_funcoes WHERE ghe_id = r.ghe_id LOOP
        v_setor_processo := NULL;
        IF f.setor IS NOT NULL THEN
          SELECT NULLIF(trim(processo),'') INTO v_setor_processo
            FROM public.ghe_setores WHERE ghe_id = r.ghe_id AND nome = f.setor LIMIT 1;
        END IF;
        v_processo := COALESCE(
          NULLIF(trim(f.descricao_atividade),''),
          NULLIF(trim(f.processo),''),
          v_setor_processo,
          NULLIF(trim(r.ghe_processo),'')
        );

        SELECT EXISTS (
          SELECT 1 FROM public.pgr_inventario_itens i
           WHERE i.pgr_id = _pgr_id AND i.ghe_id = r.ghe_id
             AND coalesce(i.funcao_id::text,'') = f.id::text
             AND lower(i.perigo_descricao) = lower(coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'))
        ) INTO v_dup;

        IF v_dup THEN
          v_ignorar := v_ignorar + 1;
          v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
            'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), 'acao', 'ignorar');
        ELSE
          v_criar := v_criar + 1;
          v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
            'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
            'grupo', v_grupo, 'fonte_geradora', r.perigo_fonte, 'exposicao', v_exp,
            'severidade', v_sev, 'probabilidade', v_prob, 'acao', 'criar');
          IF NOT _dry_run THEN
            SELECT count(*)::int INTO v_count FROM public.funcionarios WHERE ghe_id = r.ghe_id AND data_demissao IS NULL;
            INSERT INTO public.pgr_inventario_itens(
              pgr_id, empresa_id, ghe_id, funcao_id, perigo_id, grupo, perigo_descricao, fonte_geradora, meio_propagacao,
              tipo_exposicao, trabalhadores_expostos, trabalhadores_calculados, avaliacao_tipo, severidade, probabilidade,
              controles_existentes, processo, created_by
            ) VALUES (
              _pgr_id, v_pgr.empresa_id, r.ghe_id, f.id, NULL,
              v_grupo, coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), r.perigo_fonte, NULL,
              v_exp, COALESCE(v_count,0), COALESCE(v_count,0),
              v_aval, v_sev, v_prob, v_ctrls, v_processo, auth.uid()
            );
          END IF;
        END IF;
      END LOOP;

    ELSE
      v_processo := NULLIF(trim(r.ghe_processo),'');

      SELECT EXISTS (
        SELECT 1 FROM public.pgr_inventario_itens i
         WHERE i.pgr_id = _pgr_id AND i.ghe_id = r.ghe_id AND i.funcao_id IS NULL
           AND lower(i.perigo_descricao) = lower(coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'))
      ) INTO v_dup;

      IF v_dup THEN
        v_ignorar := v_ignorar + 1;
        v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
          'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), 'acao', 'ignorar');
      ELSE
        v_criar := v_criar + 1;
        v_itens := v_itens || jsonb_build_object('ghe_id', r.ghe_id, 'ghe_codigo', r.ghe_codigo, 'ghe_nome', r.ghe_nome,
          'perigo_descricao', coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'),
          'grupo', v_grupo, 'fonte_geradora', r.perigo_fonte, 'exposicao', v_exp,
          'severidade', v_sev, 'probabilidade', v_prob, 'acao', 'criar');
        IF NOT _dry_run THEN
          SELECT count(*)::int INTO v_count FROM public.funcionarios WHERE ghe_id = r.ghe_id AND data_demissao IS NULL;
          INSERT INTO public.pgr_inventario_itens(
            pgr_id, empresa_id, ghe_id, funcao_id, perigo_id, grupo, perigo_descricao, fonte_geradora, meio_propagacao,
            tipo_exposicao, trabalhadores_expostos, trabalhadores_calculados, avaliacao_tipo, severidade, probabilidade,
            controles_existentes, processo, created_by
          ) VALUES (
            _pgr_id, v_pgr.empresa_id, r.ghe_id, NULL, NULL,
            v_grupo, coalesce(r.tipo_agente, r.perigo_fonte, 'Risco'), r.perigo_fonte, NULL,
            v_exp, COALESCE(v_count,0), COALESCE(v_count,0),
            v_aval, v_sev, v_prob, v_ctrls, v_processo, auth.uid()
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('dry_run', _dry_run, 'criar', v_criar, 'ignorar', v_ignorar,
    'total_origem', v_criar + v_ignorar, 'itens', v_itens);
END;
$function$;
