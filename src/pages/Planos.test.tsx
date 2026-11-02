import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A página de planos é pública e é oferta: o que estiver escrito ali,
 * alguém vai cobrar. Preço que ninguém combinou não pode aparecer.
 */

vi.mock("@/assets/logo-episafety.png", () => ({ default: "logo.png" }));

async function montarCom(planos: unknown[], contato: Record<string, string>) {
  vi.resetModules();
  vi.doMock("@/lib/planosDeVenda", async () => {
    const real = await vi.importActual<any>("@/lib/planosDeVenda");
    return {
      ...real,
      PLANOS: planos,
      CONTATO: { ...real.CONTATO, ...contato },
      algumPrecoDefinido: () => (planos as any[]).some((p) => p.precoMensal != null),
      linkDoWhatsapp: (p?: any) => {
        const n = (contato.whatsapp || "").replace(/\D/g, "");
        return n ? `https://wa.me/${n}?text=${encodeURIComponent(p?.nome || "oi")}` : null;
      },
    };
  });
  const Planos = (await import("./Planos")).default;
  return render(<MemoryRouter><Planos /></MemoryRouter>);
}

const PLANO = {
  id: "p1", nome: "Essencial", publico: "Para quem precisa do básico.",
  precoMensal: null as number | null, unidade: "por empresa / mês",
  inclui: ["PGR", "PCMSO"],
};

describe("preço na página", () => {
  it("sem valor definido, diz 'Sob consulta' e não mostra número", async () => {
    await montarCom([PLANO], { whatsapp: "" });
    expect(screen.getByText("Sob consulta")).toBeTruthy();
    expect(document.body.textContent, "apareceu um valor em reais que ninguém definiu")
      .not.toMatch(/R\$\s?\d/);
  });

  it("com valor definido, mostra o valor", async () => {
    await montarCom([{ ...PLANO, precoMensal: 199.9 }], { whatsapp: "" });
    expect(screen.getByText(/199,90/)).toBeTruthy();
    expect(screen.queryByText("Sob consulta")).toBeNull();
  });

  it("sem nenhum preço, a página explica por que não há valores", async () => {
    await montarCom([PLANO], { whatsapp: "" });
    expect(screen.getByText(/valores destes planos são passados no contato/)).toBeTruthy();
  });
});

describe("botão de contato", () => {
  it("sem WhatsApp cadastrado, nenhum botão leva a lugar nenhum", async () => {
    /* Botão morto numa página de venda é pior que botão nenhum. */
    await montarCom([PLANO], { whatsapp: "" });
    const links = Array.from(document.querySelectorAll("a[href]"));
    expect(links.some((a) => (a.getAttribute("href") || "").includes("wa.me")),
      "link de WhatsApp sem número cadastrado").toBe(false);
    /* O botão do plano vira texto, e nenhum botão de WhatsApp é oferecido. */
    expect(screen.getByText("Fale com a gente")).toBeTruthy();
    expect(screen.queryByText("Chamar no WhatsApp")).toBeNull();
  });

  it("com WhatsApp, o link leva o nome do plano na mensagem", async () => {
    await montarCom([PLANO], { whatsapp: "55 88 99999-9999" });
    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") || "")
      .filter((h) => h.includes("wa.me"));
    expect(links.length, "nenhum botão de WhatsApp apareceu").toBeGreaterThan(0);
    expect(links.every((h) => h.includes("5588999999999"))).toBe(true);
    /* O botão DO PLANO leva o nome dele, para a conversa já começar sabida. */
    expect(links.some((h) => decodeURIComponent(h).includes("Essencial")),
      "o botão do plano não identifica qual plano").toBe(true);
  });
});

describe("a página é pública", () => {
  it("mostra os módulos e o caminho para entrar no sistema", async () => {
    await montarCom([PLANO], { whatsapp: "" });
    expect(screen.getByText(/Documentos de SST/)).toBeTruthy();
    expect(screen.getAllByText(/Entrar/).length).toBeGreaterThan(0);
  });
});
