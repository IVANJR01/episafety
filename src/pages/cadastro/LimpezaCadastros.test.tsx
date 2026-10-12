import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import LimpezaCadastros, { SecaoLimpeza, SECOES } from "./LimpezaCadastros";

/**
 * O que esta tela não pode fazer: unir cadastro sem alguém mandar.
 *
 * Os dois riscos são opostos. Se ela vier com tudo marcado, quem clica em
 * "Unir" sem ler junta dois setores de verdade — ALMOXARIDADO e ALMOXARIFADDO
 * podem ser dois lugares. Se ela não sugerir nada, ninguém usa. Por isso:
 * nome igual vem marcado, nome só PARECIDO vem desmarcado.
 */

const SETORES = [
  {
    id: "s1", empresa_id: "e1", nome: "CORTE", descricao: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "s2", empresa_id: "e1", nome: "corte ", descricao: "Sala de corte",
    responsavel_setor: "João", created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "s3", empresa_id: "e1", nome: "ALMOXARIDADO", descricao: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "s4", empresa_id: "e1", nome: "ALMOXARIFADDO", descricao: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

vi.mock("@/hooks/useSupabaseData", () => ({
  useSupabaseQuery: (tabela: string) => ({
    data: tabela === "sst_setores" ? SETORES : [],
    loading: false,
  }),
}));

const uniões: unknown[] = [];
vi.mock("@/lib/unirCadastroEstrutura", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  unirCadastro: (_db: unknown, opcoes: unknown) => {
    uniões.push(opcoes);
    return Promise.resolve({
      tabela: "sst_setores", mantido: "s2", removidos: 1,
      vinculosMovidos: 3, vinculosDuplicadosDescartados: 0, camposPreenchidos: [],
    });
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/* O projeto não tem user-event; fireEvent basta para clique. */
const clicar = (el: HTMLElement) => fireEvent.click(el);

function envolver(conteudo: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{conteudo}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/* A seção de Setores, sem passar pelas abas — é o conteúdo que importa aqui. */
const montarSetores = () =>
  envolver(<SecaoLimpeza secao={SECOES.find((s) => s.chave === "sst_setores")!} />);

const montar = () => envolver(<LimpezaCadastros />);

describe("tela de limpeza de cadastros", () => {
  beforeEach(() => { uniões.length = 0; });

  it("mostra o grupo de nomes iguais", async () => {
    montarSetores();
    await waitFor(() => expect(screen.getByText(/2 cadastros iguais/i)).toBeTruthy());
  });

  it("sugere manter o cadastro mais completo", async () => {
    montarSetores();
    const marcados = await screen.findAllByRole("radio", { checked: true });
    const doGrupoCorte = marcados
      .map((r) => r.getAttribute("value"))
      .filter((v) => v === "s1" || v === "s2");
    /* s2 é o que tem descrição e responsável preenchidos; s1 está vazio. */
    expect(doGrupoCorte).toEqual(["s2"]);
  });

  it("nome PARECIDO não vem marcado para unir", async () => {
    montarSetores();
    await screen.findByText(/nomes parecidos/i);

    const marcar = screen.getAllByRole("checkbox", { name: /unir .* ao cadastro que fica/i });
    const marcados = marcar.filter((c) => c.getAttribute("aria-checked") === "true");
    const desmarcados = marcar.filter((c) => c.getAttribute("aria-checked") !== "true");

    /* Um grupo de iguais (marcado) e um de parecidos (desmarcado). */
    expect(marcados.length, "o grupo de nomes iguais devia vir marcado").toBe(1);
    expect(desmarcados.length, "nome só parecido veio marcado para unir").toBe(1);
  });

  it("só une depois de confirmar, e une o que foi escolhido", async () => {
    montarSetores();

    const botoes = await screen.findAllByRole("button", { name: /^Unir/i });
    clicar(botoes[0]);
    expect(uniões, "uniu antes de confirmar").toHaveLength(0);

    clicar(await screen.findByRole("button", { name: /^Unir$/ }));
    await waitFor(() => expect(uniões).toHaveLength(1));
    expect(uniões[0]).toEqual({ tabela: "sst_setores", manter: "s2", remover: ["s1"] });
  });

  it("onde não há repetição, diz isso", async () => {
    envolver(<SecaoLimpeza secao={SECOES.find((s) => s.chave === "sst_ambientes")!} />);
    expect(await screen.findByText(/Nenhuma repetição em ambientes/i)).toBeTruthy();
  });
});
