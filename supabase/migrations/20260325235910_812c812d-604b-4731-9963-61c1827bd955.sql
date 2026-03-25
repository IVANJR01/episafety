ALTER POLICY "Contract user read contrato_epis"
ON public.contrato_epis
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios_liberados ul
    WHERE lower(ul.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      AND ul.contrato_id = contrato_epis.contrato_id
      AND ul.ativo = true
  )
);

ALTER POLICY "Contract user read contrato_epis_movimentacoes"
ON public.contrato_epis_movimentacoes
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios_liberados ul
    WHERE lower(ul.email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
      AND ul.contrato_id = contrato_epis_movimentacoes.contrato_id
      AND ul.ativo = true
  )
);