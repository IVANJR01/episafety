DO $$
BEGIN
  ALTER TABLE public.esocial_s2240_historico DISABLE TRIGGER USER;
  DELETE FROM public.esocial_s2240_historico WHERE evento_id = 'bdec9186-0296-4934-b814-5e14319976ae';
  DELETE FROM public.esocial_eventos_s2240
    WHERE id = 'bdec9186-0296-4934-b814-5e14319976ae'
      AND status = 'homologacao_stub'
      AND ppp_periodo_id IS NULL
      AND xml_sha256 IS NULL;
  ALTER TABLE public.esocial_s2240_historico ENABLE TRIGGER USER;
END $$;