-- ============================================================================
-- Restauração das 22 inspeções da CG3 — extraídas do relatório original
-- ============================================================================
-- ORIGEM
--
-- Relatório de Inspeção de Segurança emitido em 07/07/2026 às 09:35, período
-- de 01/06/2026 a 07/07/2026, 22 inspeções. O texto de cada registro foi lido
-- do próprio PDF — situação detectada, ação corretiva, referência normativa,
-- data, local, responsável e gravidade — e não da cópia que estava no código,
-- que tinha só 15 e não trazia a de número 22.
--
-- POR LOCAL
--    9  ALOJAMENTO - ALTO RODRIGUES
--    6  SE 69 KV BARROCAS
--    5  ALOJAMENTO - MOSSORO
--    2  SE 69 KV ESTREITO
--
-- Barrocas são as de número 1, 2, 3, 4, 5, 22.
--
-- EMPRESA DE DESTINO
--
-- CG3 ENGENHARIA LTDA (75447c33…), a ativa no seletor e dona da obra Barrocas.
-- Para gravar em outra, troque só o valor de v_empresa.
--
-- AS FOTOS
--
-- As 22 fotos "ANTES" também foram recuperadas do PDF, uma por inspeção, e
-- vão em arquivos separados (insp_001.jpg … insp_022.jpg). Elas precisam ser
-- anexadas pela tela, item a item — este script grava só os dados.
--
-- Seguro rodar mais de uma vez: ON CONFLICT (id) DO NOTHING.
-- ============================================================================

DO $$
DECLARE
  v_empresa uuid := '75447c33-0960-46db-ba59-00327575fe44';  -- CG3 ENGENHARIA LTDA
