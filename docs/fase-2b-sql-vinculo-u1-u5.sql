-- ============================================================================
-- Fase 2B — Script parametrizado de vinculação U1–U5
-- ----------------------------------------------------------------------------
-- ATENÇÃO:
--   * NÃO executar este script sem antes substituir todos os placeholders
--     <EMAIL_REAL_UX> pelos e-mails reais cadastrados em /auth.
--   * NÃO usar e-mails @homolog.test para login real — apenas placeholders.
--   * Cada usuário precisa primeiro fazer signup em /auth (ou ser convidado),
--     porque user_roles.user_id referencia auth.users(id).
--   * Antes de rodar a parte de user_roles, confirme que o auth.users(id)
--     existe — o script consulta por e-mail.
--
-- Empresas-alvo ([HOMOLOG], criadas na Fase 0):
--   Empresa A (matriz): f141f880-b820-4e0d-8958-a410734201fa
--   Empresa B (matriz): 8d579cbc-74cf-49d4-a1bf-57026406eb0b
--   Contrato A1.1     : d12e327d-a2cd-4015-8b7f-303ae099afd4
--   Contrato B1.1     : d1c2d18f-0ab1-4898-9160-b53526f35587
--
-- Matriz de perfis:
--   U1 — Super Admin (global, acesso A + B)
--   U2 — Principal (Empresa A)
--   U3 — Admin/Técnico SST (Empresa A)
--   U4 — Operacional (Empresa B)
--   U5 — Sem permissão (sem vínculo de empresa, sem role)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PARÂMETROS — e-mails escolhidos para a Fase 2B
-- ----------------------------------------------------------------------------
-- Decisão do solicitante (opção A — contas dedicadas de homologação):
--   <EMAIL_REAL_U1>  ->  ivanjr.tstconsultoria@gmail.com   (real, já existe em auth.users)
--   <EMAIL_REAL_U2>  ->  homolog.u2@gmail.com              (dedicado, aguardando signup)
--   <EMAIL_REAL_U3>  ->  homolog.u3@gmail.com              (dedicado, aguardando signup)
--   <EMAIL_REAL_U4>  ->  homolog.u4@gmail.com              (dedicado, aguardando signup)
--   <EMAIL_REAL_U5>  ->  homolog.u5@gmail.com              (dedicado, aguardando signup)
--
-- PRÉ-REQUISITO: U2–U5 precisam fazer signup em /auth ANTES de rodar este script.
-- Sem o signup, o bloco user_roles não cria nada (filtra por auth.users.email).
--
-- PROIBIDO: NÃO usar os e-mails reais de produção como U2–U5:
--   admg91nordeste@gmail.com, admg91@gmail.com, emilly@cg3.com.br, encarregado@gmail.com

-- ----------------------------------------------------------------------------
-- 1) usuarios_liberados — whitelist + módulos permitidos
-- ----------------------------------------------------------------------------
INSERT INTO usuarios_liberados (email, nome, empresa_id, contrato_id, is_principal, ativo, modulos_permitidos)
VALUES
  -- U1 Super Admin: empresa_id NULL = global; sem módulos restritos
  ('<EMAIL_REAL_U1>', '[HOMOLOG] U1 Super Admin',
   NULL, NULL, false, true, NULL),

  -- U2 Principal Empresa A
  ('<EMAIL_REAL_U2>', '[HOMOLOG] U2 Principal A',
   'f141f880-b820-4e0d-8958-a410734201fa', NULL, true, true, NULL),

  -- U3 Admin/Técnico SST Empresa A — módulos SST e documentos
  ('<EMAIL_REAL_U3>', '[HOMOLOG] U3 Tecnico SST A',
   'f141f880-b820-4e0d-8958-a410734201fa', NULL, false, true,
   ARRAY['cat','pgr','ltcat','ppp','aso','exames','pcmso','funcionarios']),

  -- U4 Operacional Empresa B — somente leitura/operação básica
  ('<EMAIL_REAL_U4>', '[HOMOLOG] U4 Operacional B',
   '8d579cbc-74cf-49d4-a1bf-57026406eb0b',
   'd1c2d18f-0ab1-4898-9160-b53526f35587', false, true,
   ARRAY['funcionarios','entregas','epis']),

  -- U5 Sem permissão — registrado mas sem empresa e sem módulos
  ('<EMAIL_REAL_U5>', '[HOMOLOG] U5 Sem Permissao',
   NULL, NULL, false, true, ARRAY[]::text[])
