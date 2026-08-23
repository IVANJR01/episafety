import { describe, it, expect } from "vitest";
import { ordenarInventario } from "./inventarioOrdem";

/**
 * "GES 01 primeiro, depois 02."
 *
 * A tabela saía com ESCRITÓRIO (02) antes de PCP (01), porque ordenava por
 * nome do setor.
 *
 * A armadilha: a tabela mescla Ambiente, Setor e Processo ao longo das linhas
 * de um mesmo setor, e mesclar só funciona em linhas VIZINHAS. Ordenar direto
 * pelo GES separa as linhas de um setor com mais de um grupo, e o parágrafo do
 * ambiente volta a ser reimpresso em cada grupo — defeito que já existiu aqui.
 */

type Linha = { id: string; setor: string; ges: string; perigo: string };
const ler = {
  chaveSetor: (l: Linha) => l.setor,
  codigoGes: (l: Linha) => l.ges,
  desempate: (l: Linha) => l.perigo + l.id,
};
const linha = (id: string, setor: string, ges: string, perigo = "P") =>
  ({ id, setor, ges, perigo });

describe("ordenarInventario", () => {
  it("põe o GES 01 antes do 02, mesmo com o setor do 02 vindo antes no alfabeto", () => {
    const r = ordenarInventario([
      linha("a", "ESCRITÓRIO", "02"),
      linha("b", "PCP", "01"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["01", "02"]);
  });

  it("MANTÉM as linhas de um setor grudadas — é o que preserva a mesclagem", () => {
    // COSTURA tem dois grupos (01 e 03) e ESCRITÓRIO tem o 02. Ordenar só pelo
    // GES daria 01(COSTURA), 02(ESCRITÓRIO), 03(COSTURA) — e o ambiente da
    // COSTURA seria reimpresso, porque as linhas dela ficariam separadas.
    const r = ordenarInventario([
      linha("c", "ESCRITÓRIO", "02"),
      linha("a", "COSTURA", "01"),
      linha("b", "COSTURA", "03"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["COSTURA", "COSTURA", "ESCRITÓRIO"]);
    expect(r.map((l) => l.ges)).toEqual(["01", "03", "02"]);
  });

  it("dentro do setor, ordena por GES", () => {
    const r = ordenarInventario([
      linha("b", "COSTURA", "07"),
      linha("a", "COSTURA", "03"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["03", "07"]);
  });

  it("09 vem antes de 10 — comparação numérica, não de texto", () => {
    const r = ordenarInventario([
      linha("a", "A", "10"), linha("b", "B", "9"),
    ], ler);
    expect(r.map((l) => l.ges)).toEqual(["9", "10"]);
  });

  it("linha sem GES vai para o fim, sem atropelar as numeradas", () => {
    const r = ordenarInventario([
      linha("a", "SEM", ""), linha("b", "PCP", "01"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["PCP", "SEM"]);
  });

  it("dois setores com o mesmo menor GES ficam em ordem estável, por nome", () => {
    const r = ordenarInventario([
      linha("b", "ZELADORIA", "05"), linha("a", "ALMOXARIFADO", "05"),
    ], ler);
    expect(r.map((l) => l.setor)).toEqual(["ALMOXARIFADO", "ZELADORIA"]);
  });

  it("mesmo GES e mesmo setor: desempata pelo perigo", () => {
    const r = ordenarInventario([
      linha("b", "PCP", "01", "Ruído"), linha("a", "PCP", "01", "Postura"),
    ], ler);
    expect(r.map((l) => l.perigo)).toEqual(["Postura", "Ruído"]);
  });

  it("lista vazia não quebra", () => {
    expect(ordenarInventario([], ler)).toEqual([]);
  });
});
