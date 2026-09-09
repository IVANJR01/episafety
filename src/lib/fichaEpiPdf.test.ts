import { describe, expect, it } from "vitest";
import { gerarFichaEPI } from "./gerarFichaEPI";

const CODIGO = "bba2c2f4bf75f88f5fa4bf496742ec849f0da56a";

/**
 * Os trechos de texto desenhados no PDF, um por chamada de `doc.text`.
 *
 * Comparar por trecho, e não por substring do arquivo inteiro, porque o
 * bloco da assinatura imprime "08/09/2026 14:07:27" — que contém o formato
 * antigo "08/09/2026 14:07" dentro dele. Um `not.toContain` no texto solto
 * acusaria erro onde não há.
 *
 * O jsPDF não comprime os fluxos por padrão, então os literais ficam
 * legíveis entre parênteses.
 */
function trechosDoPdf(bytes: Uint8Array): string[] {
  const bruto = new TextDecoder("latin1").decode(bytes);
  return (bruto.match(/\((?:\\.|[^\\()])*\)/g) ?? []).map((p) => p.slice(1, -1));
}

function ficha(): string[] {
  const doc = gerarFichaEPI({
    empresa: { nome: "EMPRESA", cnpj: null, endereco: null, logo_url: null },
    funcionario: { nome: "FULANO", cargo: null, setor: null, cpf: null, matricula: null, data_admissao: null },
    entregas: [{
      id: "abc", data: "2026-09-08", created_at: "2026-09-08T14:07:27.000Z",
      quantidade: 1, epi_nome: "PROTETOR", epi_ca: "18190", epi_descricao: null,
      epi_validade: null, observacao: null, tipo: "entrega", status: "ativo",
      data_devolucao: null, assinatura_colaborador: "BIOMETRIA_DIGITAL",
    }],
    fotosBase64: new Map(),
    codigosAssinatura: [CODIGO],
  });
  return trechosDoPdf(new Uint8Array(doc.output("arraybuffer")));
}

describe("ficha de EPI — coluna Entrega", () => {
  it("imprime a data da entrega", () => {
    expect(ficha()).toContain("08/09/2026");
  });

  it("não imprime a data colada na hora, como era antes", () => {
    // O formato antigo saía como "08/09/2026 14:07" num trecho só.
    expect(ficha()).not.toContain("08/09/2026 14:07");
  });

  it("mantém a hora com segundos embaixo da assinatura", () => {
    // A hora não foi banida da ficha: ela continua onde tem valor de prova,
    // ao lado do código que amarra a assinatura àquele registro.
    const trechos = ficha();
    expect(trechos).toContain(CODIGO);
    expect(trechos.some((t) => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(t))).toBe(true);
  });
});
