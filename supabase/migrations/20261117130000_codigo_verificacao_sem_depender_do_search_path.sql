-- O código de verificação da ficha passa a achar o digest sozinho.
--
-- O que estava quebrado, pelos registros da API e do banco:
--
--   rpc/assinar_entregas_publico   404  (assinatura pelo link do WhatsApp)
--   rpc/devolver_entrega_epi       404  (devolução de EPI)
--   rpc/substituir_entrega_epi     404  (substituição de EPI)
--
-- E no log do Postgres, no mesmo segundo:
--
--   function digest(text, unknown) does not exist
--
-- A cadeia é esta. Gravar em `entregas` dispara o gatilho
-- trg_entregas_codigo_verificacao, que chama calcular_codigo_verificacao.
-- Essa função chama digest() — que vem da extensão pgcrypto e mora no
-- esquema `extensions`, não no `public` — sem dizer de onde. Ela não
-- define o próprio search_path e herda o de quem chamou.
--
-- Pelo sistema, com o técnico logado, o caminho inclui `extensions` e
-- tudo funciona. Mas as três funções acima foram escritas com
-- `set search_path to 'public'` — prática certa de segurança para
-- SECURITY DEFINER — e, dentro delas, o digest some. O Postgres devolve
-- 42883 (função inexistente), e a API traduz 42883 como 404. Daí o
-- "função não encontrada" que levou ao diagnóstico errado de 10/11
-- (catálogo desatualizado): a função de assinar existia, quem não
-- existia era o digest, três chamadas abaixo.
--
-- A correção é na função que usa o digest, e não em cada chamador:
--
--   - extensions.digest, com o esquema escrito;
--   - search_path vazio, para ela nunca mais depender de quem chama.
--
-- O resultado é o MESMO hash de antes, byte a byte — 201 fichas já
-- emitidas têm esse código impresso e continuam válidas. Conferido antes
-- e depois de aplicar.
create or replace function public.calcular_codigo_verificacao(
  p_id uuid,
  p_created_at timestamp with time zone,
  p_assinatura text
)
returns text
language sql
stable
set "TimeZone" to 'UTC'
set search_path to ''
as $$
  select case
    when p_assinatura is null or p_assinatura = '' then null
    else left(
      encode(
        extensions.digest(
          p_id::text || '|' || (to_jsonb(p_created_at) #>> '{}') || '|' || p_assinatura,
          'sha256'
        ),
        'hex'
      ),
      40
    )
  end;
$$;
