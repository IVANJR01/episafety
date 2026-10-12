import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PgrValidar from "./PgrValidar";

/**
 * O QR Code impresso no rodapé do PGR só serve se abrir para QUALQUER UM.
 *
 * Quem lê o QR é o fiscal com o papel na mão — sem conta no sistema. A página
 * existia, mas estava dentro do bloco de rotas protegidas: o QR levava à tela
 * de senha, e um QR que pede senha não prova nada.
 *
 * O outro lado da moeda: a página não pode virar uma porta para o conteúdo do
 * PGR. Ela mostra identificação do documento; inventário e plano de ação, não.
 */

const PUBLICO = {
  encontrado: true,
  empresa_nome: "LEONARDO A. DE ARAUJO LTDA",
  unidade_nome: null,
  versao: 3,
  status: "vigente",
  data_emissao: "2026-07-01",
  data_vigencia_inicio: "2026-07-01",
  data_vigencia_fim: "2028-06-30",
  resp_tec_nome: "JOSÉ IVAN HOLANDA DE MELO JUNIOR",
  resp_tec_registro: "CREA 12345/CE",
  pdf: {
    pdf_versao: 2, pdf_hash: "abc123def456", gerado_em: "2026-07-01T10:00:00Z",
    com_marca_dagua: false, status_no_momento: "vigente",
  },
  versao_pedida: 2, ultima_pdf_versao: 2, eh_ultima_pdf: true,
};

let respostaPublica: unknown = PUBLICO;
let temSessao = false;
const chamadas: { fn: string; args: unknown }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      chamadas.push({ fn, args });
      if (fn === "pgr_validar_publico") {
        return Promise.resolve({ data: respostaPublica, error: null });
      }
      /* O interno responde só para quem está logado e enxerga a empresa. */
      if (!temSessao) return Promise.resolve({ data: null, error: { message: "Não autenticado" } });
      return Promise.resolve({
        data: { pdf: { drive_view_link: "https://drive/x" }, pdf_desatualizado: false },
        error: null,
      });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: temSessao ? { user: {} } : null } }),
    },
  },
}));

function montar(url = "/pgr/validar/abc?v=2") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/pgr/validar/:id" element={<PgrValidar />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("conferência do PGR pelo QR", () => {
  beforeEach(() => { respostaPublica = PUBLICO; temSessao = false; chamadas.length = 0; });

  it("sem login, mostra empresa, revisão, data e responsável", async () => {
    montar();
    expect(await screen.findByText(/LEONARDO A\. DE ARAUJO LTDA/)).toBeTruthy();
    expect(screen.getByText(/JOSÉ IVAN HOLANDA DE MELO JUNIOR/)).toBeTruthy();
    expect(screen.getByText("v3")).toBeTruthy();
    /* A data aparece na emissão e no começo da vigência. */
    expect(screen.getAllByText(/01\/07\/2026/).length).toBeGreaterThan(0);
  });

  it("sem login, usa a consulta pública — nunca só a interna", async () => {
    montar();
    await screen.findByText(/LEONARDO A\. DE ARAUJO LTDA/);
    expect(chamadas.some((c) => c.fn === "pgr_validar_publico")).toBe(true);
  });

  it("mostra o hash para conferir com o rodapé do papel", async () => {
    montar();
    expect(await screen.findByText("abc123def456")).toBeTruthy();
  });

  it("não mostra o conteúdo do PGR a quem não está logado", async () => {
    montar();
    await screen.findByText(/LEONARDO A\. DE ARAUJO LTDA/);
    expect(screen.queryByText(/Ir para o PGR completo/i)).toBeNull();
    expect(screen.queryByText(/Abrir arquivo/i)).toBeNull();
  });

  it("logado, ganha o link do arquivo e o caminho para o PGR", async () => {
    temSessao = true;
    montar();
    expect(await screen.findByText(/Ir para o PGR completo/i)).toBeTruthy();
    expect(screen.getByText(/Abrir arquivo/i)).toBeTruthy();
  });

  it("documento que não existe não vira erro em branco", async () => {
    respostaPublica = { encontrado: false };
    montar();
    expect(await screen.findByText(/Documento não encontrado/i)).toBeTruthy();
  });

  it("rascunho é avisado em letra grande, não escondido", async () => {
    respostaPublica = {
      ...PUBLICO, status: "rascunho",
      pdf: { ...PUBLICO.pdf, com_marca_dagua: true },
    };
    montar();
    expect(await screen.findByText(/Este documento é um RASCUNHO/i)).toBeTruthy();
    expect(screen.getByText(/não substitui a versão final/i)).toBeTruthy();
  });

  it("papel velho avisa que existe versão mais nova", async () => {
    /*
     * O QR pede a v2, a v2 está registrada e bate — mas já existe a v5. Quem
     * confere precisa saber que o documento na mão foi substituído.
     */
    respostaPublica = { ...PUBLICO, ultima_pdf_versao: 5, eh_ultima_pdf: false };
    montar("/pgr/validar/abc?v=2");
    expect(await screen.findByText(/versão mais recente deste/i)).toBeTruthy();
  });

  it("não avisa nada quando o papel é a última versão", async () => {
    montar("/pgr/validar/abc?v=2");
    await screen.findByText(/LEONARDO A\. DE ARAUJO LTDA/);
    expect(screen.queryByText(/versão mais recente deste/i)).toBeNull();
    expect(screen.queryByText(/não está registrada/i)).toBeNull();
  });

  it("QR que pede uma versão não registrada diz isso", async () => {
    respostaPublica = { ...PUBLICO, pdf: null, ultima_pdf_versao: 3 };
    montar("/pgr/validar/abc?v=9");
    expect(await screen.findByText(/A versão v9 do PDF não está registrada/i)).toBeTruthy();
  });
});

describe("a rota da conferência", () => {
  it("está no bloco público do App, fora do ProtectedRoute", () => {
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf-8");
    const rota = app.indexOf('path="/pgr/validar/:id"');
    const protegidas = app.indexOf('path="/*" element={<ProtectedRoute />}');

    expect(rota, "a rota de conferência sumiu do App").toBeGreaterThan(0);
    expect(
      rota < protegidas,
      "a rota do QR voltou para dentro das rotas protegidas — o fiscal cairia no login",
    ).toBe(true);

    /* E não pode estar também dentro do AppLayout, que é o bloco logado. */
    const layoutInicio = app.indexOf("<AppLayout>");
    const layoutFim = app.indexOf("</AppLayout>");
    expect(
      rota > layoutInicio && rota < layoutFim,
      "a rota está dentro do AppLayout, que só existe depois do login",
    ).toBe(false);
  });
});
