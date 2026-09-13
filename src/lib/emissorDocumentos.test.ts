import { describe, expect, it } from "vitest";
import { linhasDoEmissor, EMISSOR_VAZIO, type Emissor } from "./emissorDocumentos";

function emissor(extra: Partial<Emissor> = {}): Emissor {
  return {
    nome: "3M CURSOS E TREINAMENTOS",
    slogan: "Segurança e Saúde Ocupacional",
    cnpj: "51.489.453/0001-64",
    endereco: "Rua Gilberto Gomes de Menezes, 145 - Potiretama/CE",
    contato: "contato@3m.com.br",
    logo_url: null, logo_path: null,
    ...extra,
  };
}

describe("linhasDoEmissor", () => {
  it("monta descrição, endereço e identificação, nessa ordem", () => {
    expect(linhasDoEmissor(emissor())).toEqual([
      "Segurança e Saúde Ocupacional",
      "Rua Gilberto Gomes de Menezes, 145 - Potiretama/CE",
      "CNPJ 51.489.453/0001-64  |  contato@3m.com.br",
    ]);
  });

  it("não deixa separador solto com cadastro pela metade", () => {
    // Enquanto ninguém preenche tudo, o rodapé não pode sair com " | " no ar.
    expect(linhasDoEmissor(emissor({ contato: null }))).toContain("CNPJ 51.489.453/0001-64");
    expect(linhasDoEmissor(emissor({ contato: null })).some((l) => l.includes("|"))).toBe(false);
    expect(linhasDoEmissor(emissor({ cnpj: null }))).toContain("contato@3m.com.br");
    expect(linhasDoEmissor(emissor({ cnpj: null })).some((l) => l.includes("|"))).toBe(false);
  });

  it("omite a linha inteira quando não há nem CNPJ nem contato", () => {
    const l = linhasDoEmissor(emissor({ cnpj: null, contato: null }));
    expect(l).toHaveLength(2);
    expect(l.every((s) => s.trim().length > 0)).toBe(true);
  });

  it("ignora campos que são só espaço", () => {
    expect(linhasDoEmissor(emissor({ slogan: "   ", endereco: "  " }))).toEqual([
      "CNPJ 51.489.453/0001-64  |  contato@3m.com.br",
    ]);
  });

  it("não devolve nada sem emissor", () => {
    expect(linhasDoEmissor(null)).toEqual([]);
    expect(linhasDoEmissor(EMISSOR_VAZIO)).toEqual([]);
  });
});
