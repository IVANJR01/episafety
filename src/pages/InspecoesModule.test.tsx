import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/*
 * A aba do Radix reage a mouseDown, não a click: `fireEvent.click` passa
 * batido e o teste ficaria verde sem nunca ter trocado de aba.
 */
const clicarNaAba = (nome: RegExp) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: nome }), { button: 0 });
import { MemoryRouter, Routes, Route } from "react-router-dom";
import InspecoesModule from "./InspecoesModule";

/**
 * O cadastro de locais mora dentro de Inspeções e Apontamentos.
 *
 * "Locais e Obras" era um item solto no menu, ao lado das inspeções. Mas
 * local não é assunto próprio: existe para a inspeção acontecer em algum
 * lugar. Quem ia lançar inspeção numa obra nova tinha de sair da tela,
 * achar outro item do menu, cadastrar e voltar.
 */

/* As duas telas têm vida própria; aqui interessa o quadro que as abriga. */
vi.mock("./InspecoesSE", () => ({
  default: () => <div data-testid="tela-inspecoes" />,
}));
vi.mock("./Obras", () => ({
  default: ({ embutido }: { embutido?: boolean }) => (
    <div data-testid="tela-locais" data-embutido={embutido ? "sim" : "nao"} />
  ),
}));

function montar(rota = "/inspecoes-se", abaInicial?: "locais") {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/inspecoes-se" element={<InspecoesModule abaInicial={abaInicial} />} />
        <Route path="/inspecoes-se/obras" element={<InspecoesModule abaInicial="locais" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("abas de Inspeções", () => {
  it("abre nas inspeções", () => {
    montar();
    expect(screen.getByTestId("tela-inspecoes")).toBeTruthy();
  });

  it("tem a aba de locais ao lado", () => {
    montar();
    expect(screen.getByRole("tab", { name: /Locais e Obras/ })).toBeTruthy();
  });

  it("a aba de locais abre o cadastro, sem sair da tela", async () => {
    montar();
    clicarNaAba(/Locais e Obras/);
    await waitFor(() => expect(screen.getByTestId("tela-locais")).toBeTruthy());
  });

  it("o cadastro entra embutido, sem repetir o título da página", async () => {
    montar();
    clicarNaAba(/Locais e Obras/);
    await waitFor(() =>
      expect(screen.getByTestId("tela-locais").getAttribute("data-embutido")).toBe("sim"));
  });

  it("a rota antiga /inspecoes-se/obras abre direto na aba de locais", async () => {
    /* Há link e favorito apontando para ela; não pode cair na aba errada. */
    montar("/inspecoes-se/obras");
    await waitFor(() => expect(screen.getByTestId("tela-locais")).toBeTruthy());
  });

  it("?aba=locais também abre na aba de locais", async () => {
    montar("/inspecoes-se?aba=locais");
    await waitFor(() => expect(screen.getByTestId("tela-locais")).toBeTruthy());
  });
});

describe("menu de Inspeções", () => {
  it("não tem mais o item solto de Locais e Obras", async () => {
    const { inspecoesItems } = await import("@/components/AppLayout");
    expect(inspecoesItems.map((i) => i.path),
      "o cadastro de locais voltou a ser item solto do menu")
      .not.toContain("/inspecoes-se/obras");
  });

  it("as inspeções e os extintores continuam no menu", () => {
    /* Mover o cadastro não pode levar o grupo junto. */
    return import("@/components/AppLayout").then(({ inspecoesItems }) => {
      const paths = inspecoesItems.map((i) => i.path);
      expect(paths).toContain("/inspecoes-se");
      expect(paths).toContain("/extintores");
    });
  });
});
