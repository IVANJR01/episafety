import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A página de vendas é pública e é oferta: o que estiver escrito ali,
 * alguém vai cobrar. Preço que ninguém combinou não pode aparecer, e
 * botão que não leva a lugar nenhum é pior que botão nenhum.
 */

vi.mock("@/assets/logo-episafety.png", () => ({ default: "logo.png" }));
vi.mock("/marca/ficha-epi-exemplo.png", () => ({ default: "ficha.png" }));

const PLANO = {
  id: "epi", nome: "Gestão de EPIs",
  publico: "Para quem entrega EPI e precisa provar que entregou.",
  precoMensal: null as number | null, precoDe: null as number | null,
  unidade: "por empresa / mês", destaque: true,
  inclui: ["Cadastro de EPI com consulta automática do CA"],
};

async function montar(plano: Record<string, unknown>, whatsapp = "") {
  /*
   * Sem isto, a segunda montagem do mesmo teste se soma à primeira no
   * body, e a página antiga responde pela nova — um teste assim passa
   * verde sem nunca ter conferido o caso novo.
   */
  cleanup();
  vi.resetModules();
  vi.doMock("@/lib/planosDeVenda", async () => {
    const real = await vi.importActual<any>("@/lib/planosDeVenda");
    const planos = [plano];
    return {
      ...real,
      PLANOS: planos,
      CONTATO: { ...real.CONTATO, whatsapp },
      algumPrecoDefinido: () => plano.precoMensal != null,
      linkDoWhatsapp: (p?: any) => {
        const n = whatsapp.replace(/\D/g, "");
        return n ? `https://wa.me/${n}?text=${encodeURIComponent(p?.nome || "oi")}` : null;
      },
    };
  });
  const Planos = (await import("./Planos")).default;
  return render(<MemoryRouter><Planos /></MemoryRouter>);
}

const textoDaPagina = () => document.body.textContent || "";
const linksDeWhatsapp = () =>
  Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") || "")
    .filter((h) => h.includes("wa.me"));

describe("preço na página", () => {
  it("sem valor definido, não aparece nenhum valor em reais", async () => {
    await montar(PLANO);
    expect(textoDaPagina(), "apareceu um valor que ninguém definiu")
      .not.toMatch(/R\$\s?\d/);
    expect(screen.getAllByText("Sob consulta").length).toBeGreaterThan(0);
  });

  it("com valor definido, o valor aparece", async () => {
    await montar({ ...PLANO, precoMensal: 199.9 });
    expect(textoDaPagina()).toMatch(/199,90/);
    expect(screen.queryByText("Sob consulta")).toBeNull();
  });

  it("sem preço, a página explica por que não há valor", async () => {
    await montar(PLANO);
    expect(textoDaPagina()).toContain("O valor é fechado no contato");
  });

  it("desconto só aparece quando os dois preços existem", async () => {
    await montar({ ...PLANO, precoMensal: 150, precoDe: 200 });
    expect(textoDaPagina()).toContain("−25%");

    await montar({ ...PLANO, precoMensal: 150, precoDe: null });
    expect(textoDaPagina(), "inventou um desconto sem preço de referência")
      .not.toMatch(/−\d+%/);
  });
});

describe("os botões", () => {
  it("sem WhatsApp cadastrado, nenhum link aponta para o wa.me", async () => {
    await montar(PLANO, "");
    expect(linksDeWhatsapp(), "link de WhatsApp sem número cadastrado").toEqual([]);
  });

  it("com WhatsApp, os botões levam o nome do plano na mensagem", async () => {
    await montar(PLANO, "55 88 99999-9999");
    const links = linksDeWhatsapp();
    expect(links.length, "nenhum botão de WhatsApp apareceu").toBeGreaterThan(0);
    expect(links.every((h) => h.includes("5588999999999"))).toBe(true);
    expect(links.some((h) => decodeURIComponent(h).includes("Gestão de EPIs"))).toBe(true);
  });

  it("a oferta está ao alcance em qualquer ponto da página", async () => {
    /* Quem decide no meio da leitura não deve ter de procurar o botão. */
    await montar(PLANO, "55 88 99999-9999");
    expect(linksDeWhatsapp().length).toBeGreaterThanOrEqual(3);
  });
});

describe("o foco da página", () => {
  it("fala de EPI, e não dos outros módulos", async () => {
    await montar(PLANO);
    const texto = textoDaPagina();
    expect(texto).toContain("Ficha");
    expect(texto).toContain("CA");
    for (const fora of ["PGR", "PCMSO", "LTCAT", "PPP"]) {
      expect(texto, `a página voltou a falar de ${fora}`).not.toContain(fora);
    }
  });

  it("mostra a ficha gerada pelo sistema, dizendo que os dados são fictícios", async () => {
    /* Imagem de produto sem essa ressalva vira promessa do que não é. */
    await montar(PLANO);
    expect(screen.getByAltText(/Ficha de EPI gerada pelo sistema/)).toBeTruthy();
    expect(textoDaPagina()).toContain("Dados fictícios");
  });
});
