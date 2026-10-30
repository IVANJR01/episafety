import { describe, expect, it } from "vitest";
import {
  lerInventarioDaPlanilha, acharCabecalho, resolverColunas,
  grupoDoAgente, codigoGes, nota, funcoesDaCelula,
} from "./importarPgrPlanilha";

/**
 * A leitura da planilha de Inventário de Riscos.
 *
 * O formato abaixo copia o da planilha real do cliente: título na linha
 * 1, subtítulo mesclado na 2, cabeçalho na 4, sub-cabeçalho na 5 e
 * dados a partir da 6, com célula mesclada — setor, GES, função e
 * ambiente só aparecem na primeira linha de cada grupo.
 */

const CABECALHO = [
  "DESCRIÇÃO DO AMBIENTE", "SETOR", "GES", "FUNÇÃO", "PROCESSO",
  "Agente", "Tipo de Agente", "Perigo/\n Fonte Exposiçao",
  "Possíveis Lesões ou Agravos à Saúde", "Limite de Exposição",
  "Intens. / Conc.", "Tipo/Tempo de Exposição", "Técnica Utilizada",
  "MEDIDAS DE PREVENÇÃO EXISTENTE", "", "",
  "PROBABILIDADE", "SEVERIDADE", "TOTAL", "CLASSIFICAÇÃO DO RISCO",
];

const SUB = [
  "", "", "", "", "", "", "", "", "", "", "", "", "",
  "Procedimento Administrativo/ EPC", "EPI", "Atenuação /\nFator de Proteção",
  "", "", "", "",
];

const PLANILHA: unknown[][] = [
  ["", "ATUALIZAÇÃO: 02/01/2025", "", "INVENTÁRIO DE RISCOS OCUPACIONAIS"],
  ["", "", "", "IDENTIFICAÇÃO DE PERIGOS e CLASSIFICAÇÃO DE RISCOS POR GES"],
  [],
  CABECALHO,
  SUB,
  [
    "Ambiente interno, pé direito 3m", "PCP", "1.0",
    "Supervisor de Produção, Cronometrista", "Gerencia o processo produtivo",
    "Ergonômico", "Monotonia e Repetitividade", "Mobiliário; Máquinas",
    "LER/DORT", "N.A", "N.A", "Intermitente", "Avaliação Qualitativa",
    "Revezamento de posições", "N.A", "N.A", "1.0", "1.0", "1", "TRIVIAL",
  ],
  /* Mesma mescla: setor, GES, função e ambiente vêm em branco. */
  [
    "", "", "", "", "",
    "", "Postura Inadequada", "Mobiliário",
    "Dores na coluna", "N.A", "N.A", "Intermitente", "Avaliação Qualitativa",
    "Assentos NR-17", "N.A", "N.A", "3.0", "3.0", "9", "MODERADO",
  ],
  [
    "Ambiente interno, piso industrial", "COSTURA", "3.0", "Costureiro (a)",
    "Opera máquinas de costura",
    "Acidentes", "Perfurações e Cortes", "Máquinas de costura",
    "Lesões nos dedos", "N.A", "N.A", "Intermitente", "Avaliação Qualitativa",
    "Protetor de dedo", "Luva", "N.A", "2.0", "4.0", "8", "TOLERÁVEL",
  ],
];

describe("onde está o cabeçalho", () => {
  it("não confunde o título com o cabeçalho", () => {
    /*
     * "INVENTÁRIO DE RISCOS OCUPACIONAIS" contém "risco" e ficava na
     * linha 1 com duas células preenchidas: era tomado como cabeçalho, e
     * daí para baixo tudo saía errado.
     */
    expect(acharCabecalho(PLANILHA), "voltou a tomar o título por cabeçalho").toBe(3);
  });

  it("escolhe a linha com MAIS colunas reconhecidas, não a primeira", () => {
    /*
     * A regra antiga pegava a primeira linha que casasse com um termo —
     * e o título casava. Aqui a linha 1 tem "risco" e a 4 tem dezenove
     * colunas de verdade.
     */
    const comIsca: unknown[][] = [
      ["INVENTÁRIO DE RISCOS", "SETOR", "ANO", "EMPRESA"],  // casa, mas é capa
      [],
      CABECALHO,
    ];
    expect(acharCabecalho(comIsca), "parou na primeira linha que casou").toBe(2);
  });

  it("planilha sem cabeçalho de inventário é recusada", () => {
    expect(acharCabecalho([["a", "b"], ["1", "2"]])).toBe(-1);
    expect(lerInventarioDaPlanilha([["a"], ["b"]]).itens).toEqual([]);
  });
});

