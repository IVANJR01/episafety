import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { gerarDocumentoBuffer, DadosDocumento } from "./gerarDocx";
import { CLASSE_HEX_OFICIAL, CLASSE_HEX, CLASSES_ORDENADAS, PgrClasse } from "@/lib/pgrMatriz";

/*
 * A MESMA cor na tela, no PDF e no Word.
 *
 * Esta é a ligação que faltava: a tela usava a paleta do Tailwind e o
 * documento entregue ao cliente usava as cores da planilha. Como são dois
 * arquivos diferentes, nada impedia um de andar sem o outro — e a divergência
 * só apareceria quando o cliente comparasse a tela com o Word.
 *
 * Aqui o teste GERA o documento e confere que as faixas saíram pintadas
 * exatamente com os hexadecimais declarados em pgrMatriz.ts.
 */
const PACOTE = path.resolve(__dirname, "../../../ferramentas/documentos");
const DADOS: DadosDocumento = JSON.parse(
  fs.readFileSync(path.join(PACOTE, "exemplo/dados_exemplo.json"), "utf8"),
);

const ESPERADO: Record<PgrClasse, string> = {
  trivial: "00B0F0",
  toleravel: "92D050",
  moderado: "FFFF00",
  substancial: "FFC000",
  intoleravel: "C00000",
};

describe("cores oficiais da classificação", () => {
  it("pgrMatriz.ts declara os hexadecimais da planilha", () => {
    expect(CLASSE_HEX_OFICIAL).toEqual(ESPERADO);
  });

  it("a versão RGB usada no PDF é a conversão fiel desses hexadecimais", () => {
    for (const classe of CLASSES_ORDENADAS) {
      const hex = CLASSE_HEX_OFICIAL[classe];
      const esperado = [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
      expect(CLASSE_HEX[classe], `RGB de ${classe}`).toEqual(esperado);
    }
  });

  it("o Word sai pintado com exatamente essas cores", async () => {
    const zip = await JSZip.loadAsync(await gerarDocumentoBuffer("PGR", DADOS));
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const classe of CLASSES_ORDENADAS) {
      expect(xml, `faixa ${classe}`).toContain(`w:fill="${CLASSE_HEX_OFICIAL[classe]}"`);
    }
  }, 30_000);

  it("o Word não usa nenhuma cor da paleta antiga do Tailwind", async () => {
    const zip = await JSZip.loadAsync(await gerarDocumentoBuffer("PGR", DADOS));
    const xml = await zip.file("word/document.xml")!.async("string");
    /* esmeralda, lima, amarelo-500, laranja-500 e vermelho-600 do Tailwind. */
    for (const antiga of ["10B981", "84CC16", "EAB308", "F97316", "DC2626"]) {
      expect(xml, `cor antiga ${antiga} reapareceu`).not.toContain(antiga);
    }
  }, 30_000);
});
