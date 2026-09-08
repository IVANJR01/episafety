import { describe, expect, it } from "vitest";
import { linhaDoAssinante, ASSINANTE_DIGITAL } from "./assinanteDigital";

describe("linhaDoAssinante", () => {
  it("identifica o emissor com nome e CNPJ", () => {
    const linha = linhaDoAssinante({ nome: "3M CURSOS E TREINAMENTOS", cnpj: "51.489.453/0001-64" });
    expect(linha).toBe(
      "Emitido e assinado digitalmente por 3M CURSOS E TREINAMENTOS — CNPJ 51.489.453/0001-64",
    );
  });

  it("omite o CNPJ quando ele não está configurado, sem deixar traço solto", () => {
    const linha = linhaDoAssinante({ nome: "CONSULTORIA X", cnpj: "" });
    expect(linha).toBe("Emitido e assinado digitalmente por CONSULTORIA X");
    expect(linha).not.toContain("—");
    expect(linha).not.toContain("CNPJ");
  });

  it("não desenha linha nenhuma quando o nome está vazio", () => {
    // Rodapé sem emissor é melhor do que rodapé afirmando que alguém assinou
    // sem dizer quem — é justamente o buraco que essa linha veio tapar.
    expect(linhaDoAssinante({ nome: "   ", cnpj: "51.489.453/0001-64" })).toBe("");
  });

  it("ignora espaços em volta dos valores configurados", () => {
    expect(linhaDoAssinante({ nome: "  ACME  ", cnpj: "  11.222.333/0001-81  " })).toBe(
      "Emitido e assinado digitalmente por ACME — CNPJ 11.222.333/0001-81",
    );
  });

  it("usa o MEI da 3M como padrão do sistema", () => {
    // O CNPJ aqui precisa ser o mesmo do certificado cadastrado em
    // CERT_A1_PFX_BASE64, senão o rodapé e a assinatura se contradizem.
    expect(ASSINANTE_DIGITAL.cnpj).toBe("51.489.453/0001-64");
    expect(ASSINANTE_DIGITAL.nome).toBe("3M CURSOS E TREINAMENTOS");
  });
});
