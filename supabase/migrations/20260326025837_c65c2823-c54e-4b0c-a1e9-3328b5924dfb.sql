-- Fix recursive empresa_config access and add transactional inventory finalization
DROP POLICY IF EXISTS "User read parent empresa" ON public.empresa_config;

CREATE OR REPLACE FUNCTION public.get_user_parent_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ec.empresa_pai_id
  FROM public.empresa_config ec
  WHERE ec.id = public.get_user_empresa_id(_user_id)
  LIMIT 1
$$;

CREATE POLICY "User read parent empresa safe"
ON public.empresa_config
FOR SELECT
TO authenticated
USING (id = public.get_user_parent_empresa_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.historico_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conferencia_id uuid NOT NULL REFERENCES public.conferencias_estoque(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresa_config(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  colaborador_id uuid,
  colaborador_nome text,
  total_itens integer NOT NULL DEFAULT 0,
  total_divergencias integer NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory history"
ON public.historico_inventario
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_principal(auth.uid())
  OR public.is_in_user_company_tree(auth.uid(), empresa_id)
  OR EXISTS (
    SELECT 1
    FROM public.usuarios_liberados ul
    WHERE lower(ul.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND ul.contrato_id = historico_inventario.contrato_id
      AND ul.ativo = true
  )
);

CREATE INDEX IF NOT EXISTS idx_historico_inventario_contrato_id ON public.historico_inventario(contrato_id);
CREATE INDEX IF NOT EXISTS idx_historico_inventario_unidade_id ON public.historico_inventario(unidade_id);
CREATE INDEX IF NOT EXISTS idx_historico_inventario_conferencia_id ON public.historico_inventario(conferencia_id);

CREATE OR REPLACE FUNCTION public.finalizar_conferencia_estoque(
  _contrato_id uuid,
  _unidade_id uuid,
  _empresa_id uuid,
  _tipo text,
  _itens jsonb,
  _observacao_geral text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
  _can_access boolean := false;
  _conferencia_id uuid;
  _profile_nome text;
  _item jsonb;
  _contrato_epi_id uuid;
  _epi_id uuid;
  _estoque_sistema integer;
  _contagem_fisica integer;
  _divergencia integer;
  _justificativa text;
  _total_itens integer := 0;
  _total_divergencias integer := 0;
  _motivo text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _tipo NOT IN ('semanal', 'mensal') THEN
    RAISE EXCEPTION 'Tipo de conferência inválido';
  END IF;

  SELECT (
    public.is_super_admin(_user_id)
    OR public.is_principal(_user_id)
    OR public.is_in_user_company_tree(_user_id, _empresa_id)
    OR EXISTS (
      SELECT 1
      FROM public.usuarios_liberados ul
      WHERE lower(ul.email) = _user_email
        AND ul.contrato_id = _contrato_id
        AND ul.ativo = true
    )
  ) INTO _can_access;

  IF NOT _can_access THEN
    RAISE EXCEPTION 'Sem permissão para finalizar a conferência deste contrato';
  END IF;

  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhum item informado para conferência';
  END IF;

  SELECT nome INTO _profile_nome
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  INSERT INTO public.conferencias_estoque (
    contrato_id,
    unidade_id,
    empresa_id,
    tipo,
    status,
    observacao_geral,
    created_by,
    finalizado_por,
    finalizado_em
  ) VALUES (
    _contrato_id,
    _unidade_id,
    _empresa_id,
    _tipo,
    'finalizada',
    NULLIF(_observacao_geral, ''),
    _user_id,
    _user_id,
    now()
  ) RETURNING id INTO _conferencia_id;

  FOR _item IN SELECT value FROM jsonb_array_elements(_itens)
  LOOP
    _contrato_epi_id := (_item ->> 'contrato_epi_id')::uuid;
    _epi_id := (_item ->> 'epi_id')::uuid;
    _estoque_sistema := COALESCE((_item ->> 'estoque_sistema')::integer, 0);
    _contagem_fisica := (_item ->> 'contagem_fisica')::integer;
    _justificativa := NULLIF(btrim(COALESCE(_item ->> 'justificativa', '')), '');

    IF _contrato_epi_id IS NULL OR _epi_id IS NULL OR _contagem_fisica IS NULL THEN
      RAISE EXCEPTION 'Item de conferência inválido';
    END IF;

    _divergencia := _contagem_fisica - _estoque_sistema;
    _total_itens := _total_itens + 1;

    IF _divergencia <> 0 AND _justificativa IS NULL THEN
      RAISE EXCEPTION 'Justificativa obrigatória para itens com divergência';
    END IF;

    INSERT INTO public.conferencia_itens (
      conferencia_id,
      contrato_epi_id,
      epi_id,
      estoque_sistema,
      contagem_fisica,
      divergencia,
      justificativa
    ) VALUES (
      _conferencia_id,
      _contrato_epi_id,
      _epi_id,
      _estoque_sistema,
      _contagem_fisica,
      _divergencia,
      _justificativa
    );

    UPDATE public.contrato_epis
    SET estoque = _contagem_fisica,
        updated_at = now()
    WHERE id = _contrato_epi_id
      AND contrato_id = _contrato_id;

    IF _divergencia <> 0 THEN
      _total_divergencias := _total_divergencias + 1;
      _motivo := format(
        'Ajuste de Inventário (%s)%s',
        CASE WHEN _tipo = 'semanal' THEN 'Semanal' ELSE 'Mensal' END,
        CASE WHEN _justificativa IS NOT NULL THEN ' — ' || _justificativa ELSE '' END
      );

      INSERT INTO public.contrato_epis_movimentacoes (
        contrato_epi_id,
        contrato_id,
        epi_id,
        empresa_id,
        tipo,
        quantidade,
        motivo,
        responsavel_nome,
        created_by
      ) VALUES (
        _contrato_epi_id,
        _contrato_id,
        _epi_id,
        _empresa_id,
        CASE WHEN _divergencia > 0 THEN 'entrada' ELSE 'saida' END,
        abs(_divergencia),
        _motivo,
        COALESCE(_profile_nome, 'Sistema'),
        _user_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.historico_inventario (
    conferencia_id,
    contrato_id,
    unidade_id,
    empresa_id,
    tipo,
    colaborador_id,
    colaborador_nome,
    total_itens,
    total_divergencias,
    observacao
  ) VALUES (
    _conferencia_id,
    _contrato_id,
    _unidade_id,
    _empresa_id,
    _tipo,
    _user_id,
    COALESCE(_profile_nome, 'Sistema'),
    _total_itens,
    _total_divergencias,
    NULLIF(_observacao_geral, '')
  );

  RETURN jsonb_build_object(
    'success', true,
    'conferencia_id', _conferencia_id,
    'total_itens', _total_itens,
    'total_divergencias', _total_divergencias
  );
END;
$$;