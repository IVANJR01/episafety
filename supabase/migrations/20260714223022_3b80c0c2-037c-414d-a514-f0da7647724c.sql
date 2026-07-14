CREATE OR REPLACE FUNCTION public.salvar_orcamento_itens(
  _orcamento_id uuid,
  _itens jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _empresa uuid;
  _active uuid := public.get_active_empresa_id(auth.uid());
  _item jsonb;
BEGIN
  SELECT empresa_id INTO _empresa FROM public.orcamentos WHERE id = _orcamento_id;
  IF _empresa IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;
  IF _active IS NULL OR _empresa <> _active THEN
    RAISE EXCEPTION 'Sem permissão para alterar este orçamento';
  END IF;

  DELETE FROM public.orcamentos_itens WHERE orcamento_id = _orcamento_id;

  IF _itens IS NOT NULL AND jsonb_array_length(_itens) > 0 THEN
    FOR _item IN SELECT * FROM jsonb_array_elements(_itens)
    LOOP
      INSERT INTO public.orcamentos_itens (
        empresa_id, orcamento_id, tipo, codigo, descricao, detalhe,
        unidade, quantidade, valor_unitario, desconto, total_item, ordem
      ) VALUES (
        _empresa,
        _orcamento_id,
        COALESCE(_item->>'tipo', 'servico'),
        NULLIF(_item->>'codigo', ''),
        COALESCE(_item->>'descricao', ''),
        NULLIF(_item->>'detalhe', ''),
        COALESCE(_item->>'unidade', 'un'),
        COALESCE((_item->>'quantidade')::numeric, 0),
        COALESCE((_item->>'valor_unitario')::numeric, 0),
        COALESCE((_item->>'desconto')::numeric, 0),
        COALESCE((_item->>'total_item')::numeric, 0),
        COALESCE((_item->>'ordem')::int, 0)
      );
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_orcamento_itens(uuid, jsonb) TO authenticated;