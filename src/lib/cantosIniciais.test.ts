import { describe, expect, it } from "vitest";
import { cantosIniciais, ordenarCantos, tamanhoDestino } from "./perspectiva";

describe("cantosIniciais", () => {
  it("começa com a foto inteira, sem recuo nenhum", () => {
    // O padrão antigo entrava 6% em cada borda. Quem enquadrava a folha
    // ocupando a largura toda e tocava direto em "Endireitar e usar"
    // perdia 6% de cada lado do documento, sem aviso.
    expect(cantosIniciais(1200, 1600)).toEqual([
      { x: 0, y: 0 },
      { x: 1200, y: 0 },
      { x: 1200, y: 1600 },
      { x: 0, y: 1600 },
    ]);
  });

  it("não perde um pixel sequer de largura nem de altura", () => {
    const pts = cantosIniciais(1000, 750);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(1000);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(750);
  });

  it("sai na ordem que o endireitamento espera", () => {
    // ordenarCantos normaliza, mas se o padrão já sair torto qualquer
    // engano vira uma página espelhada ou girada.
    // A tupla e' [sup-esq, sup-dir, inf-dir, inf-esq].
    const quad = ordenarCantos(cantosIniciais(800, 600));
    expect(quad[0]).toEqual({ x: 0, y: 0 });
    expect(quad[1]).toEqual({ x: 800, y: 0 });
    expect(quad[2]).toEqual({ x: 800, y: 600 });
    expect(quad[3]).toEqual({ x: 0, y: 600 });
  });

  it("produz destino do tamanho da própria foto", () => {
    // Sem recorte, endireitar não deve encolher a página.
    const { largura, altura } = tamanhoDestino(ordenarCantos(cantosIniciais(1600, 1200)));
    expect(largura).toBe(1600);
    expect(altura).toBe(1200);
  });
});
