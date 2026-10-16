import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsoList from "./AsoList";

/**
 * O ASO tem UM tipo de documento no dossiê.
 *
 * Esta tela procurava cinco subtipos — "ASO Admissional", "ASO Periódico"
 * e companhia — que a migração 20260809100000_remove_aso_subtipos.sql
 * apagou do catálogo a pedido do cliente. O mapa ficou procurando nome que
 * não existe e toda busca caía na cláusula de reserva.
 *
 * O teste segura o que importa: o anexo do ASO vai para o tipo genérico,
 * qualquer que seja o tipo de exame.
 */

const CONSULTAS: { tabela: string; nomeProcurado: string | null }[] = [];
const ID_GENERICO = "tipo-aso-generico";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ empresaId: "e1", user: { id: "u1" } }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canEdit: true, canDelete: true }),
}));

/* O anexo é um componente à parte; aqui só interessa o tipo que ele recebe. */
vi.mock("@/components/treinamentos/DocumentoEvidencia", () => ({
  default: ({ tipoDocumentoId }: { tipoDocumentoId?: string | null }) => (
    <span data-testid="evidencia" data-tipo={tipoDocumentoId ?? "nenhum"} />
  ),
}));

const ASOS = [
  { id: "a1", numero_aso: "0001", empresa_id: "e1", funcionario_id: "f1",
    tipo_exame: "demissional", status: "emitido", status_aptidao: "apto",
    data_emissao: "2026-02-01", data_vencimento: null,
    funcionarios: { nome: "ANA", cpf: "1", cargo: "C", setor: "S" } },
  { id: "a2", numero_aso: "0002", empresa_id: "e1", funcionario_id: "f2",
    tipo_exame: "periodico", status: "emitido", status_aptidao: "apto",
    data_emissao: "2026-02-01", data_vencimento: "2027-02-01",
    funcionarios: { nome: "BRUNO", cpf: "2", cargo: "C", setor: "S" } },
];

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const registro = { tabela, nomeProcurado: null as string | null };
    CONSULTAS.push(registro);
    const dados = () =>
      tabela === "asos" ? ASOS
      : tabela === "internal_document_types" ? [{ id: ID_GENERICO, nome: registro.nomeProcurado }]
      : [];
    const e: any = {
      select: () => e, is: () => e, order: () => e, limit: () => e,
      in: (_c: string, v: string[]) => { registro.nomeProcurado = v?.[0] ?? null; return e; },
      eq: (coluna: string, valor: string) => {
        if (tabela === "internal_document_types" && coluna === "nome") registro.nomeProcurado = valor;
        return e;
      },
      maybeSingle: () => Promise.resolve({ data: dados()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: dados(), error: null }).then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

beforeEach(() => { CONSULTAS.length = 0; });

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AsoList /></QueryClientProvider>);
}

describe("tipo de documento do ASO no dossiê", () => {
  it("procura só o tipo genérico, e nenhum subtipo apagado", async () => {
    montar();
    await screen.findAllByTestId("evidencia");
    const procurados = CONSULTAS
      .filter((c) => c.tabela === "internal_document_types")
      .map((c) => c.nomeProcurado);
    expect(procurados, "a tela não procurou tipo de documento nenhum").not.toEqual([]);
    for (const nome of procurados) {
      expect(nome, "voltou a procurar um subtipo que não existe mais no catálogo")
        .toBe("ASO - Atestado de Saúde Ocupacional");
    }
  });

  it("todo ASO anexa no mesmo tipo, qualquer que seja o exame", async () => {
    montar();
    const evidencias = await screen.findAllByTestId("evidencia");
    expect(evidencias.length).toBe(ASOS.length);
    for (const el of evidencias) {
      expect(el.getAttribute("data-tipo")).toBe(ID_GENERICO);
    }
  });
});
