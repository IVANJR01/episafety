-- Devolução e estorno de EPI em uma transação só.
--
-- O problema que isto resolve: a tela gravava a devolução em dois passos
-- separados — inseria a linha de devolução e depois marcava a entrega
-- original como devolvida. Quando o segundo passo falhava, o código
-- tentava apagar o primeiro na mão, de dentro do navegador. Se a internet
-- caísse, o celular travasse ou o técnico fechasse a aba entre os dois
-- passos, o banco ficava com devolução registrada e EPI ainda marcado
-- como entregue — ou o contrário. Divergência que não aparece no dia a
-- dia e aparece na fiscalização.
--
-- O estorno era pior: três passos (restaurar a entrega, apagar a
-- devolução, descontar o estoque) sem desfazer nenhum em caso de falha.
--
-- Agora o Postgres faz tudo ou não faz nada. Não existe meio caminho.
--
-- Importante: a DECISÃO continua em src/lib/entregaDevolucao.ts, onde o
-- teste alcança. Estas funções não decidem nada — recebem o que já foi
-- decidido e gravam de forma atômica. Quantidade, observação e status
-- restaurado chegam prontos.

-- ---------------------------------------------------------------------
-- 1) Devolver EPI
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.devolver_entrega_epi(
  _entrega_id uuid,
  _quantidade integer,
  _data date,
  _observacao text,
  _empresa_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entrega public.entregas;
  _empresa_alvo uuid;
  _devolucao_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _entrega FROM public.entregas WHERE id = _entrega_id;
  IF _entrega.id IS NULL THEN
    RAISE EXCEPTION 'Entrega não encontrada';
  END IF;

  -- A função é SECURITY DEFINER, então ela ignora RLS: a permissão tem
  -- de ser conferida aqui, na mão, ou qualquer usuário autenticado
  -- devolveria EPI de empresa que não é dele.
  _empresa_alvo := COALESCE(_entrega.empresa_id, _empresa_id);
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _empresa_alvo)) THEN
    RAISE EXCEPTION 'Sem permissão para devolver EPI desta empresa';
  END IF;

  -- Devolver duas vezes a mesma entrega creditava o EPI duas vezes no
  -- estoque. Dava para fazer sem querer, com a tela aberta em duas abas
  -- ou com dois toques no botão em conexão ruim.
  IF _entrega.status = 'devolvido' THEN
    RAISE EXCEPTION 'Esta entrega já foi devolvida';
  END IF;

  IF _quantidade < 0 THEN
    RAISE EXCEPTION 'Quantidade de devolução não pode ser negativa';
  END IF;

  -- funcionario_id e epi_id saem da entrega, não do que o navegador
  -- mandou: é a devolução DESTA entrega, e ninguém de fora escolhe isso.
  INSERT INTO public.entregas (
    funcionario_id, epi_id, quantidade, data, tipo, status,
    observacao, empresa_id, created_by
  ) VALUES (
    _entrega.funcionario_id, _entrega.epi_id, _quantidade, _data,
    'devolucao'::public.tipo_entrega, 'devolvido'::public.status_entrega,
    _observacao, _empresa_alvo, auth.uid()
  )
  RETURNING id INTO _devolucao_id;

  UPDATE public.entregas SET status = 'devolvido'::public.status_entrega WHERE id = _entrega_id;

  RETURN _devolucao_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.devolver_entrega_epi(uuid, integer, date, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Desfazer a devolução
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_devolucao_epi(
  _devolucao_id uuid,
  _entrega_origem_id uuid,
  _status_restaurado text,
  _observacao_origem text,
  _novo_estoque integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _devolucao public.entregas;
  _origem public.entregas;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _devolucao FROM public.entregas WHERE id = _devolucao_id;
  IF _devolucao.id IS NULL THEN
    RAISE EXCEPTION 'Devolução não encontrada';
  END IF;

  SELECT * INTO _origem FROM public.entregas WHERE id = _entrega_origem_id;
  IF _origem.id IS NULL THEN
    RAISE EXCEPTION 'Entrega de origem não encontrada';
  END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), COALESCE(_devolucao.empresa_id, _origem.empresa_id))) THEN
    RAISE EXCEPTION 'Sem permissão para desfazer devolução desta empresa';
  END IF;

  -- Só devolução se desfaz. Sem esta linha, um id trocado apagaria uma
  -- entrega de EPI — e entrega apagada é ficha que não fecha.
  IF _devolucao.tipo <> 'devolucao' THEN
    RAISE EXCEPTION 'O registro informado não é uma devolução';
  END IF;

  -- A entrega de origem precisa ser do mesmo colaborador e do mesmo EPI.
  -- A tela já escolhe certo, mas aqui é a última porta antes da gravação.
  IF _origem.funcionario_id <> _devolucao.funcionario_id
     OR _origem.epi_id <> _devolucao.epi_id THEN
    RAISE EXCEPTION 'A entrega de origem não corresponde a esta devolução';
  END IF;

  -- status é enum (status_entrega), e o valor chega como texto lido da
  -- trilha de auditoria. O cast explícito recusa valor inventado, e aí a
  -- transação inteira é descartada em vez de gravar status inválido.
  UPDATE public.entregas
     SET status = _status_restaurado::public.status_entrega,
         observacao = _observacao_origem
   WHERE id = _entrega_origem_id;

  DELETE FROM public.entregas WHERE id = _devolucao_id;

  -- null quer dizer "não mexe no estoque": EPI de contrato tem saldo
  -- próprio, e devolução de descarte nunca somou peça nenhuma.
  IF _novo_estoque IS NOT NULL THEN
    UPDATE public.epis
       SET estoque = GREATEST(_novo_estoque, 0)
     WHERE id = _devolucao.epi_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.estornar_devolucao_epi(uuid, uuid, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 3) Fechar para quem não está logado
