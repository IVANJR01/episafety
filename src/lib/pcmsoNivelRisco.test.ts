import { describe, expect, it } from "vitest";
import { renderPcmsoPdf } from "./pcmsoPdf";
import { fmtDate, fmtDT } from "./pdfTimbrado";
import { CLASSE_HEX } from "./pgrMatriz";

/**
 * O nível e a classificação do risco dentro do PCMSO.
 *
 * A seção 11 do documento promete, no próprio texto, "a correlação entre os
 * agentes agressivos inventariados no PGR e os exames exigidos pela NR-07".
 * Sem o nível impresso, a correlação ficava só na frase: o médico via a lista
 * de agentes sem saber quais eram moderados e quais intoleráveis.
 *
 * As cores vêm da fonte única (`pgrMatriz`), a mesma do PGR, da planilha e da
 * tela — o mesmo risco não pode sair de uma cor num documento e de outra no
 * documento irmão da mesma empresa.
 */

function desenho(pdf: { output: (t: "arraybuffer") => ArrayBuffer }) {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  const texto = [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((m) => m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"));
  /* Preenchimentos: "r g b rg" em 0..1, como o jsPDF grava. */
  const cores = [...bruto.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)].map((m) =>
    [m[1], m[2], m[3]].map((v) => Math.round(parseFloat(v) * 255)).join(","));
  return { texto, cores, bruto };
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

const MODERADO = {
  agente: "Excesso de demandas", fonte: "Ritmo de produção",
  danos: "Transtorno mental", meioPropagacao: "Não se aplica",
  formaExposicao: "Ocasional", nivel: 12, classificacao: "moderado",
};

describe("nível e classificação do risco na ficha", () => {
  it("imprime o nível e o nome da classificação", async () => {
    const { texto } = desenho(await renderPcmsoPdf(contexto([MODERADO])));
    const tudo = texto.join(" | ");
    expect(tudo, "a coluna de nível não existe").toContain("NÍVEL");
    expect(tudo).toContain("12");
    expect(tudo).toContain("MODERADO");
  }, 60_000);

  it("usa a cor oficial da faixa, a mesma do PGR", async () => {
    const { cores } = desenho(await renderPcmsoPdf(contexto([MODERADO])));
    const amarelo = CLASSE_HEX.moderado.join(",");
    expect(cores, `o MODERADO não saiu em ${amarelo}`).toContain(amarelo);
  }, 60_000);

  it("risco sem avaliação fica em branco — não inventa nível", async () => {
    const semNivel = { ...MODERADO, nivel: undefined, classificacao: undefined };
    const { texto, cores } = desenho(await renderPcmsoPdf(contexto([semNivel])));
    const tudo = texto.join(" | ");
    for (const classe of ["TRIVIAL", "TOLERÁVEL", "MODERADO", "SUBSTANCIAL", "INTOLERÁVEL"]) {
      expect(tudo, `inventou a classificação ${classe}`).not.toContain(classe);
    }
    expect(cores, "pintou a célula de um risco que ninguém avaliou")
      .not.toContain(CLASSE_HEX.moderado.join(","));
  }, 60_000);

  it("INTOLERÁVEL cabe inteiro na coluna, sem quebrar a palavra", async () => {
    /* "INTOLERÁVE / L" em duas linhas é pior do que não escrever nada. */
    const grave = { ...MODERADO, nivel: 20, classificacao: "intoleravel" };
    const { texto } = desenho(await renderPcmsoPdf(contexto([grave])));
    expect(texto, "a palavra foi quebrada no meio").toContain("INTOLERÁVEL");
  }, 60_000);
});

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
    const pdf = await renderPcmsoPdf(contexto([MODERADO], [
      { id: "a1", acao: "EXAMES PERIÓDICOS", responsavel: "Médico", data_planejada: "x", status: "Em andamento", observacoes: null },
    ]));
    const tudo = desenho(pdf).texto.join(" | ");
    expect(tudo, "o documento imprimiu Invalid Date").not.toContain("Invalid Date");
    expect(tudo).toContain("Durante a vigência");
  }, 60_000);
});

describe("a legenda dos exames não passa da margem", () => {
  it("quebra em mais de uma linha em vez de sair cortada", async () => {
    const { texto } = desenho(await renderPcmsoPdf(contexto([MODERADO])));
    /* A legenda inteira, montada de volta a partir dos pedaços desenhados. */
    const pedacos = texto.filter((t) =>
      t.includes("Legenda:") || t.includes("mudança implicar") || t.includes("(*) exigido"));
    expect(pedacos.length, "a legenda continua numa linha só").toBeGreaterThan(1);
    expect(texto.join(" "), "o fim da legenda sumiu")
      .toContain("risco diferente do atual");
  }, 60_000);
});
