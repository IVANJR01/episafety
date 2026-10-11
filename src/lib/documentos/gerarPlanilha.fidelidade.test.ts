import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { montarPlanilha, nomePlanilha, type DadosPlanilha } from "./gerarPlanilha";
import { compararPlanilha, type AbaComparada } from "./comparaPlanilha";

/*
 * A planilha gerada tem de ser a MESMA que veio no pacote.
 *
 * O exemplo `exemplo/Inventario_Exemplo.xlsx` foi gerado pelo script Python
 * original a partir de `exemplo/dados_exemplo.json`. Aqui geramos a mesma
 * planilha pelo porte em TypeScript e comparamos as duas com o MESMO leitor,
 * para que diferença de biblioteca não se confunda com diferença de conteúdo.
 */
const PACOTE = path.resolve(__dirname, "../../../ferramentas/documentos");
const DADOS: DadosPlanilha = JSON.parse(
  fs.readFileSync(path.join(PACOTE, "exemplo/dados_exemplo.json"), "utf8"),
);

async function doExemplo(): Promise<AbaComparada[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(PACOTE, "exemplo/Inventario_Exemplo.xlsx"));
  return compararPlanilha(wb);
}

async function doPorte(dados = DADOS): Promise<AbaComparada[]> {
  /* Escrita e relida, para passar pelo mesmo caminho do arquivo do pacote. */
  const buffer = await montarPlanilha(dados).xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return compararPlanilha(wb);
}

describe("planilha gerada x planilha do pacote", () => {
  it("tem as mesmas três abas, na mesma ordem", async () => {
    const [exemplo, porte] = await Promise.all([doExemplo(), doPorte()]);
    expect(porte.map((a) => a.nome)).toEqual(exemplo.map((a) => a.nome));
    expect(porte.map((a) => a.nome)).toEqual([
      "INVENTÁRIO DE RISCOS", "PLANO DE AÇÃO 5W2H", "MATRIZ DE RISCO 5X5",
    ]);
  }, 60_000);

  it.each([0, 1, 2])("a aba %i sai com as mesmas células, cores e fórmulas", async (i) => {
    const [exemplo, porte] = await Promise.all([doExemplo(), doPorte()]);
    const a = exemplo[i];
    const b = porte[i];
    /* Endereço a endereço, para a falha dizer QUAL célula divergiu. */
    expect(Object.keys(b.celulas).sort()).toEqual(Object.keys(a.celulas).sort());
    for (const endereco of Object.keys(a.celulas)) {
      expect(b.celulas[endereco], `${a.nome}!${endereco}`).toEqual(a.celulas[endereco]);
    }
  }, 60_000);

  it.each([0, 1, 2])("a aba %i sai com a mesma estrutura", async (i) => {
    const [exemplo, porte] = await Promise.all([doExemplo(), doPorte()]);
    const a = exemplo[i];
    const b = porte[i];
    expect(b.mescladas, `${a.nome}: mescladas`).toEqual(a.mescladas);
    expect(b.larguras, `${a.nome}: larguras`).toEqual(a.larguras);
    expect(b.alturas, `${a.nome}: alturas`).toEqual(a.alturas);
    expect(b.congelado, `${a.nome}: painel congelado`).toEqual(a.congelado);
    expect(b.cf, `${a.nome}: formatação condicional`).toEqual(a.cf);
    expect(b.dv, `${a.nome}: listas suspensas`).toEqual(a.dv);
  }, 60_000);

  it("nomeia o arquivo como o pacote", () => {
    expect(nomePlanilha(DADOS)).toBe("Inventario_Exemplo.xlsx");
    expect(nomePlanilha({})).toBe("Inventario_Modelo.xlsx");
  });
});
