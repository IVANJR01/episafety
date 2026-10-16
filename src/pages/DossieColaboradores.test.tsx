import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import DossieColaboradores from "./DossieColaboradores";

/**
 * Duas coisas que a tela dizia errado.
 *
 * 1. O selo "Em dia" aparecia para TODO colaborador de uma empresa que não
 *    tem documento obrigatório cadastrado. Nada é cobrado, logo nada falta,
 *    logo "em dia" — e os 73 nomes apareciam verdes sem um único documento no
 *    dossiê. Conferido no banco: a empresa da tela tinha zero requisitos.
 *
 * 2. Ativos e desligados vinham na mesma lista, atrás de uma caixa "Incluir
 *    desligados". A documentação de quem saiu se trata de outro jeito, e
 *    agora tem aba própria.
 */

const TABELAS: Record<string, unknown[]> = {};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ empresaId: "e1", empresaScopeIds: ["e1"], isSuperAdmin: false }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canView: true, canEdit: true }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const resultado = () => Promise.resolve({ data: TABELAS[tabela] ?? [], error: null });
    const e: any = {
      select: () => e, eq: () => e, in: () => e, not: () => e, is: () => e,
      order: () => e, limit: () => e, neq: () => e, or: () => e,
      then: (ok: (v: unknown) => unknown) => resultado().then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

const FUNCIONARIOS = [
  { id: "f1", nome: "ANA ATIVA", cpf: "11111111111", cargo: "COSTUREIRA", setor: "COSTURA", data_demissao: null, empresa_id: "e1" },
  { id: "f2", nome: "BRUNO ATIVO", cpf: "22222222222", cargo: "CORTADOR", setor: "CORTE", data_demissao: null, empresa_id: "e1" },
  { id: "f3", nome: "CARLA DESLIGADA", cpf: "33333333333", cargo: "VENDEDORA", setor: "LOJA", data_demissao: "2026-01-10", empresa_id: "e1" },
];

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><DossieColaboradores /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const k of Object.keys(TABELAS)) delete TABELAS[k];
  TABELAS["funcionarios"] = FUNCIONARIOS;
  TABELAS["internal_documents_situacao"] = [];
  TABELAS["internal_document_requirements"] = [];
});

describe("o selo de pendências", () => {
  it("sem documento exigido, NÃO diz 'Em dia'", async () => {
    montar();
    await screen.findAllByText(/ANA ATIVA/);
    expect(
      screen.queryAllByText(/Em dia/),
      "disse 'em dia' numa empresa que não exige documento nenhum",
    ).toHaveLength(0);
    expect((await screen.findAllByText(/Sem exigência cadastrada/)).length)
      .toBeGreaterThan(0);
  });

  it("com documento exigido e tudo entregue, diz 'Em dia'", async () => {
    TABELAS["internal_document_requirements"] = [
      { tipo_documento_id: "t1", cargo: null, obrigatorio: true },
    ];
    TABELAS["internal_documents_situacao"] = FUNCIONARIOS.map((f) => ({
      colaborador_id: f.id, tipo_documento_id: "t1", situacao: "valido",
    }));
    montar();
    expect((await screen.findAllByText(/Em dia/)).length).toBeGreaterThan(0);
  });

  it("com documento exigido e nada entregue, cobra a falta", async () => {
    TABELAS["internal_document_requirements"] = [
      { tipo_documento_id: "t1", cargo: null, obrigatorio: true },
    ];
    montar();
    await screen.findAllByText(/ANA ATIVA/);
    expect(screen.queryAllByText(/Em dia/)).toHaveLength(0);
    expect(screen.queryAllByText(/Sem exigência cadastrada/)).toHaveLength(0);
  });
});

describe("abas de ativos e desligados", () => {
  it("abre nos ativos, sem os desligados", async () => {
    montar();
    await screen.findAllByText(/ANA ATIVA/);
    expect(screen.queryAllByText(/CARLA DESLIGADA/), "o desligado apareceu na aba de ativos")
      .toHaveLength(0);
  });

  it("a aba de desligados mostra só quem saiu", async () => {
    montar();
    await screen.findAllByText(/ANA ATIVA/);
    fireEvent.click(screen.getByRole("button", { name: /Desligados/ }));
    await waitFor(() => expect(screen.queryAllByText(/CARLA DESLIGADA/).length)
      .toBeGreaterThan(0));
    expect(screen.queryAllByText(/ANA ATIVA/), "o ativo apareceu na aba de desligados")
      .toHaveLength(0);
  });

  it("cada aba mostra quantos são", async () => {
    montar();
    await screen.findAllByText(/ANA ATIVA/);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ativos/ }).textContent).toContain("2");
      expect(screen.getByRole("button", { name: /Desligados/ }).textContent).toContain("1");
    });
  });
});
