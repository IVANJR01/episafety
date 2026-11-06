-- Assinatura do colaborador pelo link enviado no WhatsApp.
--
-- A tela /assinar/:id já existia e chamava duas funções do banco que nunca
-- foram criadas. Quem abria o link recebia, na cara:
--   "Could not find the function public.consultar_entregas_pendentes_publico"
-- Ou seja: o botão "Copiar link p/ WhatsApp" entregava um link quebrado.
--
-- Estas são as duas funções que faltavam. Seguem o mesmo desenho da
-- verificação pública da ficha (20260909150000): SECURITY DEFINER, porque
-- quem abre o link não está autenticado e não deve ter acesso às tabelas,
-- e devolvendo só o necessário.
--
-- LIMITE CONHECIDO: o link leva o id do colaborador, que não muda nunca.
-- Quem guardar o link pode voltar meses depois e assinar entregas novas no
-- lugar do trabalhador. O id tem 122 bits, então ninguém chega nele por
-- tentativa — o risco é o link vazar depois de enviado (encaminhado num
-- grupo, por exemplo). A correção é um token por envio, com validade; está
-- anotada e não foi feita aqui para não segurar a correção do erro.

-- ---------------------------------------------------------------------
-- 1) O que está pendente de assinatura
-- ---------------------------------------------------------------------
create or replace function public.consultar_entregas_pendentes_publico(
  p_funcionario_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  _nome text;
  _entregas jsonb;
begin
  if p_funcionario_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Link inválido.');
  end if;

  select f.nome into _nome
    from public.funcionarios f
   where f.id = p_funcionario_id;

  if _nome is null then
    -- Mesma resposta para id inexistente e para colaborador sem acesso:
    -- distinguir os dois casos diria a quem testa links se o id existe.
    return jsonb_build_object('ok', false, 'erro', 'Link inválido ou expirado.');
  end if;

  -- Pendente é o que a tela interna também trata como pendente: entrega sem
  -- assinatura do colaborador. Devolução não entra — quem devolve não assina
  -- recebimento de nada.
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', t.id,
               'data', t.data,
               'tipo', t.tipo,
               'quantidade', t.quantidade,
               'epi_nome', t.epi_nome,
               'epi_ca', t.epi_ca
             )
             order by t.data desc
           ),
           '[]'::jsonb
         )
    into _entregas
  from (
    select e.id, e.data, e.tipo::text as tipo, e.quantidade,
           epi.nome as epi_nome, epi.ca as epi_ca
      from public.entregas e
      left join public.epis epi on epi.id = e.epi_id
     where e.funcionario_id = p_funcionario_id
       and e.assinatura_colaborador is null
       and e.tipo <> 'devolucao'
     order by e.data desc
     limit 200
  ) t;

  return jsonb_build_object(
    'ok', true,
    'funcionario_nome', _nome,
    'entregas', _entregas
  );
end;
$$;

comment on function public.consultar_entregas_pendentes_publico is
  'Lista as entregas de EPI sem assinatura de um colaborador, para a página pública /assinar/:id.';

revoke all on function public.consultar_entregas_pendentes_publico(uuid) from public;
grant execute on function public.consultar_entregas_pendentes_publico(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Registrar a assinatura
-- ---------------------------------------------------------------------
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
