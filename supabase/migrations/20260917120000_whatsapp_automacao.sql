-- ============================================================================
-- ATENDIMENTO POR WHATSAPP — automação sem n8n
--
-- O caminho é: WhatsApp Cloud API -> webhook (Edge Function) -> este banco ->
-- IA -> resposta de volta pelo WhatsApp. Não existe orquestrador no meio: o
-- estado da conversa é o que está gravado aqui.
--
-- Três tabelas e o motivo de cada uma:
--   whatsapp_config    — liga a linha do WhatsApp (phone_number_id) à empresa.
--                        É o que decide de quem é a conversa que chegou.
--   whatsapp_contatos  — uma linha por número que já falou com a empresa.
--   whatsapp_mensagens — o histórico. É dele que sai o contexto mandado à IA,
--                        e é o `wa_message_id` único que evita responder duas
--                        vezes quando a Meta reenvia o mesmo POST.
--
-- Token e segredo do app NÃO ficam aqui. Ficam nos secrets da Edge Function.
-- Banco é lido por muita gente; secret de function, não.
--
-- Padrão RLS do projeto: is_super_admin OR empresa_id = get_user_empresa_id().
-- Escrita de mensagem é só do service_role (as Edge Functions) — mensagem que
-- saiu tem que ter saído de verdade pela API da Meta, então quem grava é quem
-- enviou.
-- ============================================================================

-- ============ whatsapp_config ============
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  -- Identificador da linha na Meta (não é o telefone). Chega em todo webhook,
  -- em metadata.phone_number_id, e é por ele que se acha a empresa.
  phone_number_id TEXT NOT NULL UNIQUE,
  numero_exibicao TEXT,
  -- Chave geral da automação. Desligada, o webhook só grava e não responde —
  -- útil no fim de semana, ou quando a conta de IA estourou o crédito.
  automacao_ativa BOOLEAN NOT NULL DEFAULT false,
  -- Instruções específicas da empresa, coladas no fim do prompt do sistema:
  -- serviços que vende, preço de referência, como encaminhar.
  prompt_extra TEXT,
  -- Primeira mensagem para quem nunca falou com a linha.
  saudacao TEXT,
  -- Palavras que desligam a IA e chamam gente. Uma por linha do array.
  palavras_atendente TEXT[] NOT NULL DEFAULT ARRAY['atendente','humano','falar com alguem','falar com alguém','falar com um humano','vendedor'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_config IS
  'Uma linha do WhatsApp Cloud API por empresa. O phone_number_id é o que liga o webhook recebido ao tenant.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Super admin full whatsapp_config" ON public.whatsapp_config FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Tenant read whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Tenant read whatsapp_config" ON public.whatsapp_config FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
DROP POLICY IF EXISTS "Tenant update whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Tenant update whatsapp_config" ON public.whatsapp_config FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS update_whatsapp_config_updated_at ON public.whatsapp_config;
CREATE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_contatos ============
CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  -- Como a Meta identifica o número: só dígitos, com DDI. Atenção: número
  -- brasileiro costuma vir SEM o nono dígito.
  wa_id TEXT NOT NULL,
  nome TEXT,
  -- Preenchido quando o número bate com um cliente já cadastrado no comercial.
  -- É o que faz a IA saber com quem está falando.
  cliente_comercial_id UUID REFERENCES public.clientes_comerciais(id) ON DELETE SET NULL,
  -- Desligada quando a conversa passou para uma pessoa. A IA não volta a
  -- responder sozinha: quem assumiu religa aqui.
  automacao_ativa BOOLEAN NOT NULL DEFAULT true,
  -- Última mensagem que a PESSOA mandou. É o que define a janela de 24h da
  -- Meta para mensagem livre; fora dela, só template aprovado.
  ultima_entrada_em TIMESTAMPTZ,
  ultima_mensagem_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_contatos_numero_por_empresa UNIQUE (empresa_id, wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_empresa ON public.whatsapp_contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_cliente ON public.whatsapp_contatos(cliente_comercial_id);

COMMENT ON TABLE public.whatsapp_contatos IS
  'Um número de WhatsApp que já falou com a empresa. automacao_ativa=false é conversa entregue a uma pessoa.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contatos TO authenticated;
GRANT ALL ON public.whatsapp_contatos TO service_role;
ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full whatsapp_contatos" ON public.whatsapp_contatos;
CREATE POLICY "Super admin full whatsapp_contatos" ON public.whatsapp_contatos FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Tenant read whatsapp_contatos" ON public.whatsapp_contatos;
CREATE POLICY "Tenant read whatsapp_contatos" ON public.whatsapp_contatos FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));
-- Atualizar o contato é o que a tela de atendimento faz: assumir a conversa
-- (desligar a automação), corrigir o nome, vincular ao cliente.
DROP POLICY IF EXISTS "Tenant update whatsapp_contatos" ON public.whatsapp_contatos;
CREATE POLICY "Tenant update whatsapp_contatos" ON public.whatsapp_contatos FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = get_user_empresa_id(auth.uid()));

