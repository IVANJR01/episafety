import { describe, it, expect } from "vitest";
import {
  normalizarChave,
  combinarCabecalhos,
  pareceSubCabecalho,
  mapearColunas,
  camposCriticosPerdidos,
} from "./colunasDaPlanilha";

/**
 * As duas linhas abaixo são o cabeçalho REAL do "Inventário de Risco e
 * Plano de Ação 2026" da G91, já com as células mescladas preenchidas —
 * que é exatamente como a leitura enxerga a planilha.
 *
 * Repare: as colunas 13, 14 e 15 têm o MESMO título em cima
 * ("MEDIDAS DE PREVENÇÃO EXISTENTE", mesclado) e só se distinguem pela
 * linha de baixo. E as colunas 0 a 12 e 16 a 19 repetem o título nas
 * duas linhas, porque são mescladas na vertical.
 */
const CIMA = [
  "DESCRIÇÃO DO AMBIENTE", "SETOR", "GES", "FUNÇÃO", "PROCESSO", "Agente",
  "Tipo de Agente", "Perigo/\n Fonte Exposiçao", "Possíveis Lesões ou Agravos à Saúde ",
  "Limite de Exposição", "Intens. / Conc.", "Tipo/Tempo de Exposição", "Técnica Utilizada",
  "MEDIDAS DE PREVENÇÃO EXISTENTE ", "MEDIDAS DE PREVENÇÃO EXISTENTE ", "MEDIDAS DE PREVENÇÃO EXISTENTE ",
  "PROBABILIDADE ", "SEVERIDADE", "TOTAL       ", "CLASSIFICAÇÃO DO RISCO ",
];

const BAIXO = [
  "DESCRIÇÃO DO AMBIENTE", "SETOR", "GES", "FUNÇÃO", "PROCESSO", "Agente",
  "Tipo de Agente", "Perigo/\n Fonte Exposiçao", "Possíveis Lesões ou Agravos à Saúde ",
  "Limite de Exposição", "Intens. / Conc.", "Tipo/Tempo de Exposição", "Técnica Utilizada",
  "Procedimento Administrativo/ Equipamento de Proteção Coletivo/ Organização do Trabalho",
  "EPI", "Atenuação /\nFator de Proteção",
  "PROBABILIDADE ", "SEVERIDADE", "TOTAL       ", "CLASSIFICAÇÃO DO RISCO ",
];

const COLUNAS = mapearColunas(combinarCabecalhos(CIMA, BAIXO));

describe("a planilha real da G91", () => {
  it("acha o setor, o GES, a função e o perigo", () => {
    expect(COLUNAS.setor).toBe(1);
    expect(COLUNAS.ges).toBe(2);
    expect(COLUNAS.funcao).toBe(3);
    expect(COLUNAS.perigo).toBe(7);
  });

  it("separa Agente (o grupo) de Tipo de Agente (o agente)", () => {
    /* Vizinhas e com nomes parecidos: trocadas, o inventário perde o agente. */
    expect(COLUNAS.agente).toBe(5);
    expect(COLUNAS.tipoAgente).toBe(6);
  });

  it("não troca Setor por Descrição do ambiente", () => {
    /* São colunas vizinhas e as duas falam de lugar. */
    expect(COLUNAS.ambiente).toBe(0);
    expect(COLUNAS.setor).not.toBe(COLUNAS.ambiente);
  });

  it("acha probabilidade, severidade e classificação", () => {
    /*
     * Sem estas três, TODO risco cai no padrão 2x2 e o inventário
     * inteiro aparece como "Tolerável", com "Requer ação: 0" — foi o
     * que o técnico viu na tela com 13 riscos MODERADOS na planilha.
     */
    expect(COLUNAS.probabilidade).toBe(16);
    expect(COLUNAS.severidade).toBe(17);
    expect(COLUNAS.classificacao).toBe(19);
  });

  it("separa as três subcolunas de MEDIDAS DE PREVENÇÃO", () => {
    /*
     * As três têm o mesmo título em cima. A do meio é o EPI, e o título
     * da primeira contém a palavra "Equipamento" — que foi o que fez a
     * busca parar nela.
     */
    expect(COLUNAS.medidas).toBe(13);
    expect(COLUNAS.epi).toBe(14);
    expect(COLUNAS.atenuacao).toBe(15);
  });

  it("a coluna de EPI nunca é a mesma do procedimento", () => {
    expect(COLUNAS.epi).not.toBe(COLUNAS.medidas);
  });

  it("acha as colunas de exposição sem confundir limite com tempo", () => {
    expect(COLUNAS.limite).toBe(9);
    expect(COLUNAS.intensidade).toBe(10);
    expect(COLUNAS.exposicao).toBe(11);
    expect(COLUNAS.tecnica).toBe(12);
  });

  it("não falta nenhum campo crítico", () => {
    expect(camposCriticosPerdidos(COLUNAS)).toEqual([]);
  });
});

