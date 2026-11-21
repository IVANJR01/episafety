-- public.backup_uniao_tipo_aso_20261016 é uma tabela de backup manual, criada
-- fora do versionamento (o sufixo é a data: 16/10/2026). Ela guarda a trilha de
-- uma migração de tipos de documento: registro, empresa, colaborador, cargo e
-- para qual tipo cada documento foi movido.
--
-- Estava com RLS desligado e zero políticas, enquanto os papéis `anon` e
-- `authenticated` tinham privilégio de SELECT *e de DELETE*. A chave anônima
-- viaja no bundle do cliente, ou seja, é pública: qualquer pessoa na internet
-- podia ler a trilha e, pior, apagá-la.
--
-- Nada depende dela: nenhuma view, função, trigger ou chave estrangeira no
-- banco, e nenhuma referência no código da aplicação. Fechar o acesso não
-- quebra nada.
--
-- Duas camadas, de propósito. Só ligar RLS ainda deixaria o privilégio de
-- tabela concedido, e um GRANT esquecido volta a abrir o acesso caso alguém
-- crie uma política permissiva no futuro. Revogar o GRANT fecha a porta mesmo.
-- O papel service_role continua com acesso (ele ignora RLS), que é o caminho
-- correto para ler um backup administrativo.

alter table public.backup_uniao_tipo_aso_20261016 enable row level security;

revoke all on table public.backup_uniao_tipo_aso_20261016 from anon;
revoke all on table public.backup_uniao_tipo_aso_20261016 from authenticated;

comment on table public.backup_uniao_tipo_aso_20261016 is
  'Backup manual (16/10/2026) da migração de tipos de documento ASO. Acesso apenas via service_role: RLS ligado sem políticas e GRANTs de anon/authenticated revogados. Se não for mais necessária, pode ser removida.';