DROP TRIGGER IF EXISTS update_whatsapp_contatos_updated_at ON public.whatsapp_contatos;
CREATE TRIGGER update_whatsapp_contatos_updated_at
BEFORE UPDATE ON public.whatsapp_contatos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ whatsapp_mensagens ============
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresa_config(id) ON DELETE CASCADE,
  contato_id UUID NOT NULL REFERENCES public.whatsapp_contatos(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  -- O `wamid` da Meta. Único de propósito: a Meta reenvia o mesmo POST quando
  -- não recebe 200 rápido, e sem esta restrição o cliente receberia a mesma
  -- resposta duas ou três vezes. O INSERT do webhook depende dela.
  wa_message_id TEXT UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'text',
  texto TEXT,
  -- Quem escreveu a mensagem que saiu: 'ia', 'humano' ou 'sistema'.
  origem TEXT CHECK (origem IN ('ia', 'humano', 'sistema')),
  status TEXT,
  erro TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O histórico é sempre lido por contato, do mais novo para o mais velho.
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_contato ON public.whatsapp_mensagens(contato_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_empresa ON public.whatsapp_mensagens(empresa_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_mensagens IS
  'Histórico das conversas. wa_message_id único é a idempotência do webhook: a Meta reenvia o mesmo POST.';

GRANT SELECT ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

-- Só leitura para quem usa o sistema. Gravar mensagem é das Edge Functions
-- (service_role): mensagem registrada como enviada tem que ter ido mesmo.
DROP POLICY IF EXISTS "Super admin read whatsapp_mensagens" ON public.whatsapp_mensagens;
CREATE POLICY "Super admin read whatsapp_mensagens" ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Tenant read whatsapp_mensagens" ON public.whatsapp_mensagens;
CREATE POLICY "Tenant read whatsapp_mensagens" ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id(auth.uid()));

-- ============ acha o cliente pelo telefone ============
-- O número chega da Meta só com dígitos; o telefone do comercial foi digitado
-- por uma pessoa, com parênteses, traço e espaço. E número brasileiro chega da
-- Meta sem o nono dígito. Comparar os últimos 10 dígitos resolve os dois casos
-- de uma vez: sobra DDD + número, com ou sem DDI, com ou sem o nove.
--
-- Fica no banco porque a comparação precisa do regexp em cima da coluna — dá
-- para fazer no PostgREST, mas não sem trazer a carteira de clientes inteira
-- para dentro da Edge Function a cada mensagem recebida.
CREATE OR REPLACE FUNCTION public.whatsapp_cliente_por_telefone(_empresa_id UUID, _variantes TEXT[])
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clientes_comerciais c
  WHERE c.empresa_id = _empresa_id
    AND c.ativo
    AND length(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g')) >= 10
    AND EXISTS (
      SELECT 1
      FROM unnest(_variantes) AS v
      WHERE length(v) >= 10
        AND right(regexp_replace(c.telefone, '\D', '', 'g'), 10) = right(v, 10)
    )
  ORDER BY c.created_at
  LIMIT 1
$$;

COMMENT ON FUNCTION public.whatsapp_cliente_por_telefone(UUID, TEXT[]) IS
  'Acha o cliente comercial cujo telefone bate com o número do WhatsApp, comparando os últimos 10 dígitos.';

REVOKE ALL ON FUNCTION public.whatsapp_cliente_por_telefone(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_cliente_por_telefone(UUID, TEXT[]) TO service_role;
