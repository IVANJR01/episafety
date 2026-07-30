-- ============================================================================
-- Inspeções da CG3 que estavam escritas dentro do código
-- ============================================================================
-- CONTEXTO
--
-- A tela de Inspeções acrescentava à listagem 15 registros que estavam
-- escritos no próprio código do aplicativo, não no banco. Por isso eles não
-- podiam ser excluídos nem editados: a exclusão apagava zero linhas, o aviso
-- dizia "Registro excluído" e ao recarregar eles voltavam.
--
-- Essa injeção foi removida. A listagem agora mostra apenas o que está no
-- banco.
--
-- QUANDO RODAR ESTE ARQUIVO
--
-- Só se, depois da atualização, esses registros tiverem SUMIDO da tela — o que
-- significa que nunca chegaram ao banco. Rodando este script eles passam a
-- existir de verdade e voltam a aparecer, agora podendo ser editados e
-- excluídos normalmente.
--
-- Se eles continuarem aparecendo normalmente, NÃO rode: já estão no banco e
-- este script não faria nada (os ids são os mesmos e há ON CONFLICT).
--
-- Seguro rodar mais de uma vez: ON CONFLICT (id) DO NOTHING.
-- ============================================================================

BEGIN;

INSERT INTO public.conformidades
  (id, numero, status, gravidade, data_inspecao, local, responsavel, situacao_detectada, acao_corretiva, referencia_normativa, empresa_id, created_at)
VALUES
  ('c3300000-0000-4000-8000-000000000001', 1, 'PENDENTE', 'MODERADO', '2026-07-03', 'SE 69 KV BARROCAS', 'OPERACIONAL', 'Ausência de sistema de trancamentos do quadro elétrico, conforme a NR 18', 'Implementar sistema de trancamento no quadro elétrico para impedir o acesso de trabalhadores não autorizados. Adicionalmente, garantir que os dispositivos de manobra internos possuam condições para bloqueio e sinalização.', 'NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-03T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000002', 2, 'PENDENTE', 'MODERADO', '2026-07-03', 'SE 69 KV BARROCAS', 'OPERACIONAL', 'Tomada com fios expostos, necessidade de colocar conduíte', 'Desenergizar imediatamente o circuito elétrico que alimenta a tomada. Realizar o isolamento adequado e instalar conduítes conforme a NR-10.', 'NR-10 — Item 10.4.2.1 — Partes vivas das instalações elétricas devem ser protegidas', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-03T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000003', 3, 'PENDENTE', 'LEVE', '2026-07-03', 'SE 69 KV BARROCAS', 'OPERACIONAL', 'Ausência de cadeado dos armários para colocar epis e portas danificadas', 'Substituir ou reparar imediatamente as portas danificadas dos armários. Instalar ou restaurar os dispositivos para cadeado.', 'NR-24 — Item 24.2.1.1 — Armários individuais devem possuir fechadura ou dispositivo para cadeado', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-03T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000004', 4, 'PENDENTE', 'MODERADO', '2026-07-03', 'SE 69 KV BARROCAS', 'EQUIPE ELÉTRICA', 'Ausência de diagrama unifilar do quadro elétrico', 'Elaborar, instalar e manter atualizado o diagrama unifilar do quadro elétrico, garantindo sua fácil visualização.', 'NR-10 — Item 10.2.3 — Esquemas unifilares das instalações elétricas', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-03T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000005', 5, 'PENDENTE', 'RISCO CRÍTICO', '2026-07-03', 'SE 69 KV BARROCAS', 'OPERACIONAL', 'EPIS DESGATADO BOTA 40', 'Substituir imediatamente a bota de segurança desgastada por um novo EPI adequado.', 'NR-06 — Item 6.6.1 — Calçado de segurança contra riscos de origem térmica e mecânica', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-03T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000006', 6, 'PENDENTE', 'MODERADO', '2026-07-06', 'SE 69 KV ESTREITO', 'OPERACIONAL', 'Ausência de organização do almoxarifado', 'Realizar organização imediata do almoxarifado, implementando programa 5S. Demarcar áreas de armazenamento.', 'NR-11 — Item 11.2.1 — Armazenamento de materiais deve obedecer a requisitos de segurança', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-06T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000007', 7, 'PENDENTE', 'MODERADO', '2026-07-06', 'SE 69 KV ESTREITO', 'EQUIPE ELÉTRICA', 'Cabo elétrico não instalado aéreo', 'Realizar a instalação correta do cabo elétrico, elevando-o do solo e utilizando suportes adequados.', 'NR-18 — Item 18.6.13 — Proteção de circuitos elétricos contra contatos acidentais', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-06T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000008', 8, 'PENDENTE', 'LEVE', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL', 'Ausência de porta copos', 'Instalar porta-copos no alojamento para otimizar o conforto e a organização.', 'Checklist alojamento NEOENERGIA', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000009', 9, 'PENDENTE', 'RISCO CRÍTICO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA', 'Ausência de instalação de iluminação de emergência', 'Realizar a instalação imediata de sistema de iluminação de emergência em todas as rotas de fuga.', 'NR-23 — Item 23.11.1 — Instalação de iluminação de emergência em locais de trabalho', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000010', 10, 'PENDENTE', 'MODERADO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA', 'Prender canaletas, a mesma está sendo segurada pelos fios', 'Fixar adequadamente as canaletas e os condutores elétricos com suportes e elementos de fixação adequados.', 'NR-10 — Item 10.4.1 — Instalações elétricas devem ser construídas e montadas de forma segura', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000011', 11, 'PENDENTE', 'RISCO CRÍTICO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL', 'O local do varal foi feito na cozinha, totalmente proibido conforme checklist neoenergia', 'Remover imediatamente o varal da cozinha, realocando-o para uma área externa apropriada.', 'NR-24 — Item 24.1.1 — Manutenção das condições sanitárias e de conforto nos locais de trabalho', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000012', 12, 'PENDENTE', 'MODERADO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA', 'Ausência de canaleta para fios, acesso a escada de saída para rua.', 'Instalar imediatamente canaletas e conduítes de proteção mecânica nos condutores elétricos.', 'NR-18 — Item 18.6.19 — Condutores elétricos devem ser protegidos e organizados', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000013', 13, 'PENDENTE', 'MODERADO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA', 'Ausência de instalação de chuveiro elétrico conforme checklist Neoenergia', 'Instalar chuveiro elétrico conforme os padrões de segurança e especificações técnicas.', 'NR-10 — Item 10.4.1 — Instalações elétricas seguras', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000014', 14, 'PENDENTE', 'LEVE', '2026-07-07', 'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL', 'Extintor antigo no alojamento', 'Retirar o extintor antigo e substituir por equipamento dentro da validade de carga.', 'NR-23 — Proteção Contra Incêndios', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-07-07T10:00:00.000Z'),
  ('c3300000-0000-4000-8000-000000000015', 15, 'PENDENTE', 'MODERADO', '2026-06-08', 'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA', 'Substituir tomada, tomada danificada.', 'Desenergizar o circuito e realizar a substituição da tomada danificada por um novo conjunto adequado.', 'NR-10 — Item 10.4.1 — Prevenção de riscos de choque elétrico', '814c58d9-17c9-4e18-8d19-9d0e07210834', '2026-06-08T10:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