-- ---------------------------------------------------------------------
-- O Postgres dá EXECUTE a PUBLIC em função nova por padrão, e PUBLIC
-- inclui o papel anon — o visitante sem login. As duas funções já
-- recusam auth.uid() nulo, mas função que grava EPI não deve nem ser
-- chamável por quem não entrou no sistema.
REVOKE EXECUTE ON FUNCTION public.devolver_entrega_epi(uuid, integer, date, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_devolucao_epi(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.devolver_entrega_epi(uuid, integer, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_devolucao_epi(uuid, uuid, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Substituir EPI (descarte automático da entrega anterior)
-- ---------------------------------------------------------------------
-- Mesmo problema dos anteriores, no caminho que o técnico mais usa:
-- quando o EPI novo substitui um que o colaborador já tinha, o antigo era
-- encerrado em duas gravações soltas (criar o descarte e marcar a antiga
-- como substituída). Falhar na segunda deixava o colaborador com DOIS
-- EPIs ativos do mesmo tipo na ficha — e o erro só ia para o console, de
-- modo que o técnico nunca ficava sabendo.
--
-- O antigo vira 'substituido', não 'devolvido': o colaborador não
-- devolveu nada, ele trocou. E a devolução de descarte entra com
-- quantidade zero, porque peça trocada não volta ao estoque.
CREATE OR REPLACE FUNCTION public.substituir_entrega_epi(
  _entrega_antiga_id uuid,
  _data date,
  _observacao text,
  _empresa_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _antiga public.entregas;
  _empresa_alvo uuid;
  _descarte_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _antiga FROM public.entregas WHERE id = _entrega_antiga_id;
  IF _antiga.id IS NULL THEN
    RAISE EXCEPTION 'Entrega anterior não encontrada';
  END IF;

  _empresa_alvo := COALESCE(_antiga.empresa_id, _empresa_id);
  IF NOT (public.is_super_admin(auth.uid())
          OR public.is_principal(auth.uid())
          OR public.is_in_user_company_tree(auth.uid(), _empresa_alvo)) THEN
    RAISE EXCEPTION 'Sem permissão para substituir EPI desta empresa';
  END IF;

  IF _antiga.status <> 'ativo' THEN
    RAISE EXCEPTION 'Só entrega ativa pode ser substituída';
  END IF;

  IF _antiga.tipo = 'devolucao' THEN
    RAISE EXCEPTION 'Devolução não pode ser substituída';
  END IF;

  INSERT INTO public.entregas (
    funcionario_id, epi_id, quantidade, data, tipo, status,
    observacao, empresa_id, created_by
  ) VALUES (
    _antiga.funcionario_id, _antiga.epi_id, 0, _data,
    'devolucao'::public.tipo_entrega, 'devolvido'::public.status_entrega,
    _observacao, _empresa_alvo, auth.uid()
  )
  RETURNING id INTO _descarte_id;

  UPDATE public.entregas
     SET status = 'substituido'::public.status_entrega
   WHERE id = _entrega_antiga_id;

  RETURN _descarte_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.substituir_entrega_epi(uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_entrega_epi(uuid, date, text, uuid) TO authenticated;
