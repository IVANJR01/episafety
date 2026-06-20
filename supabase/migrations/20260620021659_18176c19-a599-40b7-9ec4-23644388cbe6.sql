
CREATE TABLE IF NOT EXISTS public.esocial_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  base text NOT NULL CHECK (base IN ('cid10','municipios_ibge')),
  arquivo_nome text,
  total_linhas integer NOT NULL DEFAULT 0,
  total_inseridos integer NOT NULL DEFAULT 0,
  total_atualizados integer NOT NULL DEFAULT 0,
  total_ignorados integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'concluido',
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.esocial_import_logs TO authenticated;
GRANT ALL ON public.esocial_import_logs TO service_role;
ALTER TABLE public.esocial_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esocial_import_logs_select"
  ON public.esocial_import_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin'::app_role) OR
    public.has_role(auth.uid(),'admin'::app_role) OR
    empresa_id IS NULL OR
    public.is_in_user_company_tree(auth.uid(), empresa_id)
  );

CREATE POLICY "esocial_import_logs_insert"
  ON public.esocial_import_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.esocial_import_cid10(_rows jsonb, _arquivo_nome text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_empresa uuid;
  v_total int := 0; v_ins int := 0; v_upd int := 0; v_skip int := 0; v_err int := 0;
  v_errs jsonb := '[]'::jsonb; v_row jsonb;
  v_codigo text; v_descricao text; v_cap text; v_existing text; v_idx int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'super_admin'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_empresa := public.get_user_empresa_id(v_uid);

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) LOOP
    v_idx := v_idx + 1; v_total := v_total + 1;
    v_codigo := upper(trim(COALESCE(v_row->>'codigo','')));
    v_descricao := trim(COALESCE(v_row->>'descricao',''));
    v_cap := NULLIF(trim(COALESCE(v_row->>'capitulo','')), '');

    IF v_codigo = '' OR v_descricao = '' THEN
      v_err := v_err + 1;
      v_errs := v_errs || jsonb_build_object('linha', v_idx, 'erro', 'codigo/descricao vazios'); CONTINUE;
    END IF;
    IF v_codigo !~ '^[A-Z][0-9]{2}(\.[0-9]{1,2})?$' THEN
      v_err := v_err + 1;
      v_errs := v_errs || jsonb_build_object('linha', v_idx, 'codigo', v_codigo, 'erro', 'formato CID-10 inválido'); CONTINUE;
    END IF;

    SELECT descricao INTO v_existing FROM public.esocial_cid10 WHERE codigo = v_codigo;
    IF v_existing IS NULL THEN
      INSERT INTO public.esocial_cid10(codigo, descricao, capitulo) VALUES (v_codigo, v_descricao, v_cap);
      v_ins := v_ins + 1;
    ELSIF v_existing IS DISTINCT FROM v_descricao THEN
      UPDATE public.esocial_cid10 SET descricao = v_descricao, capitulo = v_cap WHERE codigo = v_codigo;
      v_upd := v_upd + 1;
    ELSE v_skip := v_skip + 1;
    END IF;
  END LOOP;

  INSERT INTO public.esocial_import_logs(empresa_id, base, arquivo_nome, total_linhas, total_inseridos, total_atualizados, total_ignorados, total_erros, erros, user_id, user_email)
  VALUES (v_empresa, 'cid10', _arquivo_nome, v_total, v_ins, v_upd, v_skip, v_err, v_errs, v_uid, v_email);

  RETURN jsonb_build_object('total', v_total, 'inseridos', v_ins, 'atualizados', v_upd, 'ignorados', v_skip, 'erros', v_err, 'detalhes', v_errs);
END;$$;

