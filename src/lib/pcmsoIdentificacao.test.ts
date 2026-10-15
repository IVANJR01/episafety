import { describe, expect, it } from "vitest";
import { renderPcmsoPdf, grauDeRiscoExtenso } from "./pcmsoPdf";

/**
 * Identificação da empresa no PCMSO, e a capa.
 *
 * O documento emitido em 10/2026 preenchia lacuna com chute. Três campos
 * tinham valor inventado quando o cadastro estava vazio, e um deles muda o
 * enquadramento legal da empresa:
 *
 *   - grau de risco caía em "02";
 *   - cidade / UF caíam em "Alto Santo / CE";
 *   - o telefone caía no telefone da CONSULTORIA, e o documento afirmava que
 *     aquele era o contato do cliente.
 *
 * Documento que vai à fiscalização não inventa dado: sem a informação, sai
 * travessão.
 */

function textoDo(pdf: { output: (t: "arraybuffer") => ArrayBuffer }): string[] {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  return [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"));
}

/** Texto de uma página só — o índice 0 do jsPDF é vazio. */
function porPagina(pdf: { internal: { pages: string[][] } }): string[] {
  return pdf.internal.pages.map((pag) =>
    (pag || []).join("\n").split("\n")
      .flatMap((l) => [...l.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
        .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1")))
      .join(" | "),
  ).slice(1);
}

const SEM_RISCO = [{
  agente: "Ausência de Fator de Risco", fonte: "Não se aplica",
  metodologia: "Não se aplica", medidas: "Não se aplica", danos: "Não se aplica",
}];

function contexto(empresa: Record<string, unknown>) {
  return {
    pcmso: {
      id: "p1", versao: 1, status: "vigente", data_emissao: "2026-06-30",
      data_vigencia_inicio: "2026-06-30", data_vigencia_fim: "2027-06-30",
    },
    empresa: { id: "e1", nome: "LEONARDO A. DE ARAUJO LTDA", ...empresa },
    emissor: { nome: "SAFETY SOLUÇÕES" },
    medicoCoordenador: { nome: "Roger Catunda Rocha", crm: "6353", uf: "CE" },
    medicosExaminadores: [], ambientes: [], cargos: [],
    fichasExame: [{
      numero: "01", setor: "COSTURA", funcoes: ["COSTUREIRA"],
      riscosFisicos: SEM_RISCO, riscosQuimicos: SEM_RISCO, riscosBiologicos: SEM_RISCO,
      riscosErgonomicos: SEM_RISCO, riscosAcidentes: SEM_RISCO,
      exames: [{
        codigo: "0295", nome: "Avaliação Clínica Ocupacional",
        adm: "Sim", periodico: "Anual", rt: "Sim", mdf: "*", dem: "Sim",
      }],
    }],
    quadroLaboral: [], atividadesLista: [], cronograma: [], relatorioAnaliticoTexto: "",
    estatisticasAsos: {
      total: 0, aptos: 0, restricoes: 0, inaptos: 0,
      admissional: 0, periodico: 0, demissional: 0, retorno: 0, mudanca: 0,
    },
  } as never;
}

const COMPLETA = {
  cnpj: "51.213.683/0001-04", cnae_principal: "14.12-6-01",
  cnae_secundario: "14.12-6-03; 47.55-5-01", grau_risco: 1,
  cidade: "ALTO SANTO", uf: "CE", cep: "62970-000", telefone: "(88) 3429-1457",
};

describe("grau de risco no formato da NR-04", () => {
  it("escreve o número e o extenso", () => {
    expect(grauDeRiscoExtenso(1)).toBe("01 (Um)");
    expect(grauDeRiscoExtenso(4)).toBe("04 (Quatro)");
  });

  it("sem o dado, não inventa um grau", () => {
    /* Afirmar grau 2 muda o enquadramento e o prazo do exame demissional. */
    expect(grauDeRiscoExtenso(null)).toBe("—");
    expect(grauDeRiscoExtenso(undefined)).toBe("—");
    expect(grauDeRiscoExtenso("")).toBe("—");
    expect(grauDeRiscoExtenso(9)).toBe("—");
  });
});

describe("a identificação não inventa dado da empresa", () => {
  it("imprime o que está cadastrado", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto(COMPLETA))).join(" | ");
    expect(texto).toContain("01 (Um)");
    expect(texto).toContain("14.12-6-01");
    expect(texto, "o CNAE secundário não saiu em linha própria")
      .toContain("CNAE Secundário:");
    expect(texto).toContain("(88) 3429-1457");
  }, 60_000);

  it("cadastro vazio não vira telefone da consultoria nem cidade chutada", async () => {
    const pedacos = textoDo(await renderPcmsoPdf(contexto({})));
    const texto = pedacos.join(" | ");
    /*
     * O telefone da consultoria aparece legitimamente no bloco da empresa
     * assessora. O que não pode é aparecer como contato do CLIENTE — e era
     * exatamente isso que o `|| "(88) 99653-6252"` fazia na linha dele.
     */
    const linhaContato = pedacos.find((t) => t.includes("E-mail:")) || "";
    expect(linhaContato, "inventou o telefone da consultoria como contato do cliente")
      .not.toContain("99653-6252");
    /*
     * O endereço da consultoria cita Alto Santo legitimamente. O que não pode
     * é a linha de cidade do CLIENTE nascer preenchida com ela.
     */
    const linhaCidade = pedacos.find((t) => t.startsWith("ALTO SANTO") || t.includes("CEP:")) || "";
    expect(linhaCidade, "inventou a cidade do cliente").not.toContain("Alto Santo");
    expect(texto, "inventou o grau de risco 2").not.toContain("Grau de Risco: 02");
  }, 60_000);

  it("o CNAE principal não sai grudado nos secundários", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto(COMPLETA))).join(" | ");
    expect(texto, "principal e secundários no mesmo campo")
      .not.toMatch(/14\.12-6-01 - 14\.12-6-03/);
  }, 60_000);
});

describe("a capa do PCMSO", () => {
  it("não repete a identificação nem o bloco de versões", async () => {
    const capa = porPagina(await renderPcmsoPdf(contexto(COMPLETA)) as never)[0];
    for (const fora of ["CNPJ", "Médico Coord", "REV.", "PCMSO v"]) {
      expect(capa, `"${fora}" voltou para a capa`).not.toContain(fora);
    }
  }, 60_000);

  it("a capa continua dizendo que documento é", async () => {
    const capa = porPagina(await renderPcmsoPdf(contexto(COMPLETA)) as never)[0];
    expect(capa).toContain("PCMSO");
    expect(capa).toContain("Programa de Controle Médico de Saúde Ocupacional");
    expect(capa).toContain("NR-07");
  }, 60_000);

  it("a identificação continua dentro do documento", async () => {
    const miolo = porPagina(await renderPcmsoPdf(contexto(COMPLETA)) as never)
      .slice(1).join(" | ");
    expect(miolo).toContain("51.213.683/0001-04");
    expect(miolo).toContain("Roger Catunda Rocha");
  }, 60_000);
});

describe("o asterisco da coluna MDF", () => {
  it("é explicado na legenda", async () => {
    const texto = textoDo(await renderPcmsoPdf(contexto(COMPLETA))).join(" | ");
    expect(texto, "o (*) aparece na tabela sem nada dizendo o que é")
      .toContain("(*) exigido quando a mudança");
  }, 60_000);
});
