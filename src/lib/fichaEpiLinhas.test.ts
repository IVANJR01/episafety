import { describe, it, expect } from "vitest";
import { linhasDaFicha, type MovimentoDaFicha } from "./fichaEpiLinhas";

const CA: Record<string, string> = { plug: "5745", pff2: "38503", plug2: "5745" };
const ca = (id: string) => CA[id];
let seq = 0;
const mov = (p: Partial<MovimentoDaFicha>): MovimentoDaFicha => ({
  id: `m${++seq}`, epi_id: "plug", data: "2026-11-16", created_at: `2026-11-16T10:00:0${seq % 10}`,
  tipo: "entrega", status: "entregue", ...p,
});

describe("linhasDaFicha", () => {
  it("o caso da ficha do print: devolução vira data na linha da entrega, sem linha a mais", () => {
    const plug = mov({ epi_id: "plug", status: "devolvido", created_at: "2026-11-16T16:42:00" });
    const pff2 = mov({ epi_id: "pff2", status: "devolvido", created_at: "2026-11-16T16:42:01" });
    const devPlug = mov({ epi_id: "plug", tipo: "devolucao", status: "devolvido", data: "2026-11-17", created_at: "2026-11-17T09:00:00" });
    const devPff2 = mov({ epi_id: "pff2", tipo: "devolucao", status: "devolvido", data: "2026-11-17", created_at: "2026-11-17T09:00:01" });
    const linhas = linhasDaFicha([devPff2, devPlug, pff2, plug], ca);
    expect(linhas.map((l) => l.id)).toEqual([pff2.id, plug.id]);
    expect(linhas.every((l) => l.data_devolucao === "2026-11-17")).toBe(true);
  });

  it("a substituição continua na ficha: é uma entrega nova, com assinatura", () => {
    const velha = mov({ status: "substituido", created_at: "2026-11-01T08:00:00" });
    const nova = mov({ tipo: "substituicao", data: "2026-11-10", created_at: "2026-11-10T08:00:00" });
    const linhas = linhasDaFicha([velha, nova], ca);
    expect(linhas).toHaveLength(2);
    expect(linhas.find((l) => l.id === velha.id)!.data_devolucao).toBe("2026-11-10");
    expect(linhas.find((l) => l.id === nova.id)!.data_devolucao).toBeNull();
  });

  it("duas entregas do mesmo EPI devolvidas em dias diferentes: cada uma com a sua data", () => {
    const a = mov({ status: "devolvido", created_at: "2026-10-01T08:00:00" });
    const devA = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-05", created_at: "2026-10-05T08:00:00" });
    const b = mov({ status: "devolvido", created_at: "2026-10-06T08:00:00" });
    const devB = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-20", created_at: "2026-10-20T08:00:00" });
    const linhas = linhasDaFicha([a, devA, b, devB], ca);
    expect(linhas.map((l) => [l.id, l.data_devolucao])).toEqual([[a.id, "2026-10-05"], [b.id, "2026-10-20"]]);
  });

  it("duas entregas abertas ao mesmo tempo: cada devolução fecha uma só", () => {
    const a = mov({ status: "devolvido", created_at: "2026-10-01T08:00:00" });
    const b = mov({ status: "devolvido", created_at: "2026-10-02T08:00:00" });
    const devA = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-05", created_at: "2026-10-05T08:00:00" });
    const devB = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-20", created_at: "2026-10-20T08:00:00" });
    const linhas = linhasDaFicha([a, b, devA, devB], ca);
    expect(linhas.map((l) => [l.id, l.data_devolucao])).toEqual([[a.id, "2026-10-05"], [b.id, "2026-10-20"]]);
  });

  it("devolução anterior à entrega não fecha essa entrega", () => {
    const antiga = mov({ tipo: "devolucao", status: "devolvido", data: "2026-09-01", created_at: "2026-09-01T08:00:00" });
    const a = mov({ status: "devolvido", created_at: "2026-10-01T08:00:00" });
    const devA = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-05", created_at: "2026-10-05T08:00:00" });
    const linhas = linhasDaFicha([antiga, a, devA], ca);
    expect(linhas.find((l) => l.id === a.id)!.data_devolucao).toBe("2026-10-05");
    expect(linhas.map((l) => l.id)).toContain(antiga.id);
  });

  it("mesmo CA em cadastro de EPI diferente ainda é o mesmo EPI", () => {
    const a = mov({ epi_id: "plug", status: "devolvido", created_at: "2026-10-01T08:00:00" });
    const dev = mov({ epi_id: "plug2", tipo: "devolucao", status: "devolvido", data: "2026-10-05", created_at: "2026-10-05T08:00:00" });
    expect(linhasDaFicha([a, dev], ca).map((l) => l.id)).toEqual([a.id]);
  });

  it("devolução de outro EPI não fecha a entrega errada", () => {
    const a = mov({ epi_id: "plug", status: "devolvido", created_at: "2026-10-01T08:00:00" });
    const dev = mov({ epi_id: "pff2", tipo: "devolucao", status: "devolvido", data: "2026-10-05", created_at: "2026-10-05T08:00:00" });
    const linhas = linhasDaFicha([a, dev], ca);
    expect(linhas).toHaveLength(2);
  });

  it("devolução cuja entrega foi apagada continua aparecendo", () => {
    const dev = mov({ tipo: "devolucao", status: "devolvido", data: "2026-10-05" });
    expect(linhasDaFicha([dev], ca)).toHaveLength(1);
  });

  it("entrega ainda em uso não tem data de devolução", () => {
    expect(linhasDaFicha([mov({})], ca)[0].data_devolucao).toBeNull();
  });
});