CREATE OR REPLACE FUNCTION public.esocial_import_municipios(_rows jsonb, _arquivo_nome text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_empresa uuid;
  v_total int := 0; v_ins int := 0; v_upd int := 0; v_skip int := 0; v_err int := 0;
  v_errs jsonb := '[]'::jsonb; v_row jsonb;
  v_codigo text; v_nome text; v_uf text; v_existing record; v_idx int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'super_admin'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: admin required';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_empresa := public.get_user_empresa_id(v_uid);

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(_rows,'[]'::jsonb)) LOOP
    v_idx := v_idx + 1; v_total := v_total + 1;
    v_codigo := regexp_replace(COALESCE(v_row->>'codigo',''), '\D', '', 'g');
    v_nome := trim(COALESCE(v_row->>'nome',''));
    v_uf := upper(trim(COALESCE(v_row->>'uf','')));

    IF length(v_codigo) <> 7 THEN
      v_err := v_err + 1;
      v_errs := v_errs || jsonb_build_object('linha', v_idx, 'codigo', v_codigo, 'erro', 'código IBGE deve ter 7 dígitos'); CONTINUE;
    END IF;
    IF v_nome = '' OR length(v_uf) <> 2 THEN
      v_err := v_err + 1;
      v_errs := v_errs || jsonb_build_object('linha', v_idx, 'codigo', v_codigo, 'erro', 'nome/UF inválidos'); CONTINUE;
    END IF;

    SELECT nome, uf INTO v_existing FROM public.esocial_municipios_ibge WHERE codigo = v_codigo;
    IF v_existing.nome IS NULL THEN
      INSERT INTO public.esocial_municipios_ibge(codigo, nome, uf) VALUES (v_codigo, v_nome, v_uf);
      v_ins := v_ins + 1;
    ELSIF v_existing.nome IS DISTINCT FROM v_nome OR v_existing.uf IS DISTINCT FROM v_uf THEN
      UPDATE public.esocial_municipios_ibge SET nome = v_nome, uf = v_uf WHERE codigo = v_codigo;
      v_upd := v_upd + 1;
    ELSE v_skip := v_skip + 1;
    END IF;
  END LOOP;

  INSERT INTO public.esocial_import_logs(empresa_id, base, arquivo_nome, total_linhas, total_inseridos, total_atualizados, total_ignorados, total_erros, erros, user_id, user_email)
  VALUES (v_empresa, 'municipios_ibge', _arquivo_nome, v_total, v_ins, v_upd, v_skip, v_err, v_errs, v_uid, v_email);

  RETURN jsonb_build_object('total', v_total, 'inseridos', v_ins, 'atualizados', v_upd, 'ignorados', v_skip, 'erros', v_err, 'detalhes', v_errs);
END;$$;

CREATE OR REPLACE FUNCTION public.esocial_production_checklist(_empresa uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cid int; v_mun int;
  v_pend_t13 int; v_pend_t14 int; v_pend_t15 int; v_pend_t16 int;
  v_cfg record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _empresa IS NOT NULL
     AND NOT public.is_in_user_company_tree(auth.uid(), _empresa)
     AND NOT public.has_role(auth.uid(),'super_admin'::app_role)
     AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_cid FROM public.esocial_cid10;
  SELECT count(*) INTO v_mun FROM public.esocial_municipios_ibge;
  SELECT count(*) INTO v_pend_t13 FROM public.cat_partes_atingidas WHERE codigo_esocial IS NULL;
  SELECT count(*) INTO v_pend_t14 FROM public.cat_agentes_causadores WHERE codigo_esocial IS NULL;
  SELECT count(*) INTO v_pend_t15 FROM public.cat_naturezas_lesao WHERE codigo_esocial IS NULL;
  SELECT count(*) INTO v_pend_t16 FROM public.cat_situacoes_geradoras WHERE codigo_esocial IS NULL;
  SELECT * INTO v_cfg FROM public.esocial_config WHERE empresa_id = _empresa LIMIT 1;

  RETURN jsonb_build_object(
    'cid10', jsonb_build_object('total', v_cid, 'completa', v_cid >= 14000),
    'municipios', jsonb_build_object('total', v_mun, 'completa', v_mun >= 5570),
    'mapeamentos', jsonb_build_object(
      't13_pendentes', v_pend_t13, 't14_pendentes', v_pend_t14,
      't15_pendentes', v_pend_t15, 't16_pendentes', v_pend_t16
    ),
    'config', jsonb_build_object(
      'preenchida', v_cfg.id IS NOT NULL,
      'ambiente', v_cfg.tp_amb,
      'nr_insc_ok', v_cfg.nr_insc IS NOT NULL AND length(coalesce(v_cfg.nr_insc,'')) > 0,
      'cert_alias_ok', v_cfg.certificado_alias IS NOT NULL
    ),
    'pendencias_implementacao', jsonb_build_array(
      'certificado ICP-Brasil', 'assinatura XMLDSig', 'cliente SOAP',
      'envio real ao Ambiente Nacional', 'consulta de recibo', 'evento S-3000'
    )
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.esocial_import_cid10(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.esocial_import_municipios(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.esocial_production_checklist(uuid) TO authenticated;
