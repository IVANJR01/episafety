import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PcmsoElaboracao from "./PcmsoElaboracao";

/**
 * O botão "Concluir" da última etapa do PCMSO.
 *
 * Ele não tinha onClick nenhum: quem chegava ao fim da elaboração
 * apertava e a tela ficava parada, sem mensagem e sem ir a lugar nenhum.
 */

const PCMSO: any = { id: "p1", versao: 1, status: "vigente", empresa_id: "e1" };
const navegou: string[] = [];
const avisos: string[] = [];

vi.mock("react-router-dom", async () => {
  const real = await vi.importActual<any>("react-router-dom");
  return { ...real, useNavigate: () => (rota: string) => navegou.push(rota) };
});

vi.mock("sonner", () => ({
  toast: {
    warning: (m: string) => avisos.push(`warning:${m}`),
    success: (m: string) => avisos.push(`success:${m}`),
    info: () => {}, error: () => {},
  },
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canView: true, canEdit: true, canDelete: true }),
}));

/* As etapas têm vida própria; aqui só interessa a navegação do rodapé. */
vi.mock("@/components/pcmso/PcmsoCapaTab", () => ({ default: () => <div /> }));
vi.mock("@/components/pcmso/PcmsoCronogramaTab", () => ({ default: () => <div /> }));
vi.mock("@/components/pcmso/PcmsoMatrizTab", () => ({ default: () => <div /> }));
vi.mock("@/components/pcmso/PcmsoRelatorioTab", () => ({ default: () => <div /> }));
vi.mock("@/components/pcmso/PcmsoEmissaoTab", () => ({ default: () => <div /> }));

vi.mock("@/integrations/supabase/client", () => {
  const e: any = {
    select: () => e, eq: () => e,
    maybeSingle: () => Promise.resolve({ data: PCMSO, error: null }),
  };
  return { supabase: { from: () => e } };
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/pcmso/elaborar/p1?etapa=emissao"]}>
        <Routes><Route path="/pcmso/elaborar/:id" element={<PcmsoElaboracao />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navegou.length = 0; avisos.length = 0; PCMSO.status = "vigente";
});

describe("Concluir, na última etapa", () => {
  it("documento vigente: sai da elaboração", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Concluir/ }));
    await waitFor(() => expect(navegou, "o botão não fez nada").toContain("/pcmso/dashboard"));
    expect(avisos.join(" ")).toContain("success");
  });

  it("rascunho: avisa que falta ativar, e não sai", async () => {
    /*
     * Sair calado deixaria o usuário convencido de que concluiu — e o
     * PCMSO não valeria como documento emitido.
     */
    PCMSO.status = "rascunho";
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Concluir/ }));
    await waitFor(() => expect(avisos.join(" ")).toContain("warning"));
    expect(navegou, "levou embora um PCMSO que ainda é rascunho").toEqual([]);
  });
});
