
CREATE OR REPLACE FUNCTION public.get_filial_epis(_filial_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  _user_empresa_id uuid;
  _has_gestao boolean;
BEGIN
  -- Must be super_admin, principal, or have epis:gestao_estoque
  IF NOT is_super_admin(auth.uid()) THEN
    IF NOT EXISTS (
      SELECT 1 FROM usuarios_liberados
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_principal = true
    ) THEN
      SELECT EXISTS (
        SELECT 1 FROM usuarios_liberados
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND (
          modulos_permitidos @> ARRAY['epis:gestao_estoque']
          OR modulos_permitidos @> ARRAY['epis']
        )
      ) INTO _has_gestao;

      IF NOT _has_gestao THEN
        RETURN '[]'::jsonb;
      END IF;
    END IF;
    _user_empresa_id := get_user_empresa_id(auth.uid());
    IF NOT EXISTS (
      SELECT 1 FROM empresa_config
      WHERE id = _filial_id AND (empresa_pai_id = _user_empresa_id OR id = _user_empresa_id)
    ) THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'nome', e.nome,
    'ca', e.ca,
    'categoria', e.categoria,
    'estoque', e.estoque,
    'estoque_minimo', e.estoque_minimo,
    'valor', e.valor,
    'contratos', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'contrato_id', c.id,
        'contrato_nome', c.nome,
        'qtd_entregue', sub.qtd
      ))
      FROM (
        SELECT ent.epi_id, f.contrato_id, SUM(ent.quantidade) as qtd
        FROM entregas ent
        JOIN funcionarios f ON f.id = ent.funcionario_id
        WHERE ent.epi_id = e.id
          AND ent.empresa_id = _filial_id
          AND f.contrato_id IS NOT NULL
        GROUP BY ent.epi_id, f.contrato_id
      ) sub
      JOIN contratos c ON c.id = sub.contrato_id
    ), '[]'::jsonb)
  ) ORDER BY e.nome), '[]'::jsonb)
  INTO result
  FROM epis e
  WHERE e.empresa_id = _filial_id;

  RETURN result;
END;
$$;
