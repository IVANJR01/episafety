-- =====================================================================
-- Arquivo Digital SST — fecha vazamento entre empresas na view
--
-- Achado pelo advisor de segurança do Supabase (ERROR:
-- security_definer_view) depois de aplicar as migrations anteriores:
-- `internal_documents_situacao` foi criada sem `security_invoker`, então
-- ela roda com o privilégio de quem criou a view (a migration, via role
-- com BYPASSRLS) em vez do privilégio de quem está consultando.
--
-- As tabelas por trás (`internal_documents`, `internal_document_versions`)
-- têm RLS correta por empresa (`empresa_id = ANY(get_user_empresa_ids(...))`
-- — ver idoc_select/idv_select). O problema é só a view: hoje, qualquer
-- usuário autenticado que consultasse `internal_documents_situacao`
-- diretamente (sem passar pela tela, que filtra por empresa no client)
-- veria colaborador_id, tipo de documento, validade e caminho do arquivo
-- de TODAS as empresas — vazamento de dado entre clientes.
--
-- Correção: `security_invoker = true` faz a view herdar o privilégio de
-- quem consulta, então a RLS das tabelas de baixo passa a valer também
-- pela view — nenhuma mudança de política nova, só parar de ignorar as
-- que já existem.
-- =====================================================================

ALTER VIEW public.internal_documents_situacao SET (security_invoker = true);

-- Dois achados WARN menores no mesmo pacote de migrations, mesma limpeza:

-- search_path mutável na trigger de numeração de versão — sem SECURITY
-- DEFINER, risco baixo, mas o lint pede search_path fixo mesmo assim.
ALTER FUNCTION public.proxima_versao_documento() SET search_path = public;

-- sincronizar_tipo_documento precisa continuar SECURITY DEFINER (só assim
-- a linha do tipo global, empresa_id NULL, consegue ser inserida por um
-- usuário comum — a RLS de INSERT em internal_document_types exige
-- empresa_id = ANY(get_user_empresa_ids(...)), o que uma linha global
-- nunca satisfaz). O que não devia existir é ela ser chamável direto via
-- REST (/rest/v1/rpc/sincronizar_tipo_documento): é função de trigger,
-- não tem sentido fora desse contexto, e o Postgres concede EXECUTE a
-- PUBLIC por padrão em toda função nova.
REVOKE EXECUTE ON FUNCTION public.sincronizar_tipo_documento() FROM PUBLIC, anon, authenticated;
