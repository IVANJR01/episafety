import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AsoImportarAnexados from "./AsoImportarAnexados";

/**
 * A tela que traz para o módulo os ASOs anexados no dossiê.
 *
 * O que ela NÃO pode fazer é preencher o tipo de exame por palpite: os
 * arquivos desta empresa têm todos o mesmo nome, e um admissional gravado
 * errado em documento legal não seria conferido justamente por já vir
 * preenchido.
 */

const GRAVADOS: any[] = [];
const VERSOES_ATUALIZADAS: any[] = [];

const DOCS = [{
  id: "d1", colaborador_id: "f1",
  internal_document_versions: [
    { id: "v1", versao: 1, nome_original: "aso.pdf", data_emissao: "2026-03-10",
      data_validade: "2027-03-10", origem_tabela: "dossie" },
  ],
}, {
  id: "d2", colaborador_id: "f2",
  internal_document_versions: [
    { id: "v2", versao: 1, nome_original: "aso.pdf", data_emissao: null,
      data_validade: null, origem_tabela: "dossie" },
  ],
}];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ empresaId: "e1", user: { id: "u1" } }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const dados = () =>
      tabela === "internal_documents" ? DOCS
      : tabela === "funcionarios" ? [{ id: "f1", nome: "ANA COSTUREIRA" }, { id: "f2", nome: "BRUNO CORTADOR" }]
      : [];
    const e: any = {
      select: () => e, eq: (c: string, v: any) => { e._eq = [c, v]; return e; },
      is: () => e, in: () => e, order: () => e,
      insert: (reg: any) => { GRAVADOS.push(reg); return e; },
      update: (patch: any) => { VERSOES_ATUALIZADAS.push(patch); return e; },
      single: () => Promise.resolve({ data: { id: "novo-aso" }, error: null }),
      maybeSingle: () => Promise.resolve({
        data: tabela === "internal_document_types" ? { id: "t-aso" } : (dados()[0] ?? null),
        error: null,
      }),
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: dados(), error: null }).then(ok),
    };
    return e;
  };
  return {
    supabase: {
      from: (t: string) => consulta(t),
      rpc: () => Promise.resolve({ data: "0001", error: null }),
    },
  };
});

beforeEach(() => { GRAVADOS.length = 0; VERSOES_ATUALIZADAS.length = 0; });

describe("conferência antes de importar", () => {
  it("lista os anexos com colaborador e datas já preenchidos", async () => {
    render(<AsoImportarAnexados />);
    expect(await screen.findByText(/ANA COSTUREIRA/)).toBeTruthy();
    expect(screen.getByText("10/03/2026")).toBeTruthy();
    expect(screen.getByText("10/03/2027")).toBeTruthy();
  });

  it("não escolhe o tipo de exame por conta própria", async () => {
    render(<AsoImportarAnexados />);
    await screen.findByText(/ANA COSTUREIRA/);
    /* Nenhum tipo marcado: os seletores ficam no "Escolha…". */
    expect(screen.queryAllByText("Periódico").length,
      "a tela chutou o tipo de exame").toBe(0);
    expect(screen.getAllByText("Escolha…").length).toBeGreaterThan(0);
  });

  it("o botão de importar começa desligado", async () => {
    render(<AsoImportarAnexados />);
    await screen.findByText(/ANA COSTUREIRA/);
    expect(screen.getByRole("button", { name: /Importar/ }).hasAttribute("disabled")).toBe(true);
  });

  it("anexo sem data de emissão não pode ser marcado", async () => {
    /* Usar a data de hoje marcaria como atual um exame antigo. */
    render(<AsoImportarAnexados />);
    await screen.findByText(/BRUNO CORTADOR/);
    expect(screen.getByText(/sem data de emissão/)).toBeTruthy();
    const caixas = screen.getAllByRole("checkbox");
    expect(caixas.some((c) => c.hasAttribute("disabled")),
      "deixou marcar um anexo sem data de emissão").toBe(true);
  });

  it("'Marcar todos' não marca o que não tem data", async () => {
    render(<AsoImportarAnexados />);
    await screen.findByText(/ANA COSTUREIRA/);
    fireEvent.click(screen.getByRole("button", { name: /Marcar todos/ }));
    await waitFor(() => {
      const marcadas = screen.getAllByRole("checkbox")
        .filter((c) => c.getAttribute("data-state") === "checked");
      expect(marcadas.length).toBe(1);
    });
  });

  it("conta quantos estão prontos", async () => {
    render(<AsoImportarAnexados />);
    await screen.findByText(/ANA COSTUREIRA/);
    expect(screen.getByText(/0 de 2 prontos/)).toBeTruthy();
  });
});
