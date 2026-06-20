
ALTER FUNCTION public.pgr_block_mutations() SET search_path = 'public';
ALTER FUNCTION public.pgr_classificar_risco(int, int) SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION public.pgr_abrir_revisao(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pgr_publicar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pgr_abrir_revisao(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pgr_publicar(uuid) TO authenticated, service_role;
