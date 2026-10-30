import { describe, expect, it } from "vitest";
import {
  conferirEmpresa, avisoDeEmpresa, raizDoCnpj, digitosDoCnpj,
} from "./conferirEmpresaDoDocumento";

/**
 * Um PGR do G-91 NORDESTE foi importado quatro vezes para a CG3
 * ENGENHARIA, e a tela não disse nada. O seletor de empresa fica no
 * canto da barra lateral, e quem está com o arquivo na mão não olha
 * para lá.
 */

const G91_MATRIZ = "14.256.653/0001-40";
const G91_FILIAL = "14.256.653/0006-55";
const CG3 = "05.394.053/0001-58";

describe("de quem é o documento", () => {
  it("CNPJ igual: é a empresa certa", () => {
    expect(conferirEmpresa(G91_MATRIZ, G91_MATRIZ)).toBe("igual");
    expect(conferirEmpresa("14256653000140", G91_MATRIZ), "a pontuação atrapalhou")
      .toBe("igual");
  });

  it("empresa diferente é reconhecida", () => {
    expect(conferirEmpresa(G91_MATRIZ, CG3)).toBe("outra_empresa");
  });

  it("filial da mesma empresa não é 'outra empresa'", () => {
    /* Matriz e filial compartilham os oito primeiros dígitos. */
    expect(conferirEmpresa(G91_FILIAL, G91_MATRIZ)).toBe("mesma_empresa_outra_unidade");
  });

  it("sem CNPJ de um dos lados, não afirma nada", () => {
    /* Empresa recém-cadastrada pode estar sem CNPJ. */
    expect(conferirEmpresa("", CG3)).toBe("indeterminado");
    expect(conferirEmpresa(G91_MATRIZ, null)).toBe("indeterminado");
    expect(conferirEmpresa("123", CG3)).toBe("indeterminado");
  });
});

describe("o aviso na tela", () => {
  it("empresa errada: aviso grave, com os dois lados", () => {
    const a = avisoDeEmpresa(G91_MATRIZ, CG3, "CG3 ENGENHARIA LTDA")!;
    expect(a.grave).toBe(true);
    expect(a.titulo).toContain("14.256.653/0001-40");
    expect(a.detalhe).toContain("CG3 ENGENHARIA LTDA");
  });

  it("outra unidade: avisa sem alarde", () => {
    const a = avisoDeEmpresa(G91_FILIAL, G91_MATRIZ, "G91 NORDESTE - MATRIZ")!;
    expect(a.grave, "tratou filial como empresa errada").toBe(false);
    expect(a.titulo).toContain("outra unidade");
  });

  it("empresa certa não gera aviso", () => {
    expect(avisoDeEmpresa(G91_MATRIZ, G91_MATRIZ, "G91")).toBeNull();
  });

  it("sem CNPJ não inventa aviso", () => {
    /* Avisar sem saber faria a pessoa desconfiar de importação correta. */
    expect(avisoDeEmpresa("", CG3, "CG3")).toBeNull();
  });
});

describe("pedaços do CNPJ", () => {
  it("só os dígitos", () => {
    expect(digitosDoCnpj("14.256.653/0001-40")).toBe("14256653000140");
  });

  it("a raiz são os oito primeiros", () => {
    expect(raizDoCnpj(G91_MATRIZ)).toBe("14256653");
    expect(raizDoCnpj("123")).toBe("");
  });
});
