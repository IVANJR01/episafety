import { describe, expect, it } from "vitest";
import { gerarFichaEPI, RODAPE_ASSINATURA } from "./gerarFichaEPI";

const CODIGO = "fa7f39bb97c459cd63e78345e116191e75f60b8a";
const MM_EM_PONTOS = 72 / 25.4;

function pdf(assinatura: string | null): Uint8Array {
  const doc = gerarFichaEPI({
    empresa: { nome: "EMPRESA", cnpj: null, endereco: null, logo_url: null },
    funcionario: { nome: "FULANO", cargo: null, setor: null, cpf: null, matricula: null, data_admissao: null },
    entregas: [{
      id: "abc", data: "2026-09-09", created_at: "2026-09-09T09:12:07.000Z",
      quantidade: 1, epi_nome: "PROTETOR", epi_ca: "18190", epi_descricao: null,
      epi_validade: null, observacao: null, tipo: "entrega", status: "ativo",
      data_devolucao: null, assinatura_colaborador: assinatura,
    }],
    fotosBase64: new Map(),
    codigosAssinatura: [CODIGO],
  });
  return new Uint8Array(doc.output("arraybuffer"));
}

/**
 * Os trechos de texto desenhados, um por chamada de `doc.text`.
 *
 * Comparar por trecho, e não por substring do arquivo inteiro, porque o
 * bloco da assinatura imprime "09/09/2026 09:12:07" — que contém o formato
 * antigo "09/09/2026 09:12" dentro dele. Um `not.toContain` no texto solto
 * acusaria erro onde não há.
 *
 * O jsPDF não comprime os fluxos por padrão, então os literais ficam
 * legíveis entre parênteses.
 */
function trechosDoPdf(bytes: Uint8Array): string[] {
  const bruto = new TextDecoder("latin1").decode(bytes);
  return (bruto.match(/\((?:\\.|[^\\()])*\)/g) ?? []).map((p) => p.slice(1, -1));
}

/**
 * Os traços desenhados com `doc.line`.
 *
 * As bordas das células saem como retângulos (`re`), então todo operador
 * `l` do arquivo veio de uma chamada de linha — hoje só o separador.
 */
function tracos(bytes: Uint8Array): string[] {
  const bruto = new TextDecoder("latin1").decode(bytes);
  return bruto.match(/[\d.]+ [\d.]+ l/g) ?? [];
}

describe("ficha de EPI — coluna Entrega", () => {
  it("imprime a data da entrega", () => {
    expect(trechosDoPdf(pdf("BIOMETRIA_DIGITAL"))).toContain("09/09/2026");
  });

  it("não imprime a data colada na hora, como era antes", () => {
    expect(trechosDoPdf(pdf("BIOMETRIA_DIGITAL"))).not.toContain("09/09/2026 09:12");
  });

  it("mantém a hora com segundos embaixo da assinatura", () => {
    // A hora não foi banida da ficha: ela continua onde tem valor de prova,
    // ao lado do código que amarra a assinatura àquele registro.
    const t = trechosDoPdf(pdf("BIOMETRIA_DIGITAL"));
    expect(t).toContain(CODIGO);
    expect(t.some((s) => /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(s))).toBe(true);
  });
});

describe("ficha de EPI — separador da assinatura", () => {
  it("desenha um traço quando há assinatura", () => {
    expect(tracos(pdf("BIOMETRIA_DIGITAL"))).toHaveLength(1);
  });

  it("não desenha traço nenhum sem assinatura", () => {
    // Numa célula vazia, um separador sugeriria que existe registro de uma
    // assinatura que não foi colhida.
    expect(tracos(pdf(null))).toHaveLength(0);
  });

  it("atravessa a coluna Assinatura de ponta a ponta", () => {
    // A coluna vai de 222 mm a 282 mm: margem de 15 mm mais as seis colunas
    // anteriores (32+24+16+78+24+33).
    const fim = 282 * MM_EM_PONTOS;
    const [traco] = tracos(pdf("BIOMETRIA_DIGITAL"));
    expect(Number(traco.split(" ")[0])).toBeCloseTo(fim, 1);
  });
});

describe("RODAPE_ASSINATURA — geometria do rodapé da célula", () => {
  it("põe o separador entre o código e a data", () => {
    // As alturas são medidas para cima a partir do fim da linha: quanto
    // maior o número, mais alto na célula.
    expect(RODAPE_ASSINATURA.codigo).toBeGreaterThan(RODAPE_ASSINATURA.separador);
    expect(RODAPE_ASSINATURA.separador).toBeGreaterThan(RODAPE_ASSINATURA.data);
  });

  it("deixa folga para o texto dos dois lados", () => {
    // O código é 4,5 pt e desce ~0,35 mm abaixo da linha de base.
    expect(RODAPE_ASSINATURA.codigo - RODAPE_ASSINATURA.separador).toBeGreaterThanOrEqual(0.8);
    // A data é 5 pt e sobe ~1,3 mm acima da linha de base.
    expect(RODAPE_ASSINATURA.separador - RODAPE_ASSINATURA.data).toBeGreaterThanOrEqual(1.6);
  });
});
