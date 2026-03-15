
CREATE OR REPLACE FUNCTION public.get_consolidated_epi_stock()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only super_admins can see consolidated data
  IF NOT is_super_admin(auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      ec.id as empresa_id,
      ec.nome as empresa_nome,
      COALESCE(epi_stats.total_itens, 0) as total_itens,
      COALESCE(epi_stats.estoque_total, 0) as estoque_total,
      COALESCE(epi_stats.valor_total, 0) as valor_total,
      COALESCE(epi_stats.itens_baixo_estoque, 0) as itens_baixo_estoque,
      COALESCE(consumo.media_mensal, 0) as consumo_medio_mensal,
      COALESCE(consumo.custo_medio_mensal, 0) as custo_medio_mensal
    FROM empresa_config ec
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total_itens,
        COALESCE(SUM(e.estoque), 0) as estoque_total,
        COALESCE(SUM(e.estoque * COALESCE(e.valor, 0)), 0) as valor_total,
        COUNT(*) FILTER (WHERE e.estoque <= e.estoque_minimo) as itens_baixo_estoque
      FROM epis e
      WHERE e.empresa_id = ec.id
    ) epi_stats ON true
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(ROUND(COUNT(*)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 1), 0) as media_mensal,
        COALESCE(ROUND(SUM(COALESCE(ep.valor, 0) * ent.quantidade)::numeric / GREATEST(1, EXTRACT(MONTH FROM AGE(now(), MIN(ent.data::timestamp)))), 2), 0) as custo_medio_mensal
      FROM entregas ent
      JOIN epis ep ON ep.id = ent.epi_id
      WHERE ent.empresa_id = ec.id
        AND ent.tipo IN ('entrega', 'substituicao')
        AND ent.data >= (CURRENT_DATE - interval '12 months')
    ) consumo ON true
    ORDER BY ec.nome
  ) t;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
