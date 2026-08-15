import { describe, it, expect } from "vitest";
import { mapearComLimite } from "./limitarConcorrencia";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("mapearComLimite", () => {
  it("preserva a ordem do resultado, mesmo terminando fora de ordem", async () => {
    const r = await mapearComLimite([30, 5, 20, 1], 4, async (ms, i) => {
      await esperar(ms);
      return i;
    });
    expect(r).toEqual([0, 1, 2, 3]);
  });

  it("nunca passa do teto de tarefas simultâneas", async () => {
    let agora = 0;
    let pico = 0;
    await mapearComLimite(Array.from({ length: 20 }), 4, async () => {
      agora++;
      pico = Math.max(pico, agora);
      await esperar(5);
      agora--;
    });
    expect(pico).toBe(4);
  });

  it("uma tarefa lenta não trava as outras — era este o custo dos lotes", async () => {
    // Uma tarefa de 120ms e nove de 10ms, com teto 3. Em lotes travados de 3,
    // a rodada da lenta custaria 120ms sozinha. Aqui os outros trabalhadores
    // seguem puxando da fila enquanto ela roda.
    const tempos = [120, ...Array.from({ length: 9 }, () => 10)];
    const inicio = Date.now();
    await mapearComLimite(tempos, 3, async (ms) => { await esperar(ms); });
    const total = Date.now() - inicio;
    // O piso teórico é 120ms (a lenta). Em lote travado seriam ~120 + 3 * 10.
    expect(total).toBeLessThan(200);
  });

  it("teto maior que a lista não cria trabalhador à toa", async () => {
    let pico = 0, agora = 0;
    await mapearComLimite([1, 2], 50, async () => {
      agora++; pico = Math.max(pico, agora);
      await esperar(5);
      agora--;
    });
    expect(pico).toBe(2);
  });

  it("lista vazia devolve vazio sem chamar a tarefa", async () => {
    let chamou = false;
    const r = await mapearComLimite([], 4, async () => { chamou = true; return 1; });
    expect(r).toEqual([]);
    expect(chamou).toBe(false);
  });

  it("teto inválido vira 1 em vez de travar", async () => {
    for (const teto of [0, -3, Number.NaN]) {
      const r = await mapearComLimite([1, 2, 3], teto, async (n) => n * 2);
      expect(r).toEqual([2, 4, 6]);
    }
  });

  it("rejeição sobe para o chamador, não some", async () => {
    await expect(
      mapearComLimite([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("falhou");
        return n;
      }),
    ).rejects.toThrow("falhou");
  });
});
