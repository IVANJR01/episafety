
CREATE TABLE public.pgr_textos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pgr_id uuid NOT NULL REFERENCES public.pgr_documentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  secao text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pgr_id, secao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_textos TO authenticated;
GRANT ALL ON public.pgr_textos TO service_role;

ALTER TABLE public.pgr_textos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pgr_textos select" ON public.pgr_textos FOR SELECT TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pgr_textos insert" ON public.pgr_textos FOR INSERT TO authenticated
  WITH CHECK (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pgr_textos update" ON public.pgr_textos FOR UPDATE TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id))
  WITH CHECK (public.is_in_user_company_tree(auth.uid(), empresa_id));
CREATE POLICY "pgr_textos delete" ON public.pgr_textos FOR DELETE TO authenticated
  USING (public.is_in_user_company_tree(auth.uid(), empresa_id));

CREATE TRIGGER trg_pgr_textos_updated
  BEFORE UPDATE ON public.pgr_textos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pgr_textos_pgr_id ON public.pgr_textos(pgr_id);

CREATE OR REPLACE FUNCTION public.pgr_seed_textos(_pgr_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp uuid;
  _secoes text[] := ARRAY[
    'introducao','apresentacao','registro_divulgacao',
    'objetivo_geral','objetivos_especificos',
    'politica_seguranca','resp_empregador','resp_empregados',
    'seguranca_trabalho','cipa','consideracoes_preliminares',
    'area_abrangencia','recomendacoes','consideracoes_finais','encerramento'
  ];
  _s text;
BEGIN
  SELECT empresa_id INTO _emp FROM pgr_documentos WHERE id = _pgr_id;
  IF _emp IS NULL THEN RETURN; END IF;
  FOREACH _s IN ARRAY _secoes LOOP
    INSERT INTO pgr_textos (pgr_id, empresa_id, secao, conteudo)
    VALUES (_pgr_id, _emp, _s, '')
    ON CONFLICT (pgr_id, secao) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pgr_seed_textos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.pgr_seed_textos(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pgr_documentos_seed_textos ON public.pgr_documentos;
CREATE TRIGGER trg_pgr_documentos_seed_textos
  AFTER INSERT ON public.pgr_documentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_pgr_seed_textos();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM pgr_documentos LOOP
    PERFORM public.pgr_seed_textos(r.id);
  END LOOP;
END $$;
