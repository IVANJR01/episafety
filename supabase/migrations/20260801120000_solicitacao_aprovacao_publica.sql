-- Aprovação/recusa de solicitação de materiais via link no email, sem login.
--
-- O setor de compras muitas vezes não tem (e não terá) usuário no sistema.
-- Em vez de dar acesso amplo e sem senha à tabela, o padrão aqui é:
-- 1) um token aleatório de uso único, gravado na própria solicitação;
-- 2) duas funções SECURITY DEFINER que validam o token internamente antes de
--    ler ou gravar qualquer coisa — a RLS da tabela continua bloqueando
--    leitura/escrita direta por usuário anônimo, só essas duas portas
--    controladas ficam abertas, e cada uma só age sobre a linha cujo token
--    bate exatamente com o que veio na URL.

ALTER TABLE public.solicitacoes_materiais
  ADD COLUMN IF NOT EXISTS token_publico TEXT,
  ADD COLUMN IF NOT EXISTS token_publico_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_publico_usado_em TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_solmat_token_publico
  ON public.solicitacoes_materiais(token_publico)
  WHERE token_publico IS NOT NULL;

-- Leitura pública (só os campos necessários pra tela de confirmação).
CREATE OR REPLACE FUNCTION public.consultar_solicitacao_publica(
  p_solicitacao_id UUID,
  p_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.solicitacoes_materiais%ROWTYPE;
  v_itens_count INT;
  v_empresa_nome TEXT;
BEGIN
  SELECT * INTO v_row FROM public.solicitacoes_materiais WHERE id = p_solicitacao_id;

  IF NOT FOUND OR v_row.token_publico IS NULL OR v_row.token_publico <> p_token THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Link inválido');
  END IF;

  IF v_row.token_publico_expira_em IS NOT NULL AND v_row.token_publico_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este link expirou');
  END IF;

  SELECT count(*) INTO v_itens_count
    FROM public.solicitacoes_materiais_itens WHERE solicitacao_id = p_solicitacao_id;
  SELECT nome INTO v_empresa_nome FROM public.empresa_config WHERE id = v_row.empresa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'numero', v_row.numero_solicitacao,
    'titulo', v_row.titulo,
    'empresa_nome', v_empresa_nome,
    'setor', v_row.setor,
    'solicitante_nome', v_row.solicitante_nome,
    'prioridade', v_row.prioridade,
    'data_necessidade', v_row.data_necessidade,
    'status', v_row.status,
    'itens_count', v_itens_count,
    'ja_usado', v_row.token_publico_usado_em IS NOT NULL
  );
END;
$$;

-- Grava a decisão (aprovar/recusar). Só age se status ainda for 'enviada' e o
-- token não tiver sido usado — um segundo clique no mesmo link não faz nada.
CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_publica(
  p_solicitacao_id UUID,
  p_token TEXT,
  p_acao TEXT,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.solicitacoes_materiais%ROWTYPE;
BEGIN
  IF p_acao NOT IN ('aprovar', 'recusar') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Ação inválida');
  END IF;

  SELECT * INTO v_row FROM public.solicitacoes_materiais WHERE id = p_solicitacao_id FOR UPDATE;

  IF NOT FOUND OR v_row.token_publico IS NULL OR v_row.token_publico <> p_token THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Link inválido');
  END IF;

  IF v_row.token_publico_expira_em IS NOT NULL AND v_row.token_publico_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este link expirou');
  END IF;

  IF v_row.token_publico_usado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este link já foi usado', 'status', v_row.status);
  END IF;

  IF v_row.status <> 'enviada' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta solicitação não está mais pendente de aprovação', 'status', v_row.status);
  END IF;

  IF p_acao = 'aprovar' THEN
    UPDATE public.solicitacoes_materiais
      SET status = 'aprovada',
          aprovado_por_nome = COALESCE(aprovado_por_nome, 'Compras (link do email)'),
          aprovado_em = now(),
          token_publico_usado_em = now()
      WHERE id = p_solicitacao_id;
  ELSE
    UPDATE public.solicitacoes_materiais
      SET status = 'recusada',
          motivo_recusa = COALESCE(NULLIF(p_motivo, ''), 'Recusado via link do email'),
          aprovado_por_nome = COALESCE(aprovado_por_nome, 'Compras (link do email)'),
          aprovado_em = now(),
          token_publico_usado_em = now()
      WHERE id = p_solicitacao_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN p_acao = 'aprovar' THEN 'aprovada' ELSE 'recusada' END,
    'numero', v_row.numero_solicitacao,
    'titulo', v_row.titulo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_solicitacao_publica(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_publica(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
