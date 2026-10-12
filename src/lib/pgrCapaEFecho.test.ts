import { describe, expect, it } from "vitest";
import { render } from "./pgrPdf";
import { CTX } from "./pgrPdfContexto.fixture";
import { CLASSE_FAIXA, faixasConferem, classificarRisco } from "./pgrMatriz";

/**
 * Texto desenhado, página por página.
 *
 * O jsPDF guarda o conteúdo de cada página separado, então dá para perguntar
 * o que está NA CAPA — que é o que este arquivo precisa saber — em vez de
 * procurar no documento inteiro e aceitar um acerto vindo da página 3.
 */
function textoPorPagina(pdf: { internal: { pages: string[][] } }): string[] {
  return pdf.internal.pages.map((pagina) =>
    (pagina || []).join("\n")
      .split("\n")
      .flatMap((linha) => [...linha.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
        .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1")))
      .join(" | "),
  );
}

async function paginas() {
  const pdf = await render(CTX, { qrUrl: "https://x/pgr/validar/d1?v=1", pdfVersao: 1, comMarca: false });
  return textoPorPagina(pdf as never).slice(1); // índice 0 do jsPDF é vazio
}

describe("a capa só diz o que o documento é", () => {
  it("não repete a identificação da empresa nem o bloco de versões", async () => {
    const capa = (await paginas())[0];

    /* O que saiu da capa: já está no item 2, no item 1 e no rodapé final. */
    for (const fora of ["CNPJ", "Responsável Técnico", "Revisão / Data", "REV.", "PDF v"]) {
      expect(capa, `"${fora}" voltou para a capa`).not.toContain(fora);
    }
    /* O que a capa continua dizendo. */
    expect(capa).toContain("PGR");
    expect(capa).toContain("Programa de Gerenciamento de Riscos");
    expect(capa).toContain("NR-01");
  }, 30_000);

  it("a identificação continua dentro do documento", async () => {
    const miolo = (await paginas()).slice(1).join(" | ");
    expect(miolo).toContain("CNPJ");
    expect(miolo).toContain("11.222.333/0001-44");
    expect(miolo, "o número da revisão sumiu do documento").toContain("REVISÃO");
  }, 30_000);
});

describe("a legenda da matriz traz a faixa oficial", () => {
  it("escreve 13 a 15 no Substancial, não 15 a 15", async () => {
    const tudo = (await paginas()).join(" | ");
    expect(tudo).toContain("13 a 15");
    expect(tudo, "a faixa saiu da amostra da matriz, não da regra").not.toContain("15 a 15");
    for (const faixa of ["1 a 3", "4 a 8", "9 a 12", "16 a 25"]) {
      expect(tudo, `faltou a faixa ${faixa}`).toContain(faixa);
    }
  }, 30_000);

  it("as faixas escritas e a regra que classifica dizem a mesma coisa", () => {
    expect(faixasConferem()).toBe(true);
    /* E de novo aqui, nível por nível, para o teste não depender só da função. */
    for (let s = 1; s <= 5; s++) {
      for (let p = 1; p <= 5; p++) {
        const classe = classificarRisco(s, p)!;
        const [de, ate] = CLASSE_FAIXA[classe];
        expect(s * p, `P=${p} S=${s} caiu fora da faixa de ${classe}`)
          .toBeGreaterThanOrEqual(de);
        expect(s * p).toBeLessThanOrEqual(ate);
      }
    }
  });
});

describe("o fecho não se contradiz", () => {
  it("sem assinatura registrada, não afirma assinatura com hash e MFA", async () => {
    const tudo = (await paginas()).join(" | ");
    expect(tudo).toContain("Responsável técnico pela elaboração");
    expect(tudo, "diz que há assinatura com hash e, na linha seguinte, que não há")
      .not.toContain("hash SHA-256 e MFA verificado");
  }, 30_000);

  it("com assinatura registrada, a nota aparece", async () => {
    const pdf = await render(
      { ...CTX, assinaturas: [{
        id: "s1", responsavel_nome: "Maria Souza", responsavel_registro: "CREA 123",
        assinado_em: "2026-07-01T12:00:00Z", mfa_verificado: true, pdf_versao: 1,
        pdf_hash: "abc123",
      }] as never },
      { qrUrl: "https://x", pdfVersao: 1, comMarca: false },
    );
    const tudo = textoPorPagina(pdf as never).join(" | ");
    expect(tudo).toContain("hash SHA-256 e MFA verificado");
  }, 30_000);
});

describe("a legenda do plano de ação", () => {
  it("lista o status que está na tabela e não lista o que não está", async () => {
    const pdf = await render(
      {
        ...CTX,
        acoes: [{ ...(CTX.acoes as never[])[0] as object, status: "cancelada" }] as never,
      },
      { qrUrl: "https://x", pdfVersao: 1, comMarca: false },
    );
    const tudo = textoPorPagina(pdf as never).join(" | ");
    const legenda = tudo.slice(tudo.indexOf("Mês marcado"));
    expect(legenda, "a ação Cancelada saiu da tabela sem constar da legenda")
      .toContain("Cancelada");
    expect(legenda, "a legenda lista status que não existe nenhum na tabela")
      .not.toContain("Concluída");
  }, 30_000);
});
