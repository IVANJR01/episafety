ALTER TABLE public.extintores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extintor_inspecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extintor_manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extintores_cadastros_apoio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS extintores_select ON public.extintores;
DROP POLICY IF EXISTS extintores_anon_select ON public.extintores;
DROP POLICY IF EXISTS extintores_insert ON public.extintores;
DROP POLICY IF EXISTS extintores_update ON public.extintores;
DROP POLICY IF EXISTS extintores_delete ON public.extintores;
DROP POLICY IF EXISTS extintores_all_auth ON public.extintores;
DROP POLICY IF EXISTS extintores_anon_read ON public.extintores;

CREATE POLICY extintores_all_auth ON public.extintores
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY extintores_anon_read ON public.extintores
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS ext_inspecoes_select ON public.extintor_inspecoes;
DROP POLICY IF EXISTS ext_inspecoes_insert ON public.extintor_inspecoes;
DROP POLICY IF EXISTS ext_inspecoes_update ON public.extintor_inspecoes;
DROP POLICY IF EXISTS ext_inspecoes_delete ON public.extintor_inspecoes;
DROP POLICY IF EXISTS ext_inspecoes_all_auth ON public.extintor_inspecoes;

CREATE POLICY ext_inspecoes_all_auth ON public.extintor_inspecoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ext_manutencoes_select ON public.extintor_manutencoes;
DROP POLICY IF EXISTS ext_manutencoes_insert ON public.extintor_manutencoes;
DROP POLICY IF EXISTS ext_manutencoes_update ON public.extintor_manutencoes;
DROP POLICY IF EXISTS ext_manutencoes_delete ON public.extintor_manutencoes;
DROP POLICY IF EXISTS ext_manutencoes_all_auth ON public.extintor_manutencoes;

CREATE POLICY ext_manutencoes_all_auth ON public.extintor_manutencoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS ext_apoio_select ON public.extintores_cadastros_apoio;
DROP POLICY IF EXISTS ext_apoio_insert ON public.extintores_cadastros_apoio;
DROP POLICY IF EXISTS ext_apoio_update ON public.extintores_cadastros_apoio;
DROP POLICY IF EXISTS ext_apoio_delete ON public.extintores_cadastros_apoio;
DROP POLICY IF EXISTS ext_apoio_all_auth ON public.extintores_cadastros_apoio;

CREATE POLICY ext_apoio_all_auth ON public.extintores_cadastros_apoio
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
