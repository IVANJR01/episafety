import { describe, expect, it } from "vitest";
import {
  responsavelTecnicoDoWord, unidadesDoWord, grauDeRisco, cidadeEUf,
} from "./dadosDoWordPgr";

/**
 * As linhas abaixo são as do PGR real do cliente, como o extrator de
 * .docx as entrega: cada célula da tabela vira um parágrafo, e o rótulo
 * fica numa linha e o valor na seguinte.
 */

const LINHAS = [
  "Sumário",
  "3.ELABORAÇÃO E HABILIDADE TÉCNICA PAGEREF _Toc187045309 \\h 6",
  "CONTROLE DE REVISÕES",
  "IDENTIFICAÇÃO DA EMPRESA",
  "MATRIZ",
  "Nome da Empresa", "G-91 NORDESTE CONFECÇÕES",
  "Nome Fantasia", "RED CONEY",
  "CNPJ", "14.256.653/0001-40",
  "CNAE Principal", "14.12-6-03 - Facção de peças do vestuário",
  "CNAE Secundário",
  "14.12-6-01 - Confecção de peças de vestuário",
  "13.40-5-01 - Estamparia e texturização em fios",
  "Risco da Atividade", "02 (Dois) – NR04",
  "Logradouro", "Rua Frei Lamberto, N°178",
  "Bairro", "Centro",
  "Cidade/Estado", "Alto Santo – CE",
  "CEP", "62.970-000",
  "Telefone", "(88) 3429-1801",
  "FILIAL - CASTANHÃO",
  "Nome da Empresa", "G-91 NORDESTE CONFECÇÕES",
  "Nome Fantasia", "RED CONEY",
  "CNPJ", "14.256.653/0006-55",
  "CNAE Principal", "14.12-6-03 - Facção de peças do vestuário",
  "Risco da Atividade", "02 (Dois) – NR04",
  "Logradouro", "Pedro auglino caetando,01",
  "Distrito", "Castanhão",
  "Cidade/Estado", "Alto Santo – CE",
  "CEP", "62.970-000",
  "Telefone", "(88) 3429-1801",
  "ELABORAÇÃO E HABILIDADE TÉCNICA",
  "NOME", "José Ivan Holanda de Melo Júnior",
  "ESPECIALIDADE", "Técnico em Segurança do Trabalho",
  "REGISTRO", "0021678/CE",
];

describe("o responsável técnico", () => {
  it("sai do documento, em vez de 'A definir'", () => {
    /*
     * A tela mostrava "Responsável Técnico: A definir" num PGR que diz o
     * nome e o registro em letras garrafais.
     */
    const r = responsavelTecnicoDoWord(LINHAS)!;
    expect(r.nome).toBe("José Ivan Holanda de Melo Júnior");
    expect(r.especialidade).toBe("Técnico em Segurança do Trabalho");
    expect(r.registro).toBe("0021678/CE");
  });

  it("não confunde com o 'NOME' de outra tabela", () => {
    /*
     * "Nome da Empresa" vem antes no documento. Pegar o primeiro "nome"
     * poria a razão social no lugar do técnico.
     */
    expect(responsavelTecnicoDoWord(LINHAS)!.nome).not.toContain("G-91");
  });

  it("a linha do sumário não conta como a seção", () => {
    /* "3.ELABORAÇÃO E HABILIDADE TÉCNICA PAGEREF ..." é índice. */
    const soSumario = LINHAS.slice(0, 4);
    expect(responsavelTecnicoDoWord(soSumario)).toBeNull();
  });

  it("documento sem a seção não inventa responsável", () => {
    expect(responsavelTecnicoDoWord(["qualquer coisa"])).toBeNull();
    expect(responsavelTecnicoDoWord([])).toBeNull();
  });
});

describe("as unidades da empresa", () => {
  const u = unidadesDoWord(LINHAS);

  it("lê a matriz e as filiais", () => {
    expect(u.map((x) => x.rotulo)).toEqual(["MATRIZ", "FILIAL - CASTANHÃO"]);
  });

  it("cada unidade leva o seu próprio CNPJ", () => {
    /* Uma empresa, quatro inscrições: trocar o CNPJ troca a unidade. */
    expect(u[0].cnpj).toBe("14.256.653/0001-40");
    expect(u[1].cnpj).toBe("14.256.653/0006-55");
  });

  it("cidade e UF saem separadas", () => {
    expect(u[0].cidade).toBe("Alto Santo");
    expect(u[0].uf).toBe("CE");
  });

  it("o grau de risco vira número", () => {
    /* "02 (Dois) – NR04" — o 04 do fim é o número da norma. */
    expect(u[0].grauRisco).toBe(2);
  });

  it("CNAE secundário quebrado em duas linhas não perde a segunda", () => {
    expect(u[0].cnaeSecundario).toContain("14.12-6-01");
    expect(u[0].cnaeSecundario, "a segunda linha do CNAE se perdeu")
      .toContain("13.40-5-01");
  });

  it("'Distrito' vale como bairro", () => {
    expect(u[1].bairro).toBe("Castanhão");
  });

  it("o último campo não engole o resto do documento", () => {
    /*
     * Depois do telefone da última unidade não vem rótulo nenhum, e sim
     * a seção seguinte: o telefone saía com o PGR inteiro grudado.
     */
    const comSecaoDepois = [
      ...LINHAS,
      "INTRODUÇÃO",
      "A G91 Nordeste LTDA, por obrigatoriedade legal contida na Portaria...",
    ];
    const ultima = unidadesDoWord(comSecaoDepois).at(-1)!;
    expect(ultima.telefone).toBe("(88) 3429-1801");
  });

  it("título solto sem CNPJ não vira unidade", () => {
    /* "FILIAL" no sumário ou num cabeçalho não é uma unidade. */
    expect(unidadesDoWord(["FILIAL - TESTE", "qualquer coisa"])).toEqual([]);
  });
});

describe("pedaços do texto", () => {
  it("o grau de risco só aceita de 1 a 4", () => {
    expect(grauDeRisco("02 (Dois) – NR04")).toBe(2);
    expect(grauDeRisco("4")).toBe(4);
    expect(grauDeRisco("NR-04")).toBe(4);
    expect(grauDeRisco("sem informação")).toBeNull();
    expect(grauDeRisco("9")).toBeNull();
  });

  it("cidade e UF com barra ou travessão", () => {
    expect(cidadeEUf("Potiretama/CE")).toEqual({ cidade: "Potiretama", uf: "CE" });
    expect(cidadeEUf("Alto Santo – CE")).toEqual({ cidade: "Alto Santo", uf: "CE" });
  });

  it("cidade sem UF não inventa a sigla", () => {
    expect(cidadeEUf("Alto Santo")).toEqual({ cidade: "Alto Santo", uf: "" });
  });
});
