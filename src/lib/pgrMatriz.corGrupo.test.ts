import { describe, it, expect } from "vitest";
import { corDoGrupo, GRUPO_COR, COR_NEUTRA, GRUPO_LABEL } from "./pgrMatriz";

/**
 * As cores do mapa de riscos na coluna Agente do inventário.
 *
 * É a convenção que a NR-09 consagrou e que o técnico reconhece de olho. Errar
 * a cor num documento legal é pior do que não ter cor: quem bate o olho lê
 * "químico" onde está escrito outra coisa.
 */

describe("corDoGrupo", () => {
  it("segue a convenção do mapa de riscos", () => {
    expect(corDoGrupo("fisico").fundo).toBe("#16A34A");      // verde
    expect(corDoGrupo("quimico").fundo).toBe("#DC2626");     // vermelho
    expect(corDoGrupo("biologico").fundo).toBe("#92400E");   // marrom
    expect(corDoGrupo("ergonomico").fundo).toBe("#FACC15");  // amarelo
    expect(corDoGrupo("acidente").fundo).toBe("#2563EB");    // azul
  });

  it("cada grupo tem uma cor própria — duas iguais confundiriam a leitura", () => {
    const fundos = Object.values(GRUPO_COR).map((c) => c.fundo);
    expect(new Set(fundos).size).toBe(fundos.length);
  });

  it("o amarelo leva texto escuro; os outros, claro", () => {
    // Rótulo branco sobre amarelo some — e sumir num documento legal é o
    // mesmo que não estar lá.
    expect(corDoGrupo("ergonomico").texto).toBe("#1F2937");
    expect(corDoGrupo("fisico").texto).toBe("#FFFFFF");
    expect(corDoGrupo("quimico").texto).toBe("#FFFFFF");
  });

  it("grupo desconhecido fica cinza, não pega emprestada a cor de outro", () => {
    expect(corDoGrupo("marciano")).toEqual(COR_NEUTRA);
    expect(corDoGrupo("")).toEqual(COR_NEUTRA);
    expect(corDoGrupo(null)).toEqual(COR_NEUTRA);
    expect(corDoGrupo(undefined)).toEqual(COR_NEUTRA);
  });

  it("item antigo de psicossocial/outros fica cinza em vez de sem cor", () => {
    // Os dois saíram do seletor, mas quem já gravou continua vendo a linha.
    expect(corDoGrupo("psicossocial")).toEqual(COR_NEUTRA);
    expect(corDoGrupo("outro")).toEqual(COR_NEUTRA);
  });

  it("não se importa com caixa nem espaço", () => {
    expect(corDoGrupo(" Físico ".toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")).fundo)
      .toBe("#16A34A");
    expect(corDoGrupo("QUIMICO").fundo).toBe("#DC2626");
  });

  it("todo grupo com cor tem rótulo — senão a célula sai colorida e muda", () => {
    for (const chave of Object.keys(GRUPO_COR)) {
      expect(GRUPO_LABEL[chave], `sem rótulo: ${chave}`).toBeTruthy();
    }
  });
});