BEGIN
  INSERT INTO public.conformidades
    (id, numero, status, gravidade, data_inspecao, local, responsavel,
     situacao_detectada, acao_corretiva, referencia_normativa, empresa_id, created_at)
  VALUES

    ('c3300000-0000-4000-8000-000000000001', 1, 'PENDENTE', 'MODERADO', '2026-07-03'::date,
     'SE 69 KV BARROCAS', 'OPERACIONAL',
     'Ausência de sistema de trancamentos do quadro elétrico, conforme a NR 18',
     'Implementar sistema de trancamento no quadro elétrico para impedir o acesso de trabalhadores não autorizados. Adicionalmente, garantir que os dispositivos de manobra internos possuam condições para bloqueio e sinalização, e que o acesso seja restrito apenas a pessoal qualificado e autorizado.',
     'NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas contra acesso de trabalhadores não autorizados.', v_empresa, '2026-07-03T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000002', 2, 'PENDENTE', 'MODERADO', '2026-07-03'::date,
     'SE 69 KV BARROCAS', '—',
     'Tomada com fios expostos, necessidade de colocar conduíte',
     'Desenergizar imediatamente o circuito elétrico que alimenta a tomada. Realizar o isolamento adequado dos fios expostos e instalar conduítes ou outro invólucro conforme a NR-10 para garantir a proteção contra contatos acidentais. Após a correção, verificar a integridade da instalação e reenergizar.',
     'NR-10 — Item 10.4.2.1 — Partes vivas das instalações elétricas devem ser protegidas contra contato acidental.', v_empresa, '2026-07-03T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000003', 3, 'PENDENTE', 'LEVE', '2026-07-03'::date,
     'SE 69 KV BARROCAS', '—',
     'Ausência de cadeado dos armários para colocar epis e portas danificadas',
     'Substituir ou reparar imediatamente as portas danificadas dos armários. Instalar ou restaurar os dispositivos para cadeado em todos os armários, garantindo a segurança dos pertences e a adequada guarda dos EPIs. CG3 ENGENHARIA LTDA · Página 2 ===PAGINA===',
     'NR-24 — Item 24.2.1.1 — Armários individuais devem possuir fechadura ou dispositivo para cadeado. NR-24 — Item 24.2.3.1 — Armários devem ser mantidos em bom estado de conservação.', v_empresa, '2026-07-03T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000004', 4, 'PENDENTE', 'MODERADO', '2026-07-03'::date,
     'SE 69 KV BARROCAS', '—',
     'Ausência de diagrama unifilar do quadro elétrico',
     'Elaborar, instalar e manter atualizado o diagrama unifilar do quadro elétrico, garantindo sua fácil consulta por profissionais autorizados e qualificados que atuem nas instalações.',
     'NR-10 — Item 10.4.1(a) — As instalações elétricas devem possuir diagramas unifilares atualizados.', v_empresa, '2026-07-03T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000005', 5, 'PENDENTE', 'RISCO CRÍTICO', '2026-07-03'::date,
     'SE 69 KV BARROCAS', '—',
     'EPIS DESGATADO BOTA 40',
     'Substituir imediatamente a bota de segurança desgastada por um novo EPI, garantindo que seja adequado ao risco e ao tamanho do trabalhador. Reforçar a importância da conservação e do uso correto do EPI.',
     'NR-06 — Item 6.3(III) — Empregador deve substituir imediatamente EPI danificado.', v_empresa, '2026-07-03T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000006', 6, 'PENDENTE', 'MODERADO', '2026-07-06'::date,
     'SE 69 KV ESTREITO', 'OPERACIONAL',
     'Ausência de organização do almoxarifado',
     'Realizar organização imediata do almoxarifado, implementando um programa de 5S. Demarcar áreas de armazenamento e circulação. Treinar os colaboradores sobre os procedimentos de organização e manutenção do local. CG3 ENGENHARIA LTDA · Página 4 ===PAGINA===',
     'NR-11 — Item 11.2.1 — Armazenamento de materiais deve obedecer a requisitos de segurança. NR-11 — Item 11.2.4 — Materiais não podem impedir a circulação de pessoas.', v_empresa, '2026-07-06T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000007', 7, 'PENDENTE', 'MODERADO', '2026-07-06'::date,
     'SE 69 KV ESTREITO', 'OPERACIONAL',
     'Cabo elétrico não instalado aéreo',
     'Realizar a instalação correta do cabo elétrico, elevando-o do solo e utilizando suportes adequados ou eletrocalhas/bandejas para protegê-lo contra danos mecânicos, umidade e contatos acidentais. Inspecionar o cabo quanto a danos e substituir se necessário.',
     'NR-18 — Item 18.6.13 — Proteção de circuitos elétricos contra contatos acidentais e danos mecânicos. NR-10 — Item 10.2.8.2 — Proteção de cabos e condutores contra impactos mecânicos e intempéries.', v_empresa, '2026-07-06T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000008', 8, 'PENDENTE', 'LEVE', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL',
     'Ausência de porta copos',
     'Avaliar a necessidade e viabilidade de instalação de porta-copos para otimizar o conforto e a organização do alojamento',
     'Checklist alojamento NEOENERGIA', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000009', 9, 'PENDENTE', 'RISCO CRÍTICO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Ausência de instalação de iluminação de emergência',
     'Realizar a instalação imediata de sistema de iluminação de emergência em todas as rotas de fuga e áreas de permanência, seguindo as diretrizes da NBR 10898. CG3 ENGENHARIA LTDA · Página 6 ===PAGINA===',
     'NR-23 — Item 23.11.1 — Instalação de iluminação de emergência em locais de trabalho.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000010', 10, 'PENDENTE', 'MODERADO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Prender canaletas, a mesma está sendo segurada pelos fios',
     'As canaletas e os condutores elétricos devem ser fixados adequadamente com suportes e elementos de fixação apropriados, de modo que os fios não suportem o peso da canaleta. Avaliar e reparar possíveis danos na isolação dos condutores devido à sobrecarga anterior.',
     'NR-10 — Item 10.4.1 — Instalações elétricas devem ser construídas e montadas de forma segura para prevenir riscos.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000011', 11, 'PENDENTE', 'RISCO CRÍTICO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL',
     'O local do varal foi feito na cozinha, totalmente proibido conforme checklist neoenergia',
     'Remover imediatamente o varal da cozinha, realocando-o para uma área apropriada que não comprometa a higiene e a segurança alimentar. Garantir que todas as áreas de preparação e consumo de alimentos estejam livres de elementos que possam causar contaminação ou obstrução.',
     'NR-24 — Item 24.1.1 — Manutenção das condições sanitárias e de conforto nos locais de trabalho.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000012', 12, 'PENDENTE', 'MODERADO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Ausência de canaleta para fios, acesso a escada de saída para rua.',
     'Realizar a instalação imediata de canaletas, conduítes ou outro tipo de proteção mecânica adequada para todos os fios expostos. Garantir que não existam partes vivas acessíveis e que os condutores estejam organizados para eliminar riscos de choque elétrico e tropeços, especialmente na área da escada de saída. CG3 ENGENHARIA LTDA · Página 8 ===PAGINA===',
     'NR-18 — Item 18.6.19 — Condutores elétricos devem ser protegidos e organizados para evitar acidentes. NR-18 — Item 18.6.2 — Proibição de partes vivas expostas. NR-10 — Item 10.4.1 — Instalações elétricas devem prevenir acidentes.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000013', 13, 'PENDENTE', 'MODERADO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Ausência de instalação de chuveiro elétrico conforme checklist Neoenergia',
     'Instalar chuveiro elétrico.',
     'NR-10 — Item 10.4.1 — Instalações elétricas devem ser construídas, montadas, operadas, inspecionadas e mantidas para prevenir acidentes. NR-10 — Item 10.4.2 — Instalações elétricas devem ser projetadas e construídas com segurança para trabalhadores e usuários.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000014', 14, 'PENDENTE', 'LEVE', '2026-07-07'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'OPERACIONAL',
     'Extintor antigo no alojamento',
     'Retirar e entregar o dono do imóvel',
     NULL, v_empresa, '2026-07-07T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000015', 15, 'PENDENTE', 'MODERADO', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Substituir tomada, tomada danificada.',
     'Desenergizar imediatamente o circuito da tomada danificada. Realizar a substituição da tomada por outra em conformidade com as normas técnicas aplicáveis, garantindo que a instalação elétrica retorne às condições seguras de funcionamento e eliminando o risco de choque elétrico, curto-circuito ou incêndio. CG3 ENGENHARIA LTDA · Página 10 ===PAGINA===',
     'NR-10 — Item 10.4.1 — Instalações elétricas devem prevenir riscos de choque e queimaduras. NR-10 — Item 10.4.2 — Instalações elétricas devem ser mantidas em condições seguras de funcionamento.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000016', 16, 'PENDENTE', 'GRAVE', '2026-06-08'::date,
     'ALOJAMENTO - ALTO RODRIGUES', 'EQUIPE ELÉTRICA',
     'Melhorar a instalação elétrica',
     'Realizar uma melhoria da instalação elétrica',
     'NR-10 — Item a confirmar pelo responsável técnico — Adequação das instalações elétricas para garantir a segurança.', v_empresa, '2026-06-08T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000017', 17, 'PENDENTE', 'LEVE', '2026-07-06'::date,
     'ALOJAMENTO - MOSSORO', 'OPERACIONAL',
     'Geladeira danificada',
     'Retirar geladeira danificada do alojamento',
     NULL, v_empresa, '2026-07-06T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000018', 18, 'PENDENTE', 'RISCO CRÍTICO', '2026-06-14'::date,
     'ALOJAMENTO - MOSSORO', 'EQUIPE ELÉTRICA',
     'Ausência chuveiro elétrico conforme checklist Neoenergia',
     'Instalar chuveiro',
     'NR-10 — Item 10.4.1 — Instalações elétricas devem prevenir acidentes elétricos e assegurar segurança e saúde. NR-10 — Item 10.4.2.1(c) — Medidas de proteção coletiva: Dispositivos Diferenciais Residuais (DR). NR-10 — Item 10.4.2.1(f) — Medidas de proteção coletiva: Aterramento.', v_empresa, '2026-06-14T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000019', 19, 'PENDENTE', 'LEVE', '2026-06-14'::date,
     'ALOJAMENTO - MOSSORO', 'OPERACIONAL',
     'Retirar ar-condicionado da garagem',
     'Retirar ar-condicionado da garagem',
     'N.A', v_empresa, '2026-06-14T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000020', 20, 'PENDENTE', 'GRAVE', '2026-06-14'::date,
     'ALOJAMENTO - MOSSORO', 'EQUIPE ELÉTRICA',
     'Tomada 220 volts danificada',
     'Desenergizar imediatamente o circuito, isolar a tomada danificada e providenciar sua substituição por eletricista qualificado. A tomada não deve ser utilizada antes da correção. CG3 ENGENHARIA LTDA · Página 13 ===PAGINA===',
     'NR-10 — Item 10.4.1 — Instalações elétricas seguras e íntegras.', v_empresa, '2026-06-14T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000021', 21, 'PENDENTE', 'GRAVE', '2026-06-14'::date,
     'ALOJAMENTO - MOSSORO', 'SETOR DE COMPRAS',
     '3 Capas de camas danificadas',
     'Substituir imediatamente as três capas de camas danificadas, garantindo que as roupas de cama fornecidas aos trabalhadores estejam em boas condições de uso e higiene, conforme exigido pela norma.',
     'NR-24 — Item 24.5.2(c) — Camas ou beliches devem possuir roupas de cama limpas.', v_empresa, '2026-06-14T10:00:00Z'::timestamptz),
    ('c3300000-0000-4000-8000-000000000022', 22, 'PENDENTE', 'MODERADO', '2026-06-03'::date,
     'SE 69 KV BARROCAS', 'EQUIPE ELÉTRICA',
     'Ausência de instalação de sirene',
     'Instalar sistema de alarme audível em todas as áreas do estabelecimento, garantindo que o acionamento seja possível e que o código de identificação da natureza da emergência seja conhecido pelos trabalhadores.',
     'NR-23 — Item 23.4.1 — Sistemas de alarme devem ser audíveis em todas as áreas e possuir código de identificação da emergência.', v_empresa, '2026-06-03T10:00:00Z'::timestamptz)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Confere o que ficou:
SELECT local, count(*) AS registros, min(numero) AS de, max(numero) AS ate
  FROM public.conformidades
 GROUP BY local
 ORDER BY local;
