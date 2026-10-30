import { describe, expect, it } from "vitest";
import { indiceDeGes, gesDaEstrutura, chaveDoGes } from "./vinculosDoInventario";

/**
 * A tabela do inventário tem duas colunas de GES apontando para tabelas
 * diferentes: `ghe_id` para ghe_ges e `ges_id` para sst_ges. A
 * importação gravava o mesmo id nas duas, e o banco recusava o
 * inventário inteiro — "violates foreign key constraint
 * pgr_inventario_itens_ges_id_fkey". O PGR ficava criado, sem um risco
 * sequer.
 */

const CADASTRADOS = [
  { id: "sst-1", codigo: "01", nome: "PCP" },
  { id: "sst-7", codigo: "07", nome: "COSTURA" },
  { id: "sst-31", codigo: "3.1", nome: "SUPERVISÃO" },
];

describe("achar o GES da Estrutura Ocupacional", () => {
  const indice = indiceDeGes(CADASTRADOS);

  it("acha pelo código", () => {
    expect(gesDaEstrutura(indice, "07")).toBe("sst-7");
  });

  it("'1.0' da planilha e '01' do cadastro são o mesmo GES", () => {
    /* O Excel grava "1.0"; o cadastro escreve "01". */
    expect(gesDaEstrutura(indice, "1.0")).toBe("sst-1");
    expect(gesDaEstrutura(indice, "1")).toBe("sst-1");
  });

  it("subgrupo não vira o grupo inteiro", () => {
    /* "3.1" é grupo próprio; cair em "03" ligaria o risco ao errado. */
    expect(gesDaEstrutura(indice, "3.1")).toBe("sst-31");
  });

  it("acha pelo nome quando o código não casa", () => {
    expect(gesDaEstrutura(indice, "99", "COSTURA")).toBe("sst-7");
  });

  it("sem correspondente, devolve null em vez de um id de outra tabela", () => {
    /*
     * Null é verdade: o grupo pode existir só no módulo de PGR e ainda
     * não ter sido cadastrado na Estrutura Ocupacional.
     */
    expect(gesDaEstrutura(indice, "42")).toBeNull();
    expect(gesDaEstrutura(indiceDeGes([]), "01")).toBeNull();
    expect(gesDaEstrutura(indice, "")).toBeNull();
  });
});

describe("a chave de comparação", () => {
  it("normaliza o número", () => {
    expect(chaveDoGes("01")).toBe("1");
    expect(chaveDoGes("1.0")).toBe("1");
    expect(chaveDoGes("10")).toBe("10");
  });

  it("mantém o subgrupo", () => {
    expect(chaveDoGes("3.1")).toBe("3.1");
  });

  it("nome perde acento e caixa", () => {
    expect(chaveDoGes("SEPARAÇÃO")).toBe("separacao");
  });

  it("vazio continua vazio", () => {
    expect(chaveDoGes("")).toBe("");
    expect(chaveDoGes(null)).toBe("");
  });
});