describe("cabeçalho de duas linhas", () => {
  it("título repetido nas duas linhas não vira 'setor_setor'", () => {
    expect(combinarCabecalhos(["SETOR"], ["SETOR"])).toEqual(["setor"]);
  });

  it("título de cima vazio deixa o de baixo sozinho", () => {
    expect(combinarCabecalhos([""], ["EPI"])).toEqual(["epi"]);
  });

  it("títulos diferentes ficam juntos, na ordem", () => {
    expect(combinarCabecalhos(["MEDIDAS"], ["EPI"])).toEqual(["medidas_epi"]);
  });

  it("reconhece a linha de baixo como subcabeçalho", () => {
    expect(pareceSubCabecalho(BAIXO)).toBe(true);
  });

  it("linha de dados não é confundida com subcabeçalho", () => {
    expect(pareceSubCabecalho(["COSTURA", "3.0", "Costureira", "Ruído"])).toBe(false);
  });
});

describe("planilha de uma linha de cabeçalho só", () => {
  const SIMPLES = ["Setor", "GES", "Função", "Perigo", "Probabilidade", "Severidade", "EPI", "Classificação"];
  const simples = mapearColunas(combinarCabecalhos(SIMPLES, []));

  it("continua funcionando", () => {
    expect(simples.setor).toBe(0);
    expect(simples.probabilidade).toBe(4);
    expect(simples.severidade).toBe(5);
    expect(simples.epi).toBe(6);
    expect(simples.classificacao).toBe(7);
    expect(camposCriticosPerdidos(simples)).toEqual([]);
  });
});

describe("quando a planilha não traz a coluna", () => {
  it("o campo volta -1, e o crítico é denunciado", () => {
    const c = mapearColunas(combinarCabecalhos(["Setor", "Perigo"], []));
    expect(c.probabilidade).toBe(-1);
    expect(camposCriticosPerdidos(c)).toEqual(["probabilidade", "severidade", "classificacao"]);
  });
});

describe("normalizarChave", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizarChave("Tipo/Tempo de Exposição")).toBe("tipotempodeexposicao");
    expect(normalizarChave("CLASSIFICAÇÃO DO RISCO ")).toBe("classificacaodorisco");
  });
});

describe("o subtítulo decide quando o título de cima atrapalha", () => {
  /*
   * Há planilhas de PGR em que a coluna do procedimento se chama
   * "Procedimento Administrativo / EPC e EPI". Ela vem ANTES da coluna
   * EPI e contém a palavra — então quem procura só por "contém" para
   * nela, e o procedimento inteiro vira o EPI do risco.
   */
  const CIMA2 = ["Setor", "Perigo", "MEDIDAS", "MEDIDAS", "Probabilidade", "Severidade", "Classificação"];
  const BAIXO2 = ["Setor", "Perigo", "Procedimento Administrativo / EPC e EPI", "EPI", "Probabilidade", "Severidade", "Classificação"];
  const c = mapearColunas(combinarCabecalhos(CIMA2, BAIXO2));

  it("o EPI é a coluna cujo subtítulo é EPI, não a vizinha que o cita", () => {
    expect(c.epi).toBe(3);
    expect(c.medidas).toBe(2);
  });
});
