import { describe, expect, it } from "vitest";
import { renderPcmsoPdf } from "./pcmsoPdf";
import { fmtDate, fmtDT } from "./pdfTimbrado";

/**
 * Dois defeitos que apareceram ao gerar o PCMSO para conferir.
 *
 * O arquivo nasceu maior: tinha também o nível e a classificação do risco na
 * ficha de exame. Saíram a pedido — a classificação é assunto do PGR, que
 * avalia e prioriza o risco; o PCMSO responde que exame acompanha aquela
 * exposição, e as duas colunas só poluíam o documento.
 */

function desenho(pdf: { output: (t: "arraybuffer") => ArrayBuffer }) {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  const texto = [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"));
  return { texto, bruto };
}

const SEM = [{
  agente: "Ausência de Fator de Risco", fonte: "Não se aplica", danos: "Não se aplica",
  meioPropagacao: "Não se aplica", formaExposicao: "Não se aplica",
}];

function contexto(riscos: unknown[], cronograma: unknown[] = []) {
  return {
    pcmso: {
      id: "p1", versao: 1, status: "vigente", data_emissao: "2026-06-30",
      data_vigencia_inicio: "2026-06-30", data_vigencia_fim: "2027-06-30",
    },
    empresa: { id: "e1", nome: "EMPRESA TESTE", cnpj: "1", grau_risco: 1 },
    emissor: { nome: "SAFETY" },
    medicoCoordenador: { nome: "Roger", crm: "6353", uf: "CE" },
    medicosExaminadores: [], ambientes: [], cargos: [],
    fichasExame: [{
      numero: "07", setor: "COSTURA", funcoes: ["COSTUREIRA"],
      riscosFisicos: SEM, riscosQuimicos: SEM, riscosBiologicos: SEM,
      riscosErgonomicos: riscos, riscosAcidentes: SEM,
      exames: [{
        codigo: "0295", nome: "Avaliação Clínica", adm: "Sim",
        periodico: "Anual", rt: "Sim", mdf: "*", dem: "Sim",
      }],
    }],
    quadroLaboral: [], atividadesLista: [], cronograma, relatorioAnaliticoTexto: "",
    estatisticasAsos: {
      total: 0, aptos: 0, restricoes: 0, inaptos: 0,
      admissional: 0, periodico: 0, demissional: 0, retorno: 0, mudanca: 0,
    },
  } as never;
}

const RISCO = {
  agente: "Excesso de demandas", fonte: "Ritmo de produção",
  danos: "Transtorno mental", meioPropagacao: "Não se aplica",
  formaExposicao: "Ocasional",
};

describe("data inválida nunca vira texto de programador", () => {
  it("fmtDate e fmtDT devolvem travessão", () => {
    /*
     * `toLocaleDateString` devolve a STRING "Invalid Date", que é um valor
     * verdadeiro — por isso `fmtDate(x) || "reserva"` nunca usava a reserva, e
     * o cronograma do PCMSO saiu com "Previsão / Prazo: Invalid Date".
     */
    expect(fmtDate("não é data")).toBe("—");
    expect(fmtDate("")).toBe("—");
    expect(fmtDT("abacaxi")).toBe("—");
    expect(fmtDate("2026-06-30")).toBe("30/06/2026");
  });

  it("o cronograma do PCMSO diz o prazo em palavras quando não há data", async () => {
    const pdf = await renderPcmsoPdf(contexto([RISCO], [
      { id: "a1", acao: "EXAMES PERIÓDICOS", responsavel: "Médico", data_planejada: "x", status: "Em andamento", observacoes: null },
    ]));
    const tudo = desenho(pdf).texto.join(" | ");
    expect(tudo, "o documento imprimiu Invalid Date").not.toContain("Invalid Date");
    /* O texto do cronograma mudou de "Durante a vigência" para "Durante o ano". */
    expect(tudo).toContain("Durante o ano");
  }, 60_000);
});

describe("a legenda dos exames não passa da margem", () => {
  it("quebra em mais de uma linha em vez de sair cortada", async () => {
    const { texto } = desenho(await renderPcmsoPdf(contexto([RISCO])));
    /* A legenda inteira, montada de volta a partir dos pedaços desenhados. */
    const pedacos = texto.filter((t) =>
      t.includes("Legenda:") || t.includes("mudança implicar") || t.includes("(*) exigido"));
    expect(pedacos.length, "a legenda continua numa linha só").toBeGreaterThan(1);
    expect(texto.join(" "), "o fim da legenda sumiu")
      .toContain("risco diferente do atual");
  }, 60_000);
});
