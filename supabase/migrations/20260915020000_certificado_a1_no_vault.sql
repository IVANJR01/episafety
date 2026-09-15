-- ============================================================================
-- Certificado A1 no Vault, como alternativa ao segredo do painel
-- ============================================================================
-- O .pfx em base64 tem ~5.400 caracteres. Colar isso no campo de segredo do
-- painel do Supabase falhou três vezes seguidas na configuração real: ora o
-- valor não era salvo, ora era salvo truncado — e a função continuava dizendo
-- que faltava o certificado. O Vault guarda o mesmo conteúdo criptografado e
-- aceita ser preenchido por SQL, que é o caminho que funciona.
--
-- A senha NÃO vem para cá. Ela continua sendo segredo de ambiente da função:
-- separar o arquivo da senha é o que mantém um vazamento de banco longe de
-- uma assinatura falsificada.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.certificado_a1_pfx_base64()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CERT_A1_PFX_BASE64'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.certificado_a1_pfx_base64() IS
  'Devolve o certificado A1 (.pfx em base64) guardado no Vault. Só a service_role executa: é chave privada.';

-- Quem pode ler isto assina como a empresa. A permissão padrão do Postgres em
-- função nova é EXECUTE para todos — inclusive anon —, então o revoke abaixo
-- não é zelo excessivo, é o que impede qualquer visitante de baixar a chave.
REVOKE ALL ON FUNCTION public.certificado_a1_pfx_base64() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.certificado_a1_pfx_base64() FROM anon;
REVOKE ALL ON FUNCTION public.certificado_a1_pfx_base64() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.certificado_a1_pfx_base64() TO service_role;