ON CONFLICT (email) DO UPDATE
  SET nome = EXCLUDED.nome,
      empresa_id = EXCLUDED.empresa_id,
      contrato_id = EXCLUDED.contrato_id,
      is_principal = EXCLUDED.is_principal,
      ativo = EXCLUDED.ativo,
      modulos_permitidos = EXCLUDED.modulos_permitidos;

-- ----------------------------------------------------------------------------
-- 2) usuario_empresas — vínculo multi-empresa (apenas U1, U2, U3, U4)
-- ----------------------------------------------------------------------------
INSERT INTO usuario_empresas (email, empresa_id) VALUES
  -- U1 acessa A e B
  ('<EMAIL_REAL_U1>', 'f141f880-b820-4e0d-8958-a410734201fa'),
  ('<EMAIL_REAL_U1>', '8d579cbc-74cf-49d4-a1bf-57026406eb0b'),
  -- U2 e U3 — apenas Empresa A
  ('<EMAIL_REAL_U2>', 'f141f880-b820-4e0d-8958-a410734201fa'),
  ('<EMAIL_REAL_U3>', 'f141f880-b820-4e0d-8958-a410734201fa'),
  -- U4 — apenas Empresa B
  ('<EMAIL_REAL_U4>', '8d579cbc-74cf-49d4-a1bf-57026406eb0b')
ON CONFLICT DO NOTHING;
-- U5: nenhum vínculo — deve ficar sem acesso

-- ----------------------------------------------------------------------------
-- 3) user_roles — depende de auth.users(id) existir (signup feito em /auth)
-- ----------------------------------------------------------------------------
-- Resolve user_id pelo e-mail real do auth.users
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u WHERE u.email = '<EMAIL_REAL_U1>'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u WHERE u.email = '<EMAIL_REAL_U2>'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT u.id, 'tecnico'::app_role
FROM auth.users u WHERE u.email = '<EMAIL_REAL_U3>'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT u.id, 'usuario'::app_role
FROM auth.users u WHERE u.email = '<EMAIL_REAL_U4>'
ON CONFLICT (user_id, role) DO NOTHING;

-- U5: NENHUMA role intencional (teste de bloqueio)

-- ----------------------------------------------------------------------------
-- 4) Verificação pós-execução (rode antes de COMMIT para conferir)
-- ----------------------------------------------------------------------------
-- SELECT email, empresa_id, is_principal, ativo, modulos_permitidos
--   FROM usuarios_liberados
--   WHERE email IN ('<EMAIL_REAL_U1>','<EMAIL_REAL_U2>','<EMAIL_REAL_U3>','<EMAIL_REAL_U4>','<EMAIL_REAL_U5>')
--   ORDER BY email;
--
-- SELECT email, count(*) AS empresas_vinculadas
--   FROM usuario_empresas
--   WHERE email IN ('<EMAIL_REAL_U1>','<EMAIL_REAL_U2>','<EMAIL_REAL_U3>','<EMAIL_REAL_U4>','<EMAIL_REAL_U5>')
--   GROUP BY email;
--
-- SELECT u.email, ur.role
--   FROM auth.users u JOIN user_roles ur ON ur.user_id = u.id
--   WHERE u.email IN ('<EMAIL_REAL_U1>','<EMAIL_REAL_U2>','<EMAIL_REAL_U3>','<EMAIL_REAL_U4>','<EMAIL_REAL_U5>');

COMMIT;
-- Em caso de problema: ROLLBACK;
