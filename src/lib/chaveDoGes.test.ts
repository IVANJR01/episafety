import { describe, it, expect } from "vitest";
import {
  chaveDoGes,
  codigoVisivelDoGes,
  nomeVisivelDoGes,
  codigosDuplicados,
} from "./chaveDoGes";

/**
 * Os códigos deste arquivo saíram da planilha real da G91: a coluna GES
 * do "Inventário de Risco e Plano de Ação 2026" guarda 1.0, 2.0, 3.0,
 * 3.1, 10.1, 12.4 — números do Excel, não texto.
 */

describe("o Excel escreve o inteiro com .0", () => {
  it("1.0 é o GES 1, não o GES 10", () => {
    expect(chaveDoGes("1.0")).toBe("1");
    expect(chaveDoGes("10.0")).toBe("10");
    expect(chaveDoGes("12.0")).toBe("12");
  });

  it("o subgrupo de verdade é preservado", () => {
    /* 3.1 é um GES diferente de 3: outro grupo de expostos na COSTURA. */
    expect(chaveDoGes("3.1")).toBe("3.1");
    expect(chaveDoGes("10.2")).toBe("10.2");
    expect(chaveDoGes("12.4")).toBe("12.4");
    expect(chaveDoGes("3.1")).not.toBe(chaveDoGes("3.0"));
  });

  it("vírgula decimal é a mesma coisa que ponto", () => {
    expect(chaveDoGes("3,1")).toBe("3.1");
  });
});

describe("as três grafias do mesmo GES casam entre si", () => {
  /*
   * No banco do cliente o GES 1 existia como "GES 01" enquanto os
   * riscos procuravam por "01". Ninguém achou ninguém, e os quatro
   * riscos de PCP, FINANCEIRO, RH e SESMT ficaram sem GES.
   */
  it("GES 01, 01, 1 e 1.0 são o mesmo grupo", () => {
    const chaves = ["GES 01", "01", "1", "1.0", "ges 1", "GHE 01"].map(chaveDoGes);
    expect(new Set(chaves).size, `grafias viraram ${new Set(chaves).size} GES: ${chaves}`).toBe(1);
  });

  it("outros jeitos de escrever o prefixo também casam", () => {
    expect(chaveDoGes("GES-02")).toBe("2");
    expect(chaveDoGes("GES: 02")).toBe("2");
    expect(chaveDoGes("GES nº 02")).toBe("2");
    expect(chaveDoGes("  GES   02  ")).toBe("2");
  });

  it("GES diferentes continuam diferentes", () => {
    expect(chaveDoGes("01")).not.toBe(chaveDoGes("02"));
    expect(chaveDoGes("1")).not.toBe(chaveDoGes("10"));
    expect(chaveDoGes("12.1")).not.toBe(chaveDoGes("12.2"));
  });

  it("palavra que começa com GES não perde letra", () => {
    /* "GESTÃO" não pode virar "TÃO". */
    expect(chaveDoGes("GESTÃO")).toBe("gestao");
    expect(chaveDoGes("Gestantes")).toBe("gestantes");
  });

  it("código que não é número casa consigo mesmo, sem acento nem caixa", () => {
    expect(chaveDoGes("ADMINISTRATIVO")).toBe(chaveDoGes("administrativo"));
    expect(chaveDoGes("Produção")).toBe(chaveDoGes("PRODUCAO"));
    expect(chaveDoGes("ADMINISTRATIVO")).not.toBe(chaveDoGes("PRODUCAO"));
  });

  it("vazio não casa com nada", () => {
    expect(chaveDoGes("")).toBe("");
    expect(chaveDoGes(null)).toBe("");
    expect(chaveDoGes(undefined)).toBe("");
  });
});

describe("o código que aparece na tela", () => {
  it("a parte inteira sempre com dois dígitos", () => {
    /*
     * A Estrutura ocupacional mostrava "03, 3.1" no setor COSTURA —
     * dois irmãos escritos de jeitos diferentes na mesma linha.
     */
    expect(codigoVisivelDoGes("3.0")).toBe("03");
    expect(codigoVisivelDoGes("3.1")).toBe("03.1");
    expect(codigoVisivelDoGes("10.1")).toBe("10.1");
    expect(codigoVisivelDoGes("GES 01")).toBe("01");
  });

  it("mostrar não muda a chave: as duas formas continuam o mesmo GES", () => {
    for (const bruto of ["1.0", "01", "GES 1", "3.1", "12.4", "17.0"]) {
      expect(chaveDoGes(codigoVisivelDoGes(bruto)), `${bruto} mudou de GES ao ser exibido`)
        .toBe(chaveDoGes(bruto));
    }
  });

  it("código de texto é mostrado como veio", () => {
    expect(codigoVisivelDoGes("ADMINISTRATIVO")).toBe("ADMINISTRATIVO");
  });

  it("o nome usa o código quando o documento não trouxe nome", () => {
    expect(nomeVisivelDoGes("1.0")).toBe("GES 01");
    expect(nomeVisivelDoGes("3.1")).toBe("GES 03.1");
    expect(nomeVisivelDoGes("1.0", "Administrativo")).toBe("Administrativo");
    expect(nomeVisivelDoGes("GES 05")).toBe("GES 05");
  });
});

describe("avisar o duplicado antes de gravar", () => {
  it("aponta as grafias que viraram GES repetido", () => {
    /*
     * Foi o que aconteceu de verdade: reimportar o mesmo PGR deixou 34
     * GES onde a planilha tem 25.
     */
    expect(codigosDuplicados(["01", "1", "02", "3.1"])).toEqual([["01", "1"]]);
  });

  it("a mesma grafia repetida não é divergência", () => {
    expect(codigosDuplicados(["01", "01", "02"])).toEqual([]);
  });

  it("planilha sem repetição não acusa nada", () => {
    const daG91 = ["1.0", "2.0", "3.0", "3.1", "4.0", "10.1", "10.2", "12.4"];
    expect(codigosDuplicados(daG91)).toEqual([]);
  });

  it("acha mais de um par", () => {
    const achados = codigosDuplicados(["01", "1", "GES 02", "2", "03"]);
    expect(achados).toHaveLength(2);
  });
});
