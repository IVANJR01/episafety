import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MatrizPermissoes from "./MatrizPermissoes";

const caixa = (nome: string) => screen.getByRole("checkbox", { name: `${nome} em Entregas` });

describe("ações finas na matriz de permissões", () => {
  it("vêm marcadas para quem já tem o módulo, e desmarcar grava o bloqueio", () => {
    const onAlternar = vi.fn();
    render(<MatrizPermissoes perms={["entregas:view", "entregas:create", "entregas:edit"]} onAlternar={onAlternar} onAlternarModulo={() => {}} />);
    const desfazer = caixa("Desfazer devolução");
    expect(desfazer).toHaveAttribute("data-state", "checked");
    fireEvent.click(desfazer);
    expect(onAlternar).toHaveBeenCalledWith("entregas:sem:desfazer_devolucao");
    cleanup();
  });

  it("bloqueada aparece desmarcada; sem a ação base, aparece apagada", () => {
    render(<MatrizPermissoes perms={["entregas:view", "entregas:edit", "entregas:sem:gerar_ficha"]} onAlternar={() => {}} onAlternarModulo={() => {}} />);
    expect(caixa("Gerar a Ficha de EPI")).toHaveAttribute("data-state", "unchecked");
    expect(caixa("Registrar devolução")).toBeDisabled(); // precisa de "Criar"
    cleanup();
  });

  it("módulo sem nenhuma permissão não mostra as ações finas", () => {
    render(<MatrizPermissoes perms={[]} onAlternar={() => {}} onAlternarModulo={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: "Gerar a Ficha de EPI em Entregas" })).toBeNull();
    cleanup();
  });
});
