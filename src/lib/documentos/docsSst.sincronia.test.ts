import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { DOCUMENTOS_SST } from "./docsSst";

/*
 * docsSst.ts é gerado a partir do pacote original. Se alguém editar um dos
 * dois lados sem rodar `npm run documentos:sincronizar`, os textos de norma
 * passam a divergir em silêncio — e é justamente o texto da NR que não pode
 * sair errado no documento do cliente.
 */
const requireCjs = createRequire(import.meta.url);
const ORIGINAL = requireCjs(
  path.resolve(__dirname, "../../../ferramentas/documentos/gerador/docs.js"),
);

describe("docsSst.ts x pacote original", () => {
  it("tem exatamente o mesmo conteúdo", () => {
    expect(DOCUMENTOS_SST).toEqual(ORIGINAL);
  });

  it("traz os seis documentos", () => {
    expect(DOCUMENTOS_SST.map((d) => d.sigla)).toEqual(["PGR", "PCMSO", "AET", "AEP", "LTI", "LTP"]);
  });
});
