-- Resolve o estoque de contrato a partir da entrega, mesmo quando o EPI selecionado pertence à matriz
CREATE OR REPLACE FUNCTION public.resolve_contrato_target_for_entrega(
  _funcionario_id uuid,
  _unidade_id uuid,
  _selected_epi_id uuid
)
RETURNS TABLE (
  contrato_id uuid,
  contrato_epi_id uuid,
  resolved_epi_id uuid,
  resolved_empresa_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _func_contrato_id uuid;
  _selected_ca text;
  _selected_nome text;
  _candidate_count integer;
BEGIN
  SELECT f.contrato_id INTO _func_contrato_id
  FROM public.funcionarios f
  WHERE f.id = _funcionario_id;

  SELECT e.ca, e.nome INTO _selected_ca, _selected_nome
  FROM public.epis e
  WHERE e.id = _selected_epi_id;

  IF _selected_nome IS NULL THEN
    RETURN;
  END IF;

  IF _func_contrato_id IS NOT NULL THEN
    RETURN QUERY
    SELECT ce.contrato_id, ce.id, ce.epi_id, ce.empresa_id
    FROM public.contrato_epis ce
    JOIN public.epis ep ON ep.id = ce.epi_id
    WHERE ce.contrato_id = _func_contrato_id
      AND (
        (_selected_ca IS NOT NULL AND ep.ca = _selected_ca)
        OR ((_selected_ca IS NULL OR ep.ca IS NULL) AND lower(ep.nome) = lower(_selected_nome))
      )
    ORDER BY ce.id
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  SELECT count(*) INTO _candidate_count
  FROM public.contrato_epis ce
  JOIN public.contratos c ON c.id = ce.contrato_id
  JOIN public.epis ep ON ep.id = ce.epi_id
  WHERE c.unidade_id = _unidade_id
    AND (
      (_selected_ca IS NOT NULL AND ep.ca = _selected_ca)
      OR ((_selected_ca IS NULL OR ep.ca IS NULL) AND lower(ep.nome) = lower(_selected_nome))
    );

  IF _candidate_count = 1 THEN
    RETURN QUERY
    SELECT ce.contrato_id, ce.id, ce.epi_id, ce.empresa_id
    FROM public.contrato_epis ce
    JOIN public.contratos c ON c.id = ce.contrato_id
    JOIN public.epis ep ON ep.id = ce.epi_id
    WHERE c.unidade_id = _unidade_id
      AND (
        (_selected_ca IS NOT NULL AND ep.ca = _selected_ca)
        OR ((_selected_ca IS NULL OR ep.ca IS NULL) AND lower(ep.nome) = lower(_selected_nome))
      )
    ORDER BY ce.id
    LIMIT 1;
  END IF;
END;
$$;

-- Evita baixa do estoque geral/unidade quando a entrega deve consumir estoque do contrato
CREATE OR REPLACE FUNCTION public.adjust_epi_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target RECORD;
  _epi_empresa_id uuid;
BEGIN
  IF NEW.tipo IN ('entrega', 'substituicao') THEN
    SELECT empresa_id INTO _epi_empresa_id FROM public.epis WHERE id = NEW.epi_id;

    SELECT * INTO _target
    FROM public.resolve_contrato_target_for_entrega(NEW.funcionario_id, NEW.empresa_id, NEW.epi_id)
    LIMIT 1;

    IF _target.contrato_epi_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF _epi_empresa_id IS DISTINCT FROM NEW.empresa_id THEN
      RETURN NEW;
    END IF;

    UPDATE public.epis
    SET estoque = estoque - NEW.quantidade
    WHERE id = NEW.epi_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_epi_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target RECORD;
  _epi_empresa_id uuid;
BEGIN
  IF OLD.tipo IN ('entrega', 'substituicao') THEN
    SELECT empresa_id INTO _epi_empresa_id FROM public.epis WHERE id = OLD.epi_id;

    SELECT * INTO _target
    FROM public.resolve_contrato_target_for_entrega(OLD.funcionario_id, OLD.empresa_id, OLD.epi_id)
    LIMIT 1;

    IF _target.contrato_epi_id IS NOT NULL THEN
      RETURN OLD;
    END IF;

    IF _epi_empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RETURN OLD;
    END IF;

    UPDATE public.epis
    SET estoque = estoque + OLD.quantidade
    WHERE id = OLD.epi_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Sincroniza o estoque do contrato aceitando EPI da matriz ou da unidade por equivalência lógica (CA/nome)
CREATE OR REPLACE FUNCTION public.sync_contrato_stock_on_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target RECORD;
  _current_stock integer;
  _next_stock integer;
  _is_outgoing boolean;
  _is_return boolean;
  _tipo_mov text;
  _motivo text;
  _label text;
BEGIN
  _is_outgoing := NEW.tipo IN ('entrega', 'troca', 'substituicao', 'perda', 'dano');
  _is_return := NEW.tipo = 'devolucao';

  IF NOT _is_outgoing AND NOT _is_return THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _target
  FROM public.resolve_contrato_target_for_entrega(NEW.funcionario_id, NEW.empresa_id, NEW.epi_id)
  LIMIT 1;

  IF _target.contrato_epi_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT estoque INTO _current_stock
  FROM public.contrato_epis
  WHERE id = _target.contrato_epi_id
  FOR UPDATE;

  IF _is_return THEN
    _next_stock := COALESCE(_current_stock, 0) + NEW.quantidade;
    _tipo_mov := 'entrada';
  ELSE
    _next_stock := GREATEST(COALESCE(_current_stock, 0) - NEW.quantidade, 0);
    _tipo_mov := 'saida';
  END IF;

  UPDATE public.contrato_epis
  SET estoque = _next_stock,
      updated_at = now()
  WHERE id = _target.contrato_epi_id;

  _label := CASE NEW.tipo::text
    WHEN 'entrega' THEN 'Entrega'
    WHEN 'troca' THEN 'Troca'
    WHEN 'substituicao' THEN 'Substituição'
    WHEN 'devolucao' THEN 'Devolução'
    WHEN 'perda' THEN 'Perda'
    WHEN 'dano' THEN 'Dano'
    ELSE NEW.tipo::text
  END;

  _motivo := _label || ' via módulo de entregas';
  IF NEW.observacao IS NOT NULL AND NEW.observacao <> '' THEN
    _motivo := _motivo || ' — ' || NEW.observacao;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contrato_epis_movimentacoes m
    WHERE m.contrato_epi_id = _target.contrato_epi_id
      AND m.tipo = _tipo_mov
      AND m.quantidade = NEW.quantidade
      AND m.created_by IS NOT DISTINCT FROM NEW.created_by
      AND m.epi_id = _target.resolved_epi_id
      AND m.motivo = _motivo
      AND abs(extract(epoch from (m.created_at - NEW.created_at))) < 2
  ) THEN
    INSERT INTO public.contrato_epis_movimentacoes (
      contrato_epi_id, contrato_id, epi_id, empresa_id,
      tipo, quantidade, motivo, created_by
    ) VALUES (
      _target.contrato_epi_id,
      _target.contrato_id,
      _target.resolved_epi_id,
      _target.resolved_empresa_id,
      _tipo_mov,
      NEW.quantidade,
      _motivo,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill das saídas/entradas que não foram sincronizadas anteriormente
DO $$
DECLARE
  rec RECORD;
  _tipo_mov text;
  _motivo text;
  _label text;
BEGIN
  FOR rec IN
    SELECT e.id, e.created_at, e.funcionario_id, e.empresa_id, e.epi_id, e.quantidade, e.tipo, e.created_by, e.observacao,
           t.contrato_id, t.contrato_epi_id, t.resolved_epi_id, t.resolved_empresa_id
    FROM public.entregas e
    CROSS JOIN LATERAL public.resolve_contrato_target_for_entrega(e.funcionario_id, e.empresa_id, e.epi_id) t
    WHERE e.tipo IN ('entrega', 'troca', 'substituicao', 'devolucao', 'perda', 'dano')
  LOOP
    _tipo_mov := CASE WHEN rec.tipo = 'devolucao' THEN 'entrada' ELSE 'saida' END;
    _label := CASE rec.tipo::text
      WHEN 'entrega' THEN 'Entrega'
      WHEN 'troca' THEN 'Troca'
      WHEN 'substituicao' THEN 'Substituição'
      WHEN 'devolucao' THEN 'Devolução'
      WHEN 'perda' THEN 'Perda'
      WHEN 'dano' THEN 'Dano'
      ELSE rec.tipo::text
    END;

    _motivo := _label || ' via módulo de entregas';
    IF rec.observacao IS NOT NULL AND rec.observacao <> '' THEN
      _motivo := _motivo || ' — ' || rec.observacao;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.contrato_epis_movimentacoes m
      WHERE m.contrato_epi_id = rec.contrato_epi_id
        AND m.tipo = _tipo_mov
        AND m.quantidade = rec.quantidade
        AND m.created_by IS NOT DISTINCT FROM rec.created_by
        AND m.epi_id = rec.resolved_epi_id
        AND m.motivo = _motivo
        AND abs(extract(epoch from (m.created_at - rec.created_at))) < 2
    ) THEN
      INSERT INTO public.contrato_epis_movimentacoes (
        contrato_epi_id, contrato_id, epi_id, empresa_id,
        tipo, quantidade, motivo, created_by, created_at
      ) VALUES (
        rec.contrato_epi_id,
        rec.contrato_id,
        rec.resolved_epi_id,
        rec.resolved_empresa_id,
        _tipo_mov,
        rec.quantidade,
        _motivo,
        rec.created_by,
        rec.created_at
      );
    END IF;
  END LOOP;

  UPDATE public.contrato_epis ce
  SET estoque = GREATEST(0,
    COALESCE((
      SELECT SUM(CASE WHEN m.tipo = 'entrada' THEN m.quantidade ELSE -m.quantidade END)
      FROM public.contrato_epis_movimentacoes m
      WHERE m.contrato_epi_id = ce.id
    ), 0)
  ),
  updated_at = now()
  WHERE EXISTS (
    SELECT 1 FROM public.contrato_epis_movimentacoes m WHERE m.contrato_epi_id = ce.id
  );
END;
$$;