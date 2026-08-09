-- =====================================================================
-- Grava no banco os locais que só existiam dentro do código-fonte
--
-- `src/lib/obrasSeed.ts` traz 15 obras com empresa_id chumbado, e a tela
-- de Cadastro de Local as juntava às do banco só na exibição. O efeito
-- era uma tela que parecia cadastro e não era: Editar devolvia
-- "new row violates row-level security policy for table obras", Excluir
-- respondia "este local ainda não foi salvo", e as inspeções ligadas a
-- obra apareciam sem local.
--
-- Existe uma rotina no aplicativo que tenta gravá-las ao abrir a tela
-- (gravarObrasDoCodigo, em src/lib/obras.ts), mas ela roda como usuário
-- comum e vinha esbarrando na política de RLS. Aqui a gravação acontece
-- na migration, que roda como dono do banco — RLS não a alcança.
--
-- A correção da própria política está em
-- 20260808080000_fix_obras_rls_get_user_empresa_ids.sql. As duas são
-- necessárias: esta traz os dados, aquela devolve a permissão.
--
-- Idempotente pela mesma chave que a tela já usava para não duplicar na
-- exibição: (empresa_id, nome sem diferenciar maiúsculas). Rodar de novo
-- não insere nada e não apaga nada.
-- =====================================================================

WITH novos (empresa_id, nome, codigo, endereco, cidade, uf, status, observacoes) AS (
  VALUES
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'SE 69 KV BARROCAS', 'OBR-001', 'Subestação Barrocas', 'Barrocas', 'RN', 'ATIVA', 'Subestação 69 kV Barrocas — CG3 Engenharia'),
  ('814c58d9-17c9-4e18-8d19-9d0e07210834'::uuid, 'SE 69 KV ESTREITO', 'OBR-002', 'Subestação Estreito', 'Estreito', 'RN', 'ATIVA', 'Subestação 69 kV Estreito — CG3 Engenharia / RN'),
  ('814c58d9-17c9-4e18-8d19-9d0e07210834'::uuid, 'SE JARDIM DE PIRANHAS', 'OBR-003', 'Subestação Jardim de Piranhas', 'Jardim de Piranhas', 'RN', 'ATIVA', 'Subestação Jardim de Piranhas — CG3 Engenharia / RN'),
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'ALOJAMENTO - ALTO RODRIGUES', 'OBR-004', 'Alojamento Alto Rodrigues', 'Alto Rodrigues', 'RN', 'ATIVA', 'Alojamento Operacional Neoenergia'),
  ('75447c33-0960-46db-ba59-00327575fe44'::uuid, 'ALOJAMENTO - MOSSORO', 'OBR-005', 'Alojamento Mossoró', 'Mossoró', 'RN', 'ATIVA', 'Alojamento Operacional Mossoró'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'CASTANHÃO', 'OBR-G01', 'Unidade Castanhão', 'Iracema', 'CE', 'ATIVA', 'Unidade Operacional Castanhão'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'ALTO SANTO', 'OBR-G02', 'Unidade Alto Santo', 'Alto Santo', 'CE', 'ATIVA', 'Unidade Operacional Alto Santo'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'POTIRETAMA', 'OBR-G03', 'Unidade Potiretama', 'Potiretama', 'CE', 'ATIVA', 'Unidade Operacional Potiretama'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'BORDADO', 'OBR-G04', 'Setor de Bordado', 'Iracema', 'CE', 'ATIVA', 'Setor de Bordado G91'),
  ('40d91cc4-ce68-4cb9-804b-a13db6cc3453'::uuid, 'ESTAMPARIA', 'OBR-G05', 'Setor de Estamparia', 'Iracema', 'CE', 'ATIVA', 'Setor de Estamparia G91'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'COSTURA', 'OBR-L01', 'Setor de Costura', NULL, NULL, 'ATIVA', 'Setor de Costura'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'PASSADORIA', 'OBR-L02', 'Setor de Passadoria', NULL, NULL, 'ATIVA', 'Setor de Passadoria'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'MÁQ. TAQ / PASSADORIA', 'OBR-L03', 'Setor Máquinas Taquete / Passadoria', NULL, NULL, 'ATIVA', 'Setor de Máquinas Taquete'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'ESTAMPARIA', 'OBR-L04', 'Setor de Estamparia', NULL, NULL, 'ATIVA', 'Setor de Estamparia'),
  ('d3419ac5-f4fe-4309-bf45-0e104ac04f3a'::uuid, 'TECELAGEM', 'OBR-L05', 'Setor de Tecelagem', NULL, NULL, 'ATIVA', 'Setor de Tecelagem')
)
INSERT INTO public.obras (empresa_id, nome, codigo, endereco, cidade, uf, status, observacoes)
SELECT n.empresa_id, n.nome, n.codigo, n.endereco, n.cidade, n.uf, n.status, n.observacoes
FROM novos n
WHERE NOT EXISTS (
  SELECT 1 FROM public.obras o
  WHERE o.empresa_id = n.empresa_id
    AND lower(trim(o.nome)) = lower(trim(n.nome))
);
