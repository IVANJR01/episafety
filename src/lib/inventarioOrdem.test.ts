import { describe, it, expect } from "vitest";
import { numerarInventario, ordenarInventario, ambienteDoItem } from "./inventarioOrdem";

/**
 * O inventário não tinha número de item. Para falar de uma linha era preciso
 * descrevê-la, e o plano de ação não tinha como apontar para ela.
 *
 * O risco de numerar é apontar para o item errado: se a tela ordenar de um
 * jeito e o Excel de outro, o "item 03" de um não é o do outro. Por isso a
 * ordem e a numeração vivem no mesmo módulo, usado pelos três.
 */

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id, setor: "PCP", grupo: "ergonomico", perigo_descricao: "Postura", ...extra,
});

describe("numerarInventario", () => {
  it("numera com dois dígitos, como o código do GES", () => {
    const n = numerarInventario([item("a"), item("b", { perigo_descricao: "Ruído" })]);
    expect(n.get("a")).toBe("01");
    expect(n.get("b")).toBe("02");
  });

  it("o número segue a ordem exibida, não a ordem de chegada", () => {
    // Chegam fora de ordem; "COSTURA" vem depois de "ALMOXARIFADO".
    const n = numerarInventario([
      item("z", { setor: "COSTURA" }),
      item("a", { setor: "ALMOXARIFADO" }),
    ]);
    expect(n.get("a")).toBe("01");
    expect(n.get("z")).toBe("02");
  });

  it("passa de 99 sem quebrar nem reiniciar", () => {
    const muitos = Array.from({ length: 100 }, (_, k) =>
      item(`i${String(k).padStart(3, "0")}`, { perigo_descricao: `P${String(k).padStart(3, "0")}` }));
    const n = numerarInventario(muitos);
    expect(n.get("i099")).toBe("100");
  });

  it("lista vazia não quebra", () => {
    expect(numerarInventario([]).size).toBe(0);
  });

  it("mesma lista, mesma numeração — sem isso o número dançaria entre telas", () => {
    // Dois itens iguais em tudo, distinguidos só pelo id: o desempate final
    // existe para eles não trocarem de lugar (e de número) a cada montagem.
    const lista = [item("bbb"), item("aaa")];
    const um = numerarInventario(lista);
    const dois = numerarInventario([...lista].reverse());
    expect(um.get("aaa")).toBe(dois.get("aaa"));
    expect(um.get("bbb")).toBe(dois.get("bbb"));
  });
});

describe("ordenarInventario", () => {
  it("agrupa por setor antes de olhar o GES — é o que permite mesclar as células", () => {
    const r = ordenarInventario([
      item("1", { setor: "PCP", ghe: { codigo: "01" } }),
      item("2", { setor: "LOJA", ghe: { codigo: "02" } }),
      item("3", { setor: "PCP", ghe: { codigo: "03" } }),
    ]);
    expect(r.map((x) => x.setor)).toEqual(["LOJA", "PCP", "PCP"]);
  });

  it("não altera a lista recebida", () => {
    const original = [item("z", { setor: "Z" }), item("a", { setor: "A" })];
    ordenarInventario(original);
    expect(original[0].id).toBe("z");
  });
});

describe("ambienteDoItem", () => {
  it("usa o ambiente da linha quando existe", () => {
    expect(ambienteDoItem({ id: "x", descricao_ambiente: "Escritório" })).toBe("Escritório");
  });

  it("cai no ambiente do GES quando a linha não tem", () => {
    expect(ambienteDoItem({ id: "x", ghe: { ambiente: "Galpão" } })).toBe("Galpão");
  });

  it("sem nenhum, devolve vazio em vez de quebrar", () => {
    expect(ambienteDoItem({ id: "x" })).toBe("");
    expect(ambienteDoItem(null)).toBe("");
  });
});
