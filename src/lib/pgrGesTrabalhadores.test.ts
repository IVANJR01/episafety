import { describe, expect, it } from "vitest";
import { render } from "./pgrPdf";
import { CTX } from "./pgrPdfContexto.fixture";

/**
 * Trabalhadores expostos no cabeçalho de cada GES — NR-01, item 1.5.7.3.2 "e".
 *
 * Um PGR real de 13 grupos saiu com "Trabalhadores expostos: não informado" em
 * TODOS eles, porque o número não existia no cadastro do GES e o documento só
 * olhava para o item do inventário.
 *
 * As duas fontes significam coisas diferentes, e é isso que este arquivo
 * protege: o cadastro do GES diz quantos estão NO GRUPO; o item do inventário
 * diz quantos ficam expostos ÀQUELE perigo, que pode ser parte do grupo. Quem
 * manda no cabeçalho é o grupo.
 */

function textoDo(pdf: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  return [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"))
    .join(" | ");
}

/** O contexto de teste com um nº de trabalhadores no cadastro do GES. */
function contexto(trabalhadores: number | null | undefined, expostosNoItem?: number) {
  return {
    ...CTX,
    gesDetalhes: trabalhadores === undefined
      ? []
      : [{ id: "g1", codigo: "01", nome: "01", trabalhadores }],
    inventario: (CTX.inventario as any[]).map((i) => ({
      ...i, trabalhadores_expostos: expostosNoItem ?? i.trabalhadores_expostos,
    })),
  } as never;
}

const opcoes = { qrUrl: "https://x", pdfVersao: 1, comMarca: false };

describe("nº de trabalhadores no cabeçalho do GES", () => {
  it("usa o número do cadastro do GES", async () => {
    const texto = textoDo(await render(contexto(7), opcoes));
    expect(texto).toContain("Trabalhadores expostos: 7");
  }, 30_000);

  it("o cadastro manda, mesmo que o item do inventário tenha outro número", async () => {
    /*
     * O grupo tem 7 pessoas; naquele perigo específico, 5 ficam expostas. O
     * cabeçalho é do grupo, então sai 7 — não 5.
     */
    const texto = textoDo(await render(contexto(7, 5), opcoes));
    expect(texto).toContain("Trabalhadores expostos: 7");
    expect(texto, "o cabeçalho pegou o número do item em vez do grupo")
      .not.toContain("Trabalhadores expostos: 5");
  }, 30_000);

  it("GES sem o número ainda aproveita o do inventário, em vez de regredir", async () => {
    /* Cadastro antigo, feito antes do campo existir, não pode piorar. */
    const texto = textoDo(await render(contexto(null, 5), opcoes));
    expect(texto).toContain("Trabalhadores expostos: 5");
  }, 30_000);

  it("sem número em lugar nenhum, diz 'não informado' — não inventa zero", async () => {
    const texto = textoDo(await render(contexto(null, 0), opcoes));
    expect(texto).toContain("Trabalhadores expostos: não informado");
    expect(texto, "inventou um zero que ninguém informou")
      .not.toContain("Trabalhadores expostos: 0");
  }, 30_000);

  it("zero informado de propósito sai impresso", async () => {
    /*
     * Zero expostos é uma afirmação — "ninguém trabalha exposto a isto" — e é
     * diferente de não ter sido informado. Some num `if (n)` desatento.
     */
    const texto = textoDo(await render(contexto(0), opcoes));
    expect(texto).toContain("Trabalhadores expostos: 0");
  }, 30_000);
});
