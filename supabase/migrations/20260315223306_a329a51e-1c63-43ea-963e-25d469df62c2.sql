CREATE OR REPLACE FUNCTION public.get_consolidated_epi_stock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  _user_empresa_id uuid;
BEGIN
  -- Allow super_admin OR principal users
  IF NOT is_super_admin(auth.uid()) THEN
    -- Check if user is principal
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      RETURN '[]'::jsonb;
    END IF;
    -- Principal user: only show their own company
    _user_empresa_id := get_user_empresa_id(auth.uid());
  END IF;

  SELECT jsonb_agg(parent_row)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'empresa_id', parent.id,
      'empresa_nome', parent.nome,
      'filiais', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'empresa_id', filial.id,
          'empresa_nome', filial.nome,
          'total_itens', COALESCE(es.total_itens, 0),
          'estoque_total', COALESCE(es.estoque_total, 0),
          'valor_total', COALESCE(es.valor_total, 0),
          'itens_baixo_estoque', COALESCE(es.itens_baixo_estoque, 0),
          'consumo_medio_mensal', COALESCE(cs.media_mensal, 0),
          'custo_medio_mensal', COALESCE(cs.custo_medio_mensal, 0)
        ) ORDER BY filial.nome)
        FROM empresa_config filial
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) as total_itens,
            COALESCE(SUM(e.estoque), 0) as estoque_total,
            COALESCE(SUM(e.estoque * COALESCE(e.valor, 0)), 0) as valor_total,
            COUNT(*) FILTER (WHERE e.estoque <= e.estoque_minimo) as itens_baixo_estoque
          FROM epis e WHERE e.empresa_id = filial.id
        ) es ON true
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(ROUND(COUNT(*)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 1), 0) as media_mensal,
            COALESCE(ROUND(SUM(COALESCE(ep.valor, 0) * ent.quantidade)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 2), 0) as custo_medio_mensal
          FROM entregas ent
          JOIN epis ep ON ep.id = ent.epi_id
          WHERE ent.empresa_id = filial.id
            AND ent.tipo IN ('entrega', 'substituicao')
            AND ent.data >= (CURRENT_DATE - interval '12 months')
        ) cs ON true
        WHERE filial.empresa_pai_id = parent.id
      ), '[]'::jsonb)
    ) as parent_row
    FROM empresa_config parent
    WHERE parent.empresa_pai_id IS NULL
      AND (_user_empresa_id IS NULL OR parent.id = _user_empresa_id)
    ORDER BY parent.nome
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;