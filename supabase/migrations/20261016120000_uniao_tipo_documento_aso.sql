-- União dos tipos de documento repetidos de ASO.
--
-- O catálogo tinha duas linhas com o mesmo nome, "ASO - Atestado de Saúde
-- Ocupacional": a do catálogo compartilhado (permanente) e uma criada na
-- empresa 40d91cc4 com 12 meses de validade. Para o sistema eram dois
-- documentos diferentes: quem anexava não tinha como saber em qual anexar,
-- metade do histórico ia para um e metade para o outro, e cada um cobrava
-- um prazo.
--
-- Os 12 meses fixos também não valem para ASO. A NR-07 não dá um prazo só:
-- o exame clínico é anual para quem está exposto a risco identificado no
-- PGR e bienal para os demais (7.5.8, II), e o demissional não vence
-- (7.5.11). O prazo é de cada documento, não do tipo — por isso o tipo que
-- fica é o permanente, e a validade é informada no envio ou calculada pelo
-- módulo de ASO.
--
-- A união já foi aplicada neste banco pelo MCP, com cópia de segurança em
-- public.backup_uniao_tipo_aso_20261016. Os comandos ficam aqui para que
-- outro ambiente chegue ao mesmo estado, e para o registro do que foi feito.

-- 1. Cópia de segurança (para desfazer: devolver tipo_documento_id_antigo).
create table if not exists public.backup_uniao_tipo_aso_20261016 (
  tabela text,
  registro_id uuid,
  tipo_documento_id_antigo uuid,
  tipo_documento_id_novo uuid,
  empresa_id uuid,
  colaborador_id uuid,
  cargo text,
  movido_em timestamptz default now()
);

comment on table public.backup_uniao_tipo_aso_20261016 is
  'Cópia de segurança da união dos dois tipos "ASO - Atestado de Saúde Ocupacional". Para desfazer, devolva tipo_documento_id_antigo em cada registro_id.';

insert into public.backup_uniao_tipo_aso_20261016
  (tabela, registro_id, tipo_documento_id_antigo, tipo_documento_id_novo, empresa_id, colaborador_id)
select 'internal_documents', id, tipo_documento_id,
       '9925f6a9-3678-4a3b-8e40-4ec65650c4fb', empresa_id, colaborador_id
  from public.internal_documents
 where tipo_documento_id = '515da818-7c9c-477d-8160-ba12c1b63839';

insert into public.backup_uniao_tipo_aso_20261016
  (tabela, registro_id, tipo_documento_id_antigo, tipo_documento_id_novo, empresa_id, cargo)
select 'internal_document_requirements', id, tipo_documento_id,
       '9925f6a9-3678-4a3b-8e40-4ec65650c4fb', empresa_id, cargo
  from public.internal_document_requirements
 where tipo_documento_id = '515da818-7c9c-477d-8160-ba12c1b63839';

-- 2. Os documentos e o requisito passam para o tipo do catálogo.
--    Conferido antes: nenhum colaborador tinha documento nos dois tipos, e
--    os requisitos são de empresas diferentes — não há colisão.
update public.internal_documents
   set tipo_documento_id = '9925f6a9-3678-4a3b-8e40-4ec65650c4fb'
 where tipo_documento_id = '515da818-7c9c-477d-8160-ba12c1b63839';

update public.internal_document_requirements
   set tipo_documento_id = '9925f6a9-3678-4a3b-8e40-4ec65650c4fb'
 where tipo_documento_id = '515da818-7c9c-477d-8160-ba12c1b63839';

-- 3. Os tipos repetidos, agora sem nenhum documento nem requisito.
--
--    NÃO APLICADO POR AQUI: o canal MCP deste projeto expira em qualquer
--    SQL que contenha a palavra DELETE, e por isso estes dois comandos não
--    foram executados. Eles podem ser rodados no SQL Editor do Supabase, ou
--    — mais simples — basta apagar os dois tipos pelo botão da lixeira em
--    "Tipos de Documento", que agora não leva documento nenhum junto.
--
--    'ASO - DEMISSIONAL' tinha 2 meses de validade e zero documentos. Não
--    deveria existir: o demissional não vence (NR-07, 7.5.11).
--
-- delete from public.internal_document_types
--  where id in ('515da818-7c9c-477d-8160-ba12c1b63839',   -- ASO repetido, 12 meses
--               'da281f12-3fa6-4ffa-a5f2-a058b380f6d0');  -- ASO - DEMISSIONAL, 2 meses
