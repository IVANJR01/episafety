/*
 * Estrutura e textos dos seis documentos SST.
 *
 * ESTE ARQUIVO É GERADO a partir de ferramentas/documentos/gerador/docs.js —
 * o original do pacote, que continua sendo a fonte. Para mudar um texto de
 * norma, mude lá e rode: npm run documentos:sincronizar
 *
 * Gerar em vez de copiar à mão é o que garante que a palavra da norma no
 * sistema seja a mesma do pacote testado, sem risco de erro de digitação.
 */

export interface SecaoDoc {
  t: string;
  /** Referência normativa mostrada em verde acima do texto. */
  ref?: string;
  texto?: string;
  itens?: string[];
  /** Texto-guia em itálico, para o técnico substituir. */
  guia?: string;
  matriz?: boolean;
  inventario?: boolean;
  plano?: boolean;
  paisagem?: boolean;
  exig?: [string, string, string][];
  tabela?: { cab: string[]; w: number[]; linhas: string[][]; fs?: number };
  sub?: SecaoDoc[];
}

export interface DocumentoSst {
  arquivo: string;
  sigla: string;
  titulo: string;
  nome: string;
  norma: string;
  normaLonga: string;
  profissional: string;
  semAviso?: boolean;
  encerramento?: string;
  secoes: SecaoDoc[];
}

