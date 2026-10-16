import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentoEvidencia from "./DocumentoEvidencia";

/**
 * O anexo precisa ser do REGISTRO, não só do colaborador.
 *
 * O documento do Arquivo Digital é um só por colaborador e tipo. No módulo
 * de ASO, o admissional, o periódico e o demissional do mesmo colaborador
 * caem todos nesse documento — e as três linhas mostravam o mesmo "Ver
 * PDF" e a mesma contagem de versões. Não dava para saber qual arquivo era
 * qual, e "Renovar" numa linha mexia no monte inteiro.
 *
 * Cada versão guarda o id do registro que a originou. Com
 * `versaoDoRegistro`, a linha mostra só o dela; o histórico continua
 * mostrando o documento inteiro, com o rótulo de cada versão.
 */

const VERSOES = [
  { id: "v2", versao: 2, caminho_arquivo: "c2", nome_original: "demissional.pdf",
    data_emissao: "2026-03-01", data_validade: null, created_at: "2026-03-01T12:00:00Z",
    origem_id: "aso-demissional" },
  { id: "v1", versao: 1, caminho_arquivo: "c1", nome_original: "admissional.pdf",
    data_emissao: "2026-01-01", data_validade: "2027-01-01", created_at: "2026-01-01T12:00:00Z",
    origem_id: "aso-admissional" },
];

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const dados = () => tabela === "internal_documents"
      ? { id: "doc1", internal_document_versions: VERSOES } : null;
    const e: any = {
      select: () => e, eq: () => e, is: () => e, order: () => e, limit: () => e,
      maybeSingle: () => Promise.resolve({ data: dados(), error: null }),
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: tabela === "document_access_log" ? [] : [], error: null }).then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t), storage: { from: () => ({}) } } };
});

const ROTULOS: Record<string, string> = {
  "aso-admissional": "Admissional",
  "aso-demissional": "Demissional",
};

function montar(origemId: string, versaoDoRegistro = true) {
  return render(
    <DocumentoEvidencia
      empresaId="e1" colaboradorId="f1" tipoDocumentoId="t-aso"
      registroId={origemId} origemTabela="asos" origemId={origemId}
      podeEditar versaoDoRegistro={versaoDoRegistro}
      rotuloVersao={(id) => (id ? ROTULOS[id] ?? null : null)}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("anexo por registro", () => {
  it("a linha do admissional mostra o arquivo do admissional", async () => {
    montar("aso-admissional");
    expect(await screen.findByText(/Ver PDF/)).toBeTruthy();
    /* Duas versões no documento, uma só nesta linha. */
    expect((await screen.findByText(/versão|versões/)).textContent).toContain("1 versão");
  });

  it("linha sem arquivo próprio não empresta o do outro exame", async () => {
    /*
     * Era exatamente isto: o periódico sem anexo mostrava o PDF do
     * demissional e parecia resolvido.
     */
    montar("aso-periodico");
    expect(await screen.findByText(/Sem comprovante/)).toBeTruthy();
    expect(screen.queryByText(/Ver PDF/), "mostrou o arquivo de outro exame").toBeNull();
  });

  it("mesmo sem arquivo próprio, o histórico do colaborador continua à mão", async () => {
    montar("aso-periodico");
    await screen.findByText(/Sem comprovante/);
    expect(screen.getByRole("button", { name: /Histórico/ })).toBeTruthy();
  });

  it("o histórico diz de que exame é cada versão", async () => {
    montar("aso-admissional");
    fireEvent.click(await screen.findByRole("button", { name: /Histórico/ }));
    await waitFor(() => expect(screen.getByText("Admissional")).toBeTruthy());
    expect(screen.getByText("Demissional")).toBeTruthy();
  });

  it("sem versaoDoRegistro, segue mostrando a última do documento", async () => {
    /* Capacitações e Entregas continuam como antes. */
    montar("aso-admissional", false);
    expect(await screen.findByText(/Ver PDF/)).toBeTruthy();
    expect((await screen.findByText(/versão|versões/)).textContent).toContain("2 versões");
  });
});
