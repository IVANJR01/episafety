/*
 * NAO ESTA EM USO — mantido apenas como copia do conteudo.
 *
 * Esta lista era acrescentada a listagem de Inspecoes de duas empresas, direto
 * no codigo. Como os registros nao existiam no banco, nao davam para excluir
 * nem editar: a exclusao apagava zero linhas e eles voltavam no recarregar.
 *
 * A injecao foi removida (InspecoesSE.tsx). O conteudo virou SQL de importacao
 * em supabase/pendentes/OPCIONAL_INSPECOES_CG3.sql, para o caso de esses
 * registros nunca terem chegado ao banco. Nao volte a ligar este arquivo na
 * tela: dado de empresa mora no banco.
 */
import { Conformidade } from "@/pages/InspecoesSE";

export const CG3_SEED_INSPECOES: Partial<Conformidade>[] = [
  {
    id: "c3300000-0000-4000-8000-000000000001",
    numero: 1,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-07-03",
    local: "SE 69 KV BARROCAS",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Ausência de sistema de trancamentos do quadro elétrico, conforme a NR 18",
    acao_corretiva: "Implementar sistema de trancamento no quadro elétrico para impedir o acesso de trabalhadores não autorizados. Adicionalmente, garantir que os dispositivos de manobra internos possuam condições para bloqueio e sinalização.",
    referencia_normativa: "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-03T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000002",
    numero: 2,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-07-03",
    local: "SE 69 KV BARROCAS",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Tomada com fios expostos, necessidade de colocar conduíte",
    acao_corretiva: "Desenergizar imediatamente o circuito elétrico que alimenta a tomada. Realizar o isolamento adequado e instalar conduítes conforme a NR-10.",
    referencia_normativa: "NR-10 — Item 10.4.2.1 — Partes vivas das instalações elétricas devem ser protegidas",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-03T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000003",
    numero: 3,
    status: "PENDENTE",
    gravidade: "LEVE",
    data_inspecao: "2026-07-03",
    local: "SE 69 KV BARROCAS",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Ausência de cadeado dos armários para colocar epis e portas danificadas",
    acao_corretiva: "Substituir ou reparar imediatamente as portas danificadas dos armários. Instalar ou restaurar os dispositivos para cadeado.",
    referencia_normativa: "NR-24 — Item 24.2.1.1 — Armários individuais devem possuir fechadura ou dispositivo para cadeado",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-03T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000004",
    numero: 4,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-07-03",
    local: "SE 69 KV BARROCAS",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Ausência de diagrama unifilar do quadro elétrico",
    acao_corretiva: "Elaborar, instalar e manter atualizado o diagrama unifilar do quadro elétrico, garantindo sua fácil visualização.",
    referencia_normativa: "NR-10 — Item 10.2.3 — Esquemas unifilares das instalações elétricas",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-03T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000005",
    numero: 5,
    status: "PENDENTE",
    gravidade: "RISCO CRÍTICO",
    data_inspecao: "2026-07-03",
    local: "SE 69 KV BARROCAS",
    responsavel: "OPERACIONAL",
    situacao_detectada: "EPIS DESGATADO BOTA 40",
    acao_corretiva: "Substituir imediatamente a bota de segurança desgastada por um novo EPI adequado.",
    referencia_normativa: "NR-06 — Item 6.6.1 — Calçado de segurança contra riscos de origem térmica e mecânica",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-03T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000006",
    numero: 6,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-07-06",
    local: "SE 69 KV ESTREITO",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Ausência de organização do almoxarifado",
    acao_corretiva: "Realizar organização imediata do almoxarifado, implementando programa 5S. Demarcar áreas de armazenamento.",
    referencia_normativa: "NR-11 — Item 11.2.1 — Armazenamento de materiais deve obedecer a requisitos de segurança",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-06T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000007",
    numero: 7,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-07-06",
    local: "SE 69 KV ESTREITO",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Cabo elétrico não instalado aéreo",
    acao_corretiva: "Realizar a instalação correta do cabo elétrico, elevando-o do solo e utilizando suportes adequados.",
    referencia_normativa: "NR-18 — Item 18.6.13 — Proteção de circuitos elétricos contra contatos acidentais",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-06T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000008",
    numero: 8,
    status: "PENDENTE",
    gravidade: "LEVE",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Ausência de porta copos",
    acao_corretiva: "Instalar porta-copos no alojamento para otimizar o conforto e a organização.",
    referencia_normativa: "Checklist alojamento NEOENERGIA",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000009",
    numero: 9,
    status: "PENDENTE",
    gravidade: "RISCO CRÍTICO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Ausência de instalação de iluminação de emergência",
    acao_corretiva: "Realizar a instalação imediata de sistema de iluminação de emergência em todas as rotas de fuga.",
    referencia_normativa: "NR-23 — Item 23.11.1 — Instalação de iluminação de emergência em locais de trabalho",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000010",
    numero: 10,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Prender canaletas, a mesma está sendo segurada pelos fios",
    acao_corretiva: "Fixar adequadamente as canaletas e os condutores elétricos com suportes e elementos de fixação adequados.",
    referencia_normativa: "NR-10 — Item 10.4.1 — Instalações elétricas devem ser construídas e montadas de forma segura",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000011",
    numero: 11,
    status: "PENDENTE",
    gravidade: "RISCO CRÍTICO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "OPERACIONAL",
    situacao_detectada: "O local do varal foi feito na cozinha, totalmente proibido conforme checklist neoenergia",
    acao_corretiva: "Remover imediatamente o varal da cozinha, realocando-o para uma área externa apropriada.",
    referencia_normativa: "NR-24 — Item 24.1.1 — Manutenção das condições sanitárias e de conforto nos locais de trabalho",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000012",
    numero: 12,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Ausência de canaleta para fios, acesso a escada de saída para rua.",
    acao_corretiva: "Instalar imediatamente canaletas e conduítes de proteção mecânica nos condutores elétricos.",
    referencia_normativa: "NR-18 — Item 18.6.19 — Condutores elétricos devem ser protegidos e organizados",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000013",
    numero: 13,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Ausência de instalação de chuveiro elétrico conforme checklist Neoenergia",
    acao_corretiva: "Instalar chuveiro elétrico conforme os padrões de segurança e especificações técnicas.",
    referencia_normativa: "NR-10 — Item 10.4.1 — Instalações elétricas seguras",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000014",
    numero: 14,
    status: "PENDENTE",
    gravidade: "LEVE",
    data_inspecao: "2026-07-07",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "OPERACIONAL",
    situacao_detectada: "Extintor antigo no alojamento",
    acao_corretiva: "Retirar o extintor antigo e substituir por equipamento dentro da validade de carga.",
    referencia_normativa: "NR-23 — Proteção Contra Incêndios",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-07-07T10:00:00.000Z"
  },
  {
    id: "c3300000-0000-4000-8000-000000000015",
    numero: 15,
    status: "PENDENTE",
    gravidade: "MODERADO",
    data_inspecao: "2026-06-08",
    local: "ALOJAMENTO - ALTO RODRIGUES",
    responsavel: "EQUIPE ELÉTRICA",
    situacao_detectada: "Substituir tomada, tomada danificada.",
    acao_corretiva: "Desenergizar o circuito e realizar a substituição da tomada danificada por um novo conjunto adequado.",
    referencia_normativa: "NR-10 — Item 10.4.1 — Prevenção de riscos de choque elétrico",
    empresa_id: "814c58d9-17c9-4e18-8d19-9d0e07210834",
    created_at: "2026-06-08T10:00:00.000Z"
  }
];
