-- Part 4: RPC to mark XML technical validation (stub) without storing the XML itself.
CREATE OR REPLACE FUNCTION public.s2240_marcar_validacao_xml(
  _evento_id uuid,
  _xml_sha256 text,
  _resultado esocial_s2240_ocorrencia_resultado,
  _novo_status esocial_s2240_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
BEGIN
  v_emp := public.s2240_assert_tenant(_evento_id);

  UPDATE public.esocial_eventos_s2240
     SET validado_em = now(),
         validado_por = auth.uid(),
         xml_sha256 = COALESCE(_xml_sha256, xml_sha256),
         status = COALESCE(_novo_status, status),
         updated_at = now()
   WHERE id = _evento_id
     AND empresa_id = v_emp;
END;
$$;

REVOKE ALL ON FUNCTION public.s2240_marcar_validacao_xml(uuid, text, esocial_s2240_ocorrencia_resultado, esocial_s2240_status) FROM public;
GRANT EXECUTE ON FUNCTION public.s2240_marcar_validacao_xml(uuid, text, esocial_s2240_ocorrencia_resultado, esocial_s2240_status) TO authenticated;