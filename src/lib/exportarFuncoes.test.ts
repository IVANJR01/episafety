import { describe, it, expect } from "vitest";
import {
  linhasDeFuncoes, nomeArquivoFuncoes, montarPlanilhaFuncoes, CABECALHO_FUNCOES,
} from "./exportarFuncoes";

/**
 * A planilha existe para o gestor revisar a DESCRIÇÃO das funções. Duas coisas
 * a tornariam inútil, e as duas eram fáceis de deixar passar:
 *
 * - mandar a descrição cortada, como aparece na tela (ela sai com reticências);
 * - esconder as descrições em branco atrás de um "não informado", justamente
 *   as linhas que o gestor precisa achar.
 */

const setores: Record<string, string> = { "s1": "COSTURA", "s2": "PCP" };
const nomeDoSetor = (id?: string | null) => (id ? setores[id] : null);

describe("linhasDeFuncoes", () => {
  it("leva nome, setor e descrição, nessa ordem", () => {
    const r = linhasDeFuncoes(
      [{ nome: "Ajudante", setor_id: "s1", descricao_atividades: "Auxiliar no corte." }],
      nomeDoSetor,
    );
    expect(r).toEqual([["Ajudante", "COSTURA", "Auxiliar no corte."]]);
  });

  it("manda a descrição INTEIRA — na tela ela sai cortada, e é ela que o gestor lê", () => {
    const longa = "Planejar, programar e controlar as etapas do processo produtivo; " +
      "emitir e acompanhar as ordens de produção; monitorar prazos, quantidades " +
      "produzidas, perdas e atrasos; atualizar registros e indicadores.";
    const [linha] = linhasDeFuncoes(
      [{ nome: "Analista de PCP", setor_id: "s2", descricao_atividades: longa }], nomeDoSetor);
    expect(linha[2]).toBe(longa);
  });

  it("função sem setor sai como 'Sem setor', não como traço", () => {
    // Quem abre a planilha fora do sistema não sabe que "—" quer dizer ausente.
    const [linha] = linhasDeFuncoes([{ nome: "Ajudante", setor_id: null }], nomeDoSetor);
    expect(linha[1]).toBe("Sem setor");
  });

  it("descrição vazia sai VAZIA — é o que o gestor precisa enxergar de relance", () => {
    const [linha] = linhasDeFuncoes(
      [{ nome: "Caixa", setor_id: "s1", descricao_atividades: null }], nomeDoSetor);
    expect(linha[2]).toBe("");
  });

  it("preserva a ordem da tela, sem reordenar por conta própria", () => {
    const r = linhasDeFuncoes([
      { nome: "Zelador", setor_id: "s1" }, { nome: "Analista", setor_id: "s2" },
    ], nomeDoSetor);
    expect(r.map((l) => l[0])).toEqual(["Zelador", "Analista"]);
  });

  it("lista vazia não quebra", () => {
    expect(linhasDeFuncoes([], nomeDoSetor)).toEqual([]);
  });
});

describe("nomeArquivoFuncoes", () => {
  it("identifica empresa e data sem precisar abrir o arquivo", () => {
    const nome = nomeArquivoFuncoes("LEONARDO A. DE ARAUJO LTDA");
    expect(nome).toMatch(/^Funcoes_LEONARDO_A_DE_ARAUJO_LTDA_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("inclui o setor quando a exportação é de um setor só", () => {
    expect(nomeArquivoFuncoes("Empresa", "COSTURA")).toContain("_COSTURA_");
  });

  it("sem empresa nem setor, ainda gera um nome válido", () => {
    expect(nomeArquivoFuncoes()).toMatch(/^Funcoes_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("acento e barra não vazam para o nome do arquivo", () => {
    expect(nomeArquivoFuncoes("Ação / Refrigeração")).toMatch(/^Funcoes_Acao_Refrigeracao_/);
  });
});

describe("montarPlanilhaFuncoes", () => {
  it("a primeira linha é o cabeçalho", () => {
    const wb = montarPlanilhaFuncoes([["Ajudante", "COSTURA", "Auxiliar."]]);
    const ws = wb.Sheets["Funções"];
    expect([ws["A1"].v, ws["B1"].v, ws["C1"].v]).toEqual(CABECALHO_FUNCOES);
    expect(ws["A2"].v).toBe("Ajudante");
  });

  it("congela o cabeçalho e liga o filtro — a lista passa de quarenta linhas", () => {
    const wb = montarPlanilhaFuncoes([["A", "B", "C"]]);
    const ws = wb.Sheets["Funções"];
    expect(ws["!freeze"]).toBeTruthy();
    expect(ws["!autofilter"]).toBeTruthy();
  });

  it("a coluna da descrição não sai espremida, mas também não vira uma faixa", () => {
    const longa = "x".repeat(500);
    const ws = montarPlanilhaFuncoes([["A", "B", longa]]).Sheets["Funções"];
    const largura = (ws["!cols"] as { wch: number }[])[2].wch;
    expect(largura).toBeGreaterThan(20);
    expect(largura).toBeLessThanOrEqual(80);
  });
});