describe("qual coluna é cada coisa", () => {
  const c = resolverColunas(CABECALHO);

  it("SETOR não é a DESCRIÇÃO DO AMBIENTE", () => {
    /* A coluna A casava com "ambiente" e era tomada como setor. */
    expect(c.setor, "o setor voltou a sair da coluna do ambiente").toBe(1);
    expect(c.ambiente).toBe(0);
  });

  it("PROBABILIDADE não é PROCESSO", () => {
    /* A busca incluía a letra solta "p", que casa com "PROCESSO". */
    expect(c.probabilidade).toBe(16);
    expect(c.processo).toBe(4);
  });

  it("SEVERIDADE não é a descrição do ambiente", () => {
    /* A letra solta "s" casava com "descricaodoambiente". */
    expect(c.severidade).toBe(17);
  });

  it("o termo casa pelo começo do nome, não por conter", () => {
    /*
     * Procurar por "conter" fazia "p" pegar "PROCESSO" e "s" pegar
     * "descrição do ambiente". Aqui, uma coluna chamada "OBSERVAÇÃO"
     * não pode ser tomada por "SEVERIDADE" nem por nada que ela contenha.
     */
    const c2 = resolverColunas(["REVISÃO DO SETOR", "SETOR", "PROBABILIDADE", "SEVERIDADE"]);
    expect(c2.setor, "pegou a coluna que apenas CONTÉM a palavra setor").toBe(1);
    expect(c2.probabilidade).toBe(2);
    expect(c2.severidade).toBe(3);
  });

  it("acha as colunas que ninguém lia", () => {
    expect(c.limite).toBe(9);
    expect(c.intensidade).toBe(10);
    expect(c.exposicao).toBe(11);
    expect(c.tecnica).toBe(12);
    expect(c.classificacao).toBe(19);
  });
});

describe("as linhas do inventário", () => {
  const { itens } = lerInventarioDaPlanilha(PLANILHA);

  it("lê os riscos e ignora título e cabeçalho", () => {
    expect(itens.length).toBe(3);
  });

  it("linha de célula mesclada herda setor, GES e função", () => {
    /* Sem isso, a maior parte do inventário fica sem setor. */
    expect(itens[1].setor).toBe("PCP");
    expect(itens[1].ges_codigo).toBe("01");
    expect(itens[1].funcoes).toContain("Supervisor de Produção");
  });

  it("traz a probabilidade e a severidade da planilha", () => {
    /*
     * Caíam no padrão 2 e 2, e a classificação do risco no sistema era
     * inventada — num documento em que ela define a prioridade das ações.
     */
    expect(itens[1].probabilidade).toBe(3);
    expect(itens[1].severidade).toBe(3);
    expect(itens[2].probabilidade).toBe(2);
    expect(itens[2].severidade).toBe(4);
  });

  it("traz a classificação escrita pelo técnico", () => {
    expect(itens.map((i) => i.classificacao))
      .toEqual(["TRIVIAL", "MODERADO", "TOLERÁVEL"]);
  });

  it("o grupo mesclado é deduzido do tipo de agente", () => {
    /* A coluna "Agente" também vem em branco na linha mesclada. */
    expect(itens[1].grupo).toBe("ergonomico");
    expect(itens[2].grupo).toBe("acidente");
  });

  it("'N.A' não vira texto gravado", () => {
    expect(itens[0].epi).toBeNull();
    expect(itens[0].limite_tolerancia).toBeNull();
    expect(itens[2].epi).toBe("Luva");
  });

  it("traz os campos que a importação antiga descartava", () => {
    expect(itens[0].tipo_exposicao).toBe("Intermitente");
    expect(itens[0].tecnica_utilizada).toBe("Avaliação Qualitativa");
    expect(itens[0].descricao_ambiente).toContain("pé direito");
    expect(itens[0].processo).toContain("Gerencia");
  });
});

describe("conversões de cada célula", () => {
  it("o GES '1.0' do Excel vira '01'", () => {
    expect(codigoGes("1.0")).toBe("01");
    expect(codigoGes("3.1"), "o subgrupo 3.1 não pode virar 03").toBe("3.1");
    expect(codigoGes("")).toBe("");
  });

  it("a nota aceita de 1 a 5, e só isso", () => {
    expect(nota("4.0")).toBe(4);
    expect(nota("4,0")).toBe(4);
    expect(nota("Intermitente"), "texto virou nota de risco").toBeNull();
    expect(nota("9")).toBeNull();
    expect(nota("")).toBeNull();
  });

  it("psicossocial tem grupo próprio, e não cai em 'outro'", () => {
    expect(grupoDoAgente("Psicossocial")).toBe("psicossocial");
    expect(grupoDoAgente("Ergonômico")).toBe("ergonomico");
    expect(grupoDoAgente("Acidentes")).toBe("acidente");
    expect(grupoDoAgente("Biológico")).toBe("biologico");
  });

  it("função com '(a)' não é partida ao meio", () => {
    /* "Costureiro (a)" tem vírgula nenhuma, mas "Diretor (a), Supervisor" tem. */
    expect(funcoesDaCelula("Costureiro (a)")).toEqual(["Costureiro (a)"]);
    expect(funcoesDaCelula("Diretor (a) de produção, Supervisor"))
      .toEqual(["Diretor (a) de produção", "Supervisor"]);
  });
});
