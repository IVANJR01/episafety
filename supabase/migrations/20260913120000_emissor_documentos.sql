-- Quem elabora os documentos técnicos, para o rodapé das capas.
--
-- A capa do PGR leva a marca da empresa coberta no alto e, no rodapé, o
-- crédito de quem elaborou — é o padrão de documento de consultoria de SST.
-- Esse segundo bloco não existia em lugar nenhum: `empresa_config` guarda as
-- empresas atendidas, não quem atende.
--
-- Linha única de propósito: é a identificação da operação, não um cadastro.
-- O truque do `id boolean` com `check (id)` deixa o banco recusar a segunda
-- linha, em vez de depender de todo mundo lembrar de atualizar a certa.
create table if not exists public.emissor_documentos (
  id boolean primary key default true,
  nome text not null default '',
  slogan text,
  cnpj text,
  endereco text,
  contato text,
  logo_url text,
  logo_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint emissor_documentos_linha_unica check (id)
);

comment on table public.emissor_documentos is
  'Identificação de quem elabora os documentos técnicos, impressa no rodapé das capas. Linha única.';

alter table public.emissor_documentos enable row level security;

-- Leitura para qualquer usuário autenticado: o dado aparece impresso em
-- documento que essas pessoas geram, então esconder não protege nada.
drop policy if exists emissor_documentos_leitura on public.emissor_documentos;
create policy emissor_documentos_leitura on public.emissor_documentos
  for select to authenticated using (true);

-- Escrita só para super admin: é a identidade da operação inteira, e sai
-- impressa em documento que circula fora.
drop policy if exists emissor_documentos_escrita on public.emissor_documentos;
create policy emissor_documentos_escrita on public.emissor_documentos
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

insert into public.emissor_documentos (id, nome, slogan, cnpj, endereco, contato)
values (
  true,
  '3M CURSOS E TREINAMENTOS',
  'Segurança e Saúde Ocupacional',
  '51.489.453/0001-64',
  'Rua Gilberto Gomes de Menezes, 145 - Centro - Potiretama/CE - 62990-000',
  'ivanjr.tstconsultoria@gmail.com'
)
on conflict (id) do nothing;
