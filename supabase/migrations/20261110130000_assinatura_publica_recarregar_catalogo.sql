-- Reaplica a função de assinatura e manda a API recarregar o catálogo.
--
-- O colaborador abria o link, tirava a selfie, clicava em "Confirmar e
-- Assinar" e recebia "Não foi possível registrar sua assinatura agora".
-- Nos registros da API, toda tentativa voltava 404 em
-- /rest/v1/rpc/assinar_entregas_publico — a API dizendo que a função não
-- existe. No banco ela existia, com os nomes de parâmetro certos e com
-- permissão para anon.
--
-- A causa está no histórico de migrações:
--
--   20261106192738  consultar_entregas_pendentes_publico
--   20261106192802  assinar_entregas_publico
--
-- Vinte e quatro segundos entre uma e outra. A API (PostgREST) guarda um
-- catálogo das funções e o recarrega quando recebe aviso de mudança, mas
-- agrupa avisos próximos num só. O recarregamento disparado pela
-- primeira migração leu o catálogo ANTES de a segunda terminar, e o
-- aviso da segunda caiu dentro da janela de agrupamento. Ficou assim:
-- consultar as pendências funcionava (200) e assinar não existia (404).
--
-- Não é erro de código nem de permissão: é o catálogo da API
-- desatualizado desde 06/11. O conteúdo da função não muda aqui.
create or replace function public.assinar_entregas_publico(
  p_funcionario_id uuid,
  p_assinatura text,
  p_foto_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _assinadas int;
  _existe boolean;
begin
  if p_funcionario_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Link inválido.');
  end if;

  if p_assinatura is null or btrim(p_assinatura) = '' then
    return jsonb_build_object('ok', false, 'erro', 'Assinatura não recebida. Desenhe a assinatura ou tire a foto antes de salvar.');
  end if;

  -- A assinatura chega como imagem embutida em texto. O teto existe para
  -- que um envio malformado não grave megabytes em cada linha da tabela.
  if length(p_assinatura) > 2000000 or coalesce(length(p_foto_url), 0) > 4000000 then
    return jsonb_build_object('ok', false, 'erro', 'Imagem grande demais. Tente novamente.');
  end if;

  select exists(select 1 from public.funcionarios f where f.id = p_funcionario_id)
    into _existe;

  if not _existe then
    return jsonb_build_object('ok', false, 'erro', 'Link inválido ou expirado.');
  end if;

  -- Só assina o que está pendente. Entrega já assinada não é sobrescrita:
  -- a assinatura antiga é a que foi dada na hora do recebimento, e trocá-la
  -- apagaria a prova que a ficha mostra.
  update public.entregas e
     set assinatura_colaborador = p_assinatura,
         foto_reconhecimento = coalesce(p_foto_url, e.foto_reconhecimento)
   where e.funcionario_id = p_funcionario_id
     and e.assinatura_colaborador is null
     and e.tipo <> 'devolucao';

  get diagnostics _assinadas = row_count;

  if _assinadas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Não há entregas pendentes de assinatura.');
  end if;

  -- O código de verificação de cada entrega é preenchido pelo gatilho
  -- trg_entregas_codigo_verificacao, que dispara ao gravar a assinatura.
  return jsonb_build_object('ok', true, 'assinadas', _assinadas);
end;
$$;

comment on function public.assinar_entregas_publico is
  'Grava a assinatura do colaborador nas entregas pendentes, a partir da página pública /assinar/:id.';

revoke all on function public.assinar_entregas_publico(uuid, text, text) from public;
grant execute on function public.assinar_entregas_publico(uuid, text, text) to anon, authenticated;

-- O aviso explícito, fora de qualquer janela de agrupamento. É ele que
-- faz a API reler o catálogo e enxergar a função.
notify pgrst, 'reload schema';
