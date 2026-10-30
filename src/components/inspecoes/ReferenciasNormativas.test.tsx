import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReferenciasNormativas from "./ReferenciasNormativas";

/**
 * As normas no cartão do apontamento.
 *
 * O bloco mostrava as linhas inteiras que a IA escreve, e três delas
 * ocupavam mais espaço do que a situação detectada e a ação corretiva —
 * que é o que a pessoa precisa ler.
 */

const TEXTO = [
  "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas.",
  "IT-16/CE — Item 5.1.1 — Plano de emergência contra incêndio e pânico.",
].join("\n");

describe("etiquetas de norma", () => {
  it("mostra o código e o item, não a frase inteira", () => {
    render(<ReferenciasNormativas texto={TEXTO} />);
    expect(screen.getByText("NR-18 18.6.10")).toBeTruthy();
    expect(screen.getByText("IT-16/CE 5.1.1")).toBeTruthy();
    expect(
      screen.queryByText(/partes vivas inacessíveis/),
      "a frase inteira continuou ocupando o cartão",
    ).toBeNull();
  });

  it("a frase está a um toque de distância", () => {
    render(<ReferenciasNormativas texto={TEXTO} />);
    fireEvent.click(screen.getByRole("button", { name: /ver norma/ }));
    expect(screen.getByText(/partes vivas inacessíveis/)).toBeTruthy();
    expect(screen.getByText(/Plano de emergência/)).toBeTruthy();
  });

  it("a linha inteira fica no title, para quem passa o mouse", () => {
    /* Sem isso, ler a norma exigiria abrir — no PDF ela continua inteira. */
    render(<ReferenciasNormativas texto={TEXTO} />);
    expect(screen.getByText("NR-18 18.6.10").getAttribute("title"))
      .toContain("partes vivas inacessíveis");
  });

  it("sem frase nenhuma, não oferece o que abrir", () => {
    render(<ReferenciasNormativas texto={"NR-18 — Item 18.6.10"} />);
    expect(screen.queryByRole("button", { name: /ver norma/ })).toBeNull();
  });

  it("campo vazio não desenha nada", () => {
    const { container } = render(<ReferenciasNormativas texto="" />);
    expect(container.textContent).toBe("");
  });

  it("texto fora do formato aparece como está, em vez de sumir", () => {
    render(<ReferenciasNormativas texto="Verificar com o engenheiro" />);
    expect(screen.getByText("Verificar com o engenheiro")).toBeTruthy();
  });
});
