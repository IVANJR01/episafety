-- =====================================================================
-- GRAVAR OS LOCAIS NO BANCO — rode inteiro no SQL Editor do Supabase
--
-- O SQL Editor roda como dono do banco, então RLS não bloqueia nada aqui.
-- É por isso que este arquivo resolve mesmo com a permissão do aplicativo
-- ainda errada — e a PARTE 2 conserta a permissão para não voltar.
--
-- Pode rodar mais de uma vez: nada é duplicado e nada é apagado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE 1 — Grava os 15 locais que hoje só existem dentro do código
--
-- Não insere de novo o que já estiver lá: a chave é (empresa, nome).
-- ---------------------------------------------------------------------

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

-- Confira o que ficou gravado:
SELECT o.codigo, o.nome, o.cidade, o.uf, o.status, e.nome AS empresa
FROM public.obras o
LEFT JOIN public.empresa_config e ON e.id = o.empresa_id
ORDER BY e.nome, o.codigo;


-- ---------------------------------------------------------------------
-- PARTE 2 — Corrige a permissão (RLS) da tabela obras
--
-- Sem isto, o aplicativo continua sem conseguir ler, editar nem excluir
-- local, e o erro "new row violates row-level security policy" volta.
-- ---------------------------------------------------------------------

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Obras select por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras insert por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras update por empresa" ON public.obras;
DROP POLICY IF EXISTS "Obras delete por empresa" ON public.obras;

CREATE POLICY "Obras select por empresa" ON public.obras
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras insert por empresa" ON public.obras
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras update por empresa" ON public.obras
FOR UPDATE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Obras delete por empresa" ON public.obras
FOR DELETE TO authenticated
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.id = auth.uid())
  OR empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.email = (auth.jwt() ->> 'email'))
  OR empresa_id = ANY (public.get_user_empresa_ids((auth.jwt() ->> 'email')))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);


-- ---------------------------------------------------------------------
-- PARTE 2B — Super Admin (esta é a que faz o seu erro parar)
--
-- As policies acima reconhecem administrador só por has_role(...,'admin').
-- O aplicativo trata como Super Admin quem passa em is_super_admin(), ou
-- tem papel 'super_admin'/'superadmin', ou é principal em
-- usuarios_liberados. Quem é Super Admin por um desses caminhos, e não
-- tem vínculo explícito com a empresa, não satisfazia nenhum ramo — e era
-- exatamente esse o "new row violates row-level security policy".
--
-- Mesmo padrão que empresa_config, epis, funcionarios e entregas já usam.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admin full access obras" ON public.obras;
CREATE POLICY "Super admin full access obras" ON public.obras
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Confira que você é reconhecido como Super Admin (tem que voltar true):
-- SELECT public.is_super_admin(auth.uid());


-- ---------------------------------------------------------------------
-- PARTE 3 — Inspeções que ficaram apontando para obra inexistente
--
-- Primeiro veja quantas são. Se der 0, não há nada a fazer aqui.
-- ---------------------------------------------------------------------

SELECT count(*) AS inspecoes_sem_obra_valida
FROM public.conformidades c
LEFT JOIN public.obras o ON o.id = c.obra_id
WHERE c.obra_id IS NOT NULL AND o.id IS NULL;

-- Se o número acima for maior que zero, estas inspeções apontam para uma
-- obra que não existe mais. O nome da obra não está guardado na inspeção,
-- então não dá para adivinhar qual era — o caminho é reabrir cada uma e
-- escolher a obra na lista, que agora estará preenchida.
-- Para ver quais são:
--
-- SELECT c.numero, c.data_inspecao, c.situacao_detectada, c.obra_id
-- FROM public.conformidades c
-- LEFT JOIN public.obras o ON o.id = c.obra_id
-- WHERE c.obra_id IS NOT NULL AND o.id IS NULL
-- ORDER BY c.numero;
