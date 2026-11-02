import { describe, expect, it } from "vitest";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido, CONTATO,
} from "./planosDeVenda";

/**
 * Página pública: o que estiver escrito aqui é oferta. Preço inventado
 * vira promessa que alguém vai cobrar.
 */

describe("o preço", () => {
  it("sai em reais, no formato brasileiro", () => {
    expect(precoFormatado({ ...PLANOS[0], precoMensal: 149.9 })).toContain("149,90");
    expect(precoFormatado({ ...PLANOS[0], precoMensal: 1250 })).toContain("1.250,00");
  });

  it("sem valor definido, devolve null — a página não inventa número", () => {
    expect(precoFormatado({ ...PLANOS[0], precoMensal: null })).toBeNull();
  });

  it("zero é um preço, e não 'sob consulta'", () => {
    /* Plano gratuito existe; confundir com "não definido" esconderia. */
    expect(precoFormatado({ ...PLANOS[0], precoMensal: 0 })).toContain("0,00");
  });
});

describe("o botão de contato", () => {
  it("sem número cadastrado, não há link", () => {
    /* Botão que leva a lugar nenhum é pior que botão nenhum. */
    const semNumero = { ...CONTATO };
    expect(CONTATO.whatsapp === "" ? linkDoWhatsapp() : "tem numero")
      .toBe(CONTATO.whatsapp === "" ? null : "tem numero");
    expect(semNumero).toBeTruthy();
  });

  it("com número, monta o link com a mensagem pronta", () => {
    const original = CONTATO.whatsapp;
    CONTATO.whatsapp = "55 (88) 99999-9999";
    const link = linkDoWhatsapp(PLANOS[1])!;
    expect(link).toContain("https://wa.me/5588999999999");
    expect(decodeURIComponent(link)).toContain(PLANOS[1].nome);
    CONTATO.whatsapp = original;
  });
});

describe("os planos", () => {
  it("cada plano tem nome, público e o que inclui", () => {
    for (const p of PLANOS) {
      expect(p.nome, "plano sem nome").toBeTruthy();
      expect(p.publico, `${p.nome} sem público`).toBeTruthy();
      expect(p.inclui.length, `${p.nome} sem itens`).toBeGreaterThan(0);
    }
  });

  it("só um plano é destacado", () => {
    /* Dois destaques não destacam nada. */
    expect(PLANOS.filter((p) => p.destaque).length).toBeLessThanOrEqual(1);
  });

  it("ids não se repetem", () => {
    expect(new Set(PLANOS.map((p) => p.id)).size).toBe(PLANOS.length);
  });

  it("a página sabe quando nenhum preço foi definido", () => {
    expect(algumPrecoDefinido([{ ...PLANOS[0], precoMensal: null }])).toBe(false);
    expect(algumPrecoDefinido([{ ...PLANOS[0], precoMensal: 100 }])).toBe(true);
  });
});
