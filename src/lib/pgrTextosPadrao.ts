// Catálogo de seções e textos padrão do PGR — SafetySoluções
// A ordem aqui é a ordem de renderização no PDF.

export interface PgrSecaoDef {
  key: string;
  titulo: string;
  padrao: string;
}

export const PGR_SECOES: PgrSecaoDef[] = [
  {
    key: "introducao",
    titulo: "Introdução",
    padrao:
      "Este Programa de Gerenciamento de Riscos (PGR) foi elaborado em conformidade com a Norma Regulamentadora NR-01 do Ministério do Trabalho e Emprego, com o objetivo de estabelecer as diretrizes para o gerenciamento dos riscos ocupacionais existentes ou que possam vir a existir no ambiente de trabalho, promovendo a preservação da saúde e integridade física dos trabalhadores.",
  },
  {
    key: "apresentacao",
    titulo: "Apresentação",
    padrao:
      "O presente documento apresenta o inventário de riscos ocupacionais e o plano de ação da empresa, contemplando as etapas de identificação de perigos, avaliação de riscos, controle e monitoramento das medidas de prevenção adotadas.",
  },
  {
    key: "registro_divulgacao",
    titulo: "Registro e divulgação dos dados",
    padrao:
      "O PGR e seus documentos correlatos estarão disponíveis para consulta dos trabalhadores, representantes da CIPA, auditorias e órgãos fiscalizadores. As informações serão divulgadas por meio de treinamentos, diálogos diários de segurança (DDS) e demais canais de comunicação interna.",
  },
  {
    key: "objetivo_geral",
    titulo: "Objetivo geral",
    padrao:
      "Estabelecer procedimentos para a antecipação, reconhecimento, avaliação e controle da ocorrência de riscos ambientais existentes ou que venham a existir no ambiente de trabalho, visando à preservação da saúde e integridade dos trabalhadores.",
  },
  {
    key: "objetivos_especificos",
    titulo: "Objetivos específicos",
    padrao:
      "• Identificar os riscos ocupacionais existentes em cada ambiente e função;\n• Avaliar a exposição dos trabalhadores aos agentes de risco;\n• Definir medidas de prevenção e controle;\n• Elaborar plano de ação com prazos, responsáveis e recursos necessários;\n• Monitorar a eficácia das medidas implementadas.",
  },
  {
    key: "politica_seguranca",
    titulo: "Política de segurança",
    padrao:
      "A empresa reconhece a segurança e saúde no trabalho como valor essencial, compromete-se em cumprir a legislação vigente, prevenir acidentes e doenças ocupacionais, e promover a melhoria contínua das condições de trabalho.",
  },
  {
    key: "resp_empregador",
    titulo: "Cabe ao empregador",
    padrao:
      "• Cumprir e fazer cumprir as normas de segurança e saúde no trabalho;\n• Implementar as medidas de prevenção previstas neste PGR;\n• Fornecer EPIs adequados e em perfeito estado de conservação;\n• Prestar informações aos trabalhadores sobre os riscos e as medidas de controle;\n• Manter registros atualizados dos riscos e das medidas implementadas.",
  },
  {
    key: "resp_empregados",
    titulo: "Cabe aos empregados",
    padrao:
      "• Cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho;\n• Utilizar corretamente os EPIs fornecidos pela empresa;\n• Comunicar ao empregador qualquer situação de risco identificada;\n• Colaborar com a empresa na aplicação deste PGR.",
  },
  {
    key: "seguranca_trabalho",
    titulo: "Segurança do Trabalho",
    padrao:
      "As ações de segurança do trabalho são conduzidas pelo Serviço Especializado em Engenharia de Segurança e Medicina do Trabalho (SESMT), quando aplicável, ou pelo profissional legalmente habilitado responsável técnico pelo PGR.",
  },
  {
    key: "cipa",
    titulo: "CIPA, quando aplicável",
    padrao:
      "A Comissão Interna de Prevenção de Acidentes (CIPA), quando exigida pela NR-05, atua em conjunto com o SESMT e a direção da empresa na identificação de riscos, proposição de melhorias e acompanhamento das ações preventivas.",
  },
  {
    key: "consideracoes_preliminares",
    titulo: "Considerações preliminares",
    padrao:
      "O reconhecimento dos riscos foi realizado por meio de inspeção in loco, entrevistas com trabalhadores e análise dos processos produtivos. A avaliação dos riscos utilizou a Matriz 5×5 (Severidade × Probabilidade) apresentada neste documento.",
  },
  {
    key: "area_abrangencia",
    titulo: "Área de abrangência do PGR na empresa",
    padrao:
      "Este PGR abrange todas as áreas, setores, funções e trabalhadores vinculados à unidade descrita na identificação da empresa, incluindo funcionários próprios, terceirizados sob gestão da empresa e prestadores de serviço.",
  },
  {
    key: "recomendacoes",
    titulo: "Recomendações à empresa",
    padrao:
      "• Cumprir integralmente o plano de ação apresentado;\n• Revisar este PGR sempre que houver modificação nos processos, ambientes ou funções, e no mínimo a cada 2 anos;\n• Manter registros de treinamentos, entregas de EPI, exames ocupacionais e ordens de serviço;\n• Investigar todos os acidentes e incidentes ocorridos.",
  },
  {
    key: "consideracoes_finais",
    titulo: "Considerações finais",
    padrao:
      "As conclusões e recomendações deste PGR baseiam-se nas condições observadas no momento da avaliação. Alterações nos processos, layout, matérias-primas ou quadro funcional podem exigir revisão antecipada do documento.",
  },
  {
    key: "encerramento",
    titulo: "Encerramento",
    padrao:
      "Encerra-se o presente Programa de Gerenciamento de Riscos, elaborado por profissional legalmente habilitado, assumindo o responsável técnico a autoria das informações técnicas nele contidas.",
  },
];

export const PGR_SECAO_TITULO: Record<string, string> = Object.fromEntries(
  PGR_SECOES.map((s) => [s.key, s.titulo])
);
export const PGR_SECAO_PADRAO: Record<string, string> = Object.fromEntries(
  PGR_SECOES.map((s) => [s.key, s.padrao])
);