export const DOCUMENTOS_SST: DocumentoSst[] = [
  {
    "arquivo": "01_PGR_Modelo",
    "sigla": "PGR",
    "titulo": "PGR",
    "nome": "Programa de Gerenciamento de Riscos",
    "norma": "NR-01",
    "normaLonga": "Norma Regulamentadora nº 01 (NR-01)",
    "profissional": "Técnico/Engenheiro de Segurança do Trabalho",
    "semAviso": true,
    "encerramento": "Este Programa de Gerenciamento de Riscos foi elaborado sob a responsabilidade da organização, sendo datado e assinado conforme o item 1.5.7.2 da NR-01. Seus documentos devem estar sempre disponíveis aos trabalhadores interessados, aos sindicatos representantes das categorias profissionais e à Inspeção do Trabalho (item 1.5.7.2.1).",
    "secoes": [
      {
        "t": "Inventário de Riscos Ocupacionais",
        "paisagem": true,
        "ref": "NR-01, itens 1.5.7.1 \"a\" e 1.5.7.3",
        "texto": "Os dados da identificação dos perigos e das avaliações dos riscos ocupacionais estão consolidados neste inventário, que contempla os perigos decorrentes de agentes físicos, químicos e biológicos, riscos de acidentes e fatores ergonômicos, incluindo os fatores de risco psicossociais relacionados ao trabalho (item 1.5.3.1.4). O inventário é organizado por Grupo de Exposição Similar (GES) e segue as mesmas colunas da planilha de inventário de riscos da organização.",
        "sub": [
          {
            "t": "Critérios de Avaliação e Classificação dos Riscos",
            "ref": "Itens 1.5.4.4.2 e 1.5.4.4.3",
            "texto": "O nível de risco é obtido pela multiplicação da Probabilidade (P) pela Severidade (S) das possíveis lesões ou agravos à saúde. A classificação resultante define a prioridade das medidas do plano de ação.",
            "matriz": true
          },
          {
            "t": "Inventário por GES",
            "ref": "Item 1.5.7.3.2 \"a\" a \"i\"",
            "inventario": true
          },
          {
            "t": "Atualização do Inventário",
            "ref": "Itens 1.5.7.3.3 e 1.5.7.3.3.1",
            "texto": "O inventário de riscos ocupacionais deve ser mantido atualizado. O histórico das atualizações deve ser mantido por um período mínimo de 20 (vinte) anos ou pelo período estabelecido em normatização específica."
          }
        ]
      },
      {
        "t": "Plano de Ação",
        "paisagem": true,
        "ref": "NR-01, itens 1.5.7.1 \"b\" e 1.5.5.2",
        "texto": "O plano de ação indica as medidas de prevenção a serem introduzidas, aprimoradas ou mantidas, com cronograma, responsáveis, formas de acompanhamento e aferição de resultados. O número de trabalhadores possivelmente atingidos é utilizado como critério para aumentar a prioridade da ação.",
        "plano": true
      },
      {
        "t": "Revisão do PGR",
        "ref": "NR-01, itens 1.5.4.4.6 e 1.5.4.4.6.1",
        "texto": "A avaliação de riscos constitui um processo contínuo e deve ser revista a cada 2 (dois) anos, ou em até 3 (três) anos para organizações com certificação em sistema de gestão de SST, ou quando ocorrer:",
        "itens": [
          "a) implementação das medidas de prevenção, para avaliação de riscos residuais;",
          "b) inovações e modificações nas tecnologias, ambientes, processos, condições, procedimentos e organização do trabalho que impliquem novos riscos ou modifiquem os riscos existentes;",
          "c) identificação de inadequações, insuficiência ou ineficácia das medidas de prevenção;",
          "d) ocorrência de acidentes ou doenças relacionadas ao trabalho;",
          "e) mudança nos requisitos legais aplicáveis;",
          "f) solicitação justificada dos trabalhadores ou da CIPA, quando houver."
        ]
      }
    ]
  },
  {
    "arquivo": "02_PCMSO_Modelo",
    "sigla": "PCMSO",
    "titulo": "PCMSO",
    "nome": "Programa de Controle Médico de Saúde Ocupacional",
    "norma": "NR-07",
    "normaLonga": "Norma Regulamentadora nº 07 (NR-07)",
    "profissional": "Médico do Trabalho",
    "secoes": [
      {
        "t": "Introdução",
        "texto": "O Programa de Controle Médico de Saúde Ocupacional (PCMSO) tem por objetivo proteger e preservar a saúde dos empregados em relação aos riscos ocupacionais identificados no PGR da empresa, conforme a NR-07."
      },
      {
        "t": "Objetivos",
        "guia": "[Descreva os objetivos do programa: rastreamento e detecção precoce de agravos, acompanhamento da saúde dos trabalhadores etc.]"
      },
      {
        "t": "Responsabilidades",
        "sub": [
          {
            "t": "Cabe ao Empregador",
            "guia": "[Descreva as responsabilidades da empresa conforme a NR-07.]"
          },
          {
            "t": "Cabe ao Médico Responsável",
            "guia": "[Descreva as atribuições do médico responsável pelo PCMSO.]"
          }
        ]
      },
      {
        "t": "Riscos Ocupacionais por GES",
        "guia": "[Relacione os riscos de cada GES/função conforme o inventário do PGR.]"
      },
      {
        "t": "Exames Médicos Ocupacionais",
        "guia": "[Indique os exames clínicos e complementares por função.]",
        "tabela": {
          "cab": [
            "FUNÇÃO",
            "RISCO",
            "EXAMES",
            "PERIODICIDADE"
          ],
          "w": [
            2400,
            2400,
            3038,
            1800
          ],
          "linhas": [
            [
              "FUNCAO",
              "RISCO",
              "EXAMES",
              "PERIODICIDADE"
            ],
            [
              "",
              "",
              "",
              ""
            ],
            [
              "",
              "",
              "",
              ""
            ]
          ]
        }
      },
      {
        "t": "Periodicidade dos Exames",
        "guia": "[Admissional, periódico, retorno ao trabalho, mudança de risco e demissional.]"
      },
      {
        "t": "Relatório Analítico",
        "guia": "[Insira o relatório analítico do período anterior: exames realizados, resultados anormais e percentuais por setor.]"
      },
      {
        "t": "Primeiros Socorros",
        "guia": "[Descreva o material de primeiros socorros disponível e o responsável pela sua guarda.]"
      },
      {
        "t": "Considerações Finais",
        "guia": "[Escreva aqui as conclusões gerais, as recomendações prioritárias à empresa e a data prevista para a próxima revisão do documento.]"
      }
    ]
  },
  {
    "arquivo": "03_AET_Modelo",
    "sigla": "AET",
    "titulo": "AET",
    "nome": "Análise Ergonômica do Trabalho",
    "norma": "NR-17",
    "normaLonga": "Norma Regulamentadora nº 17 (NR-17)",
    "profissional": "Ergonomista / Profissional Habilitado",
    "secoes": [
      {
        "t": "Introdução",
        "texto": "A Análise Ergonômica do Trabalho (AET) tem como finalidade avaliar a adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores, conforme o item 17.3.2 da NR-17."
      },
      {
        "t": "Objetivos",
        "guia": "[Descreva os objetivos da AET para esta empresa.]"
      },
      {
        "t": "Metodologia",
        "guia": "[Descreva as ferramentas e métodos usados: entrevistas, observação, check-lists, RULA, REBA, OWAS, NIOSH etc.]"
      },
      {
        "t": "Análise da Demanda",
        "guia": "[Descreva o motivo da análise: queixas, afastamentos, exigência legal, mudança de processo etc.]"
      },
      {
        "t": "Análise da Tarefa e da Atividade",
        "guia": "[Descreva o trabalho prescrito e o trabalho real em cada posto analisado.]"
      },
      {
        "t": "Diagnóstico Ergonômico",
        "guia": "[Apresente os resultados por posto de trabalho: posturas, mobiliário, organização do trabalho, ambiente, fatores psicossociais.]",
        "tabela": {
          "cab": [
            "POSTO / FUNÇÃO",
            "FATOR DE RISCO",
            "CLASSIFICAÇÃO",
            "RECOMENDAÇÃO"
          ],
          "w": [
            2400,
            2600,
            1800,
            2838
          ],
          "linhas": [
            [
              "POSTO_TRABALHO",
              "FATOR_RISCO",
              "CLASSIFICACAO",
              "RECOMENDACAO"
            ],
            [
              "",
              "",
              "",
              ""
            ],
            [
              "",
              "",
              "",
              ""
            ]
          ]
        }
      },
      {
        "t": "Recomendações",
        "guia": "[Liste as melhorias ergonômicas recomendadas, com prioridade e prazo.]"
      },
      {
        "t": "Considerações Finais",
        "guia": "[Escreva aqui as conclusões gerais, as recomendações prioritárias à empresa e a data prevista para a próxima revisão do documento.]"
      }
    ]
  },
  {
    "arquivo": "04_AEP_Modelo",
    "sigla": "AEP",
    "titulo": "AEP",
    "nome": "Avaliação Ergonômica Preliminar",
    "norma": "NR-17",
    "normaLonga": "Norma Regulamentadora nº 17 (NR-17)",
    "profissional": "Técnico/Engenheiro de Segurança do Trabalho",
    "secoes": [
      {
        "t": "Introdução",
        "texto": "A Avaliação Ergonômica Preliminar (AEP) tem por finalidade identificar, de forma inicial, os fatores de risco ergonômicos das situações de trabalho, subsidiando o PGR e as medidas de prevenção, conforme o item 17.3.1 da NR-17."
      },
      {
        "t": "Objetivos",
        "guia": "[Descreva os objetivos da AEP para esta empresa.]"
      },
      {
        "t": "Metodologia",
        "guia": "[Descreva a abordagem usada: observação, entrevistas, check-list, avaliação qualitativa etc.]"
      },
      {
        "t": "Identificação dos Postos de Trabalho",
        "guia": "[Relacione os setores, postos e funções avaliados.]"
      },
      {
        "t": "Avaliação Preliminar dos Fatores Ergonômicos",
        "guia": "[Registre os fatores identificados por posto: postura, repetitividade, levantamento de cargas, mobiliário, iluminação, ruído, conforto térmico.]",
        "tabela": {
          "cab": [
            "SETOR / FUNÇÃO",
            "FATOR ERGONÔMICO",
            "NÍVEL",
            "NECESSITA AET?"
          ],
          "w": [
            2600,
            3438,
            1600,
            2000
          ],
          "linhas": [
            [
              "SETOR_FUNCAO",
              "FATOR_ERGONOMICO",
              "NIVEL",
              "SIM_NAO"
            ],
            [
              "",
              "",
              "",
              ""
            ],
            [
              "",
              "",
              "",
              ""
            ]
          ]
        }
      },
      {
        "t": "Fatores Psicossociais",
        "guia": "[Registre os fatores psicossociais identificados: excesso de demandas, pressão por metas, jornada, relacionamento etc.]"
      },
      {
        "t": "Recomendações e Plano de Ação",
        "guia": "[Liste as medidas de prevenção e indique os casos em que será necessária uma AET.]"
      },
      {
        "t": "Considerações Finais",
        "guia": "[Escreva aqui as conclusões gerais, as recomendações prioritárias à empresa e a data prevista para a próxima revisão do documento.]"
      }
    ]
  },
  {
    "arquivo": "05_Laudo_Insalubridade_Modelo",
    "sigla": "LTI",
    "titulo": "LAUDO DE INSALUBRIDADE",
    "nome": "Laudo Técnico de Insalubridade",
    "norma": "NR-15",
    "normaLonga": "Norma Regulamentadora nº 15 (NR-15)",
    "profissional": "Engenheiro de Seg. do Trabalho / Médico do Trabalho",
    "secoes": [
      {
        "t": "Introdução",
        "texto": "Este Laudo Técnico tem por finalidade caracterizar ou descaracterizar a insalubridade nas atividades e operações desenvolvidas pelos empregados da empresa, conforme a NR-15 e o art. 195 da Consolidação das Leis do Trabalho (CLT)."
      },
      {
        "t": "Objetivo",
        "guia": "[Descreva o objetivo do laudo para esta empresa.]"
      },
      {
        "t": "Fundamentação Legal",
        "guia": "[CLT arts. 189 a 192 e 195; NR-15 e seus anexos; NHO da Fundacentro aplicáveis.]"
      },
      {
        "t": "Metodologia e Equipamentos Utilizados",
        "guia": "[Descreva os métodos de avaliação e os equipamentos (marca, modelo, nº de série e certificado de calibração).]"
      },
      {
        "t": "Descrição dos Ambientes e Funções",
        "guia": "[Descreva cada setor, as funções e as atividades executadas.]"
      },
      {
        "t": "Avaliação dos Agentes",
        "sub": [
          {
            "t": "Agentes Físicos",
            "guia": "[Ruído, calor, vibração, radiações, frio, umidade – resultados x limites de tolerância.]"
          },
          {
            "t": "Agentes Químicos",
            "guia": "[Poeiras, fumos, névoas, vapores, gases – resultados x limites de tolerância.]"
          },
          {
            "t": "Agentes Biológicos",
            "guia": "[Avaliação qualitativa conforme o Anexo 14 da NR-15.]"
          }
        ]
      },
      {
        "t": "Conclusão por Função",
        "guia": "[Informe, para cada função, se há insalubridade e em qual grau.]",
        "tabela": {
          "cab": [
            "FUNÇÃO",
            "AGENTE",
            "GRAU",
            "ADICIONAL"
          ],
          "w": [
            2800,
            3038,
            1800,
            2000
          ],
          "linhas": [
            [
              "FUNCAO",
              "AGENTE",
              "GRAU",
              "ADICIONAL"
            ],
            [
              "",
              "",
              "",
              ""
            ],
            [
              "",
              "",
              "",
              ""
            ]
          ]
        }
      },
      {
        "t": "Considerações Finais",
        "guia": "[Escreva aqui as conclusões gerais, as recomendações prioritárias à empresa e a data prevista para a próxima revisão do documento.]"
      }
    ]
  },
  {
    "arquivo": "06_Laudo_Periculosidade_Modelo",
    "sigla": "LTP",
    "titulo": "LAUDO DE PERICULOSIDADE",
    "nome": "Laudo Técnico de Periculosidade",
    "norma": "NR-16",
    "normaLonga": "Norma Regulamentadora nº 16 (NR-16)",
    "profissional": "Engenheiro de Seg. do Trabalho / Médico do Trabalho",
    "secoes": [
      {
        "t": "Introdução",
        "texto": "Este Laudo Técnico tem por finalidade caracterizar ou descaracterizar a periculosidade nas atividades e operações desenvolvidas pelos empregados da empresa, conforme a NR-16 e os arts. 193 e 195 da Consolidação das Leis do Trabalho (CLT)."
      },
      {
        "t": "Objetivo",
        "guia": "[Descreva o objetivo do laudo para esta empresa.]"
      },
      {
        "t": "Fundamentação Legal",
        "guia": "[CLT arts. 193 a 195; NR-16 e seus anexos; NR-10 e NR-20 quando aplicáveis.]"
      },
      {
        "t": "Metodologia",
        "guia": "[Descreva a inspeção realizada, entrevistas e documentos analisados.]"
      },
      {
        "t": "Descrição das Atividades e Áreas de Risco",
        "guia": "[Descreva cada setor, as funções, as atividades e as áreas de risco identificadas.]"
      },
      {
        "t": "Avaliação das Atividades Perigosas",
        "guia": "[Analise conforme os anexos da NR-16: explosivos, inflamáveis, segurança patrimonial, energia elétrica, motocicleta e radiações ionizantes.]"
      },
      {
        "t": "Conclusão por Função",
        "guia": "[Informe, para cada função, se há periculosidade e o enquadramento.]",
        "tabela": {
          "cab": [
            "FUNÇÃO",
            "ATIVIDADE / ANEXO NR-16",
            "PERICULOSA?",
            "ADICIONAL"
          ],
          "w": [
            2800,
            3238,
            1600,
            2000
          ],
          "linhas": [
            [
              "FUNCAO",
              "ATIVIDADE_ANEXO",
              "SIM_NAO",
              "ADICIONAL"
            ],
            [
              "",
              "",
              "",
              ""
            ],
            [
              "",
              "",
              "",
              ""
            ]
          ]
        }
      },
      {
        "t": "Considerações Finais",
        "guia": "[Escreva aqui as conclusões gerais, as recomendações prioritárias à empresa e a data prevista para a próxima revisão do documento.]"
      }
    ]
  }
];
