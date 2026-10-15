import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderPcmsoPdf } from "./pcmsoPdf";

/**
 * Os três defeitos graves do PCMSO emitido em 10/2026.
 *
 * 1. A faixa "Funções abrangidas" tinha altura fixa de 7 mm e avançava 9 mm,
 *    com uma linha de funções ou com três. O setor ADMINISTRAÇÃO E GESTÃO tem
 *    mais de vinte funções: as linhas de baixo saíam POR CIMA do título
 *    "1. DESCRIÇÃO DOS RISCOS OCUPACIONAIS" (páginas 9, 12 e 13 do documento).
 * 2. O QR Code do rodapé apontava para uma rota que não existia no sistema.
 * 3. A coluna "Fonte geradora" recebia o parágrafo inteiro do processo quando
 *    o item do inventário não tinha a fonte cadastrada.
 */

const raiz = (...p: string[]) => join(process.cwd(), ...p);

/* As funções reais do setor que estourava a faixa. */
const FUNCOES_LONGAS = [
  "AJUDANTE", "AJUDANTE DE CONFECÇÃO", "AJUDANTES DE CONFECÇÃO", "ANALISTA DE PCP",
  "ASSISTENTE ADMINISTRATIVO", "ASSISTENTE FINANCEIRO", "ASSISTENTE FISCAL",
  "AUXILIAR ADMINISTRATIVO", "AUXILIAR DE ESCRITÓRIO", "AUXILIAR FINANCEIRO",
  "CORTADOR", "CRONOMETRISTA", "ENCARREGADO(A)", "FOTÓGRAFO", "GERENTE",
  "GERENTE DE PRODUÇÃO", "MODELISTA/ESTILISTA", "MODELO", "SOCIAL MÍDIA",
  "SUPERVISOR DE PRODUÇÃO", "TESOUREIRA", "VENDEDOR(A)",
];

const SEM_RISCO = [{
  agente: "Ausência de Fator de Risco", fonte: "Não se aplica",
  metodologia: "Não se aplica", medidas: "Não se aplica", danos: "Não se aplica",
}];

function contexto(funcoes: string[]) {
  return {
    pcmso: {
      id: "p1", versao: 1, status: "vigente", data_emissao: "2026-06-30",
      data_vigencia_inicio: "2026-06-30", data_vigencia_fim: "2027-06-30",
    },
    empresa: {
      id: "e1", nome: "LEONARDO A. DE ARAUJO LTDA", cnpj: "51.213.683/0001-04",
      cnae_principal: "14.12-6-01", grau_risco: 1, cidade: "ALTO SANTO", uf: "CE",
    },
    emissor: { nome: "SAFETY SOLUÇÕES" },
    medicoCoordenador: { nome: "Roger Catunda Rocha", crm: "6353", uf: "CE" },
    medicosExaminadores: [],
    ambientes: [],
    cargos: [],
    fichasExame: [{
      numero: "01", setor: "ADMINISTRAÇÃO E GESTÃO", funcoes,
      riscosFisicos: SEM_RISCO, riscosQuimicos: SEM_RISCO, riscosBiologicos: SEM_RISCO,
      riscosErgonomicos: SEM_RISCO, riscosAcidentes: SEM_RISCO,
      exames: [{
        codigo: "0295", nome: "Avaliação Clínica Ocupacional",
        adm: "Sim", periodico: "Anual", rt: "Sim", mdf: "*", dem: "Sim",
      }],
    }],
    quadroLaboral: [],
    atividadesLista: [],
    cronograma: [],
    relatorioAnaliticoTexto: "",
    estatisticasAsos: {
      total: 0, aptos: 0, restricoes: 0, inaptos: 0,
      admissional: 0, periodico: 0, demissional: 0, retorno: 0, mudanca: 0,
    },
  } as never;
}

/**
 * Onde cada pedaço de texto foi desenhado.
 *
 * O jsPDF usa um `Td` para posicionar e `T*` para cada linha seguinte, com o
 * espaçamento do `TL`. Quem lê só o último `Td` erra o lugar das linhas de
 * continuação — que são justamente as que escapavam da faixa.
 */
function textosComPosicao(pdf: { output: (t: "arraybuffer") => ArrayBuffer }) {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  const saida: { texto: string; x: number; y: number; pagina: number }[] = [];
  let x = 0, y = 0, leading = 0, pagina = 1;
  for (const linha of bruto.split("\n")) {
    if (/\/Type\s*\/Page[^s]/.test(linha)) pagina += 1;
    const tl = linha.match(/([\d.]+) TL/);
    if (tl) leading = parseFloat(tl[1]);
    const td = linha.match(/([\d.-]+) ([\d.-]+) Td/);
    if (td) { x = parseFloat(td[1]); y = parseFloat(td[2]); }
    if (/\bT\*/.test(linha)) y -= leading;
    const tj = linha.match(/\((?:\\.|[^\\)])*\) Tj/);
    if (tj) {
      saida.push({
        texto: tj[0].slice(1, -4).replace(/\\([()\\])/g, "$1"),
        x, y, pagina,
      });
    }
  }
  return saida;
}

describe("a faixa de funções não escreve por cima do título", () => {
  it("com vinte e duas funções, nada é desenhado em cima do título seguinte", async () => {
    const pdf = await renderPcmsoPdf(contexto(FUNCOES_LONGAS));
    const textos = textosComPosicao(pdf as never);

    const titulo = textos.find((t) => t.texto.includes("DESCRIÇÃO DOS RISCOS"));
    expect(titulo, "o título do bloco de riscos sumiu do documento").toBeTruthy();

    /* Alguma função desenhada na mesma faixa de altura do título? */
    const invasoras = textos.filter((t) =>
      t.texto !== titulo!.texto
      && FUNCOES_LONGAS.some((f) => t.texto.includes(f))
      && Math.abs(t.y - titulo!.y) < 5,
    );
    expect(
      invasoras.map((t) => t.texto),
      "lista de funções desenhada em cima do título",
    ).toEqual([]);
  }, 60_000);

  it("a faixa cresce com a lista, em vez de ter altura fixa", async () => {
    /*
     * Com uma função só, o título tem de ficar MAIS ALTO na página do que com
     * vinte e duas. Em PDF, "mais alto" é y MAIOR. Se a altura voltasse a ser
     * fixa, os dois sairiam na mesma altura — e foi assim que o texto vazou.
     */
    const yTitulo = async (funcoes: string[]) => {
      const p = await renderPcmsoPdf(contexto(funcoes));
      return textosComPosicao(p as never)
        .find((t) => t.texto.includes("DESCRIÇÃO DOS RISCOS"))!.y;
    };
    const curto = await yTitulo(["COSTUREIRA"]);
    const longo = await yTitulo(FUNCOES_LONGAS);
    expect(curto, "a faixa de uma linha ficou do mesmo tamanho da de três")
      .toBeGreaterThan(longo);
  }, 60_000);
});

describe("o QR do PCMSO leva a uma página que existe", () => {
  const app = readFileSync(raiz("src", "App.tsx"), "utf-8");
  const pdf = readFileSync(raiz("src", "lib", "pcmsoPdf.ts"), "utf-8");

  it("o endereço impresso no QR tem rota no sistema", () => {
    expect(pdf, "o gerador deixou de imprimir o endereço").toContain("/pcmso/validar/");
    expect(app, "o QR aponta para uma rota inexistente — leva a 'não encontrado'")
      .toContain('path="/pcmso/validar/:id"');
  });

  it("a rota é pública, fora do ProtectedRoute", () => {
    const rota = app.indexOf('path="/pcmso/validar/:id"');
    const protegidas = app.indexOf('path="/*" element={<ProtectedRoute />}');
    const layoutInicio = app.indexOf("<AppLayout>");
    const layoutFim = app.indexOf("</AppLayout>");

    expect(rota).toBeGreaterThan(0);
    expect(
      rota < protegidas,
      "a rota do QR caiu dentro das rotas protegidas — o fiscal cairia no login",
    ).toBe(true);
    expect(
      rota > layoutInicio && rota < layoutFim,
      "a rota está dentro do AppLayout, que só existe depois do login",
    ).toBe(false);
  });
});

describe("campo faltando não vira a palavra \"undefined\"", () => {
  it("coluna sem dado sai vazia, não com termo de programador", async () => {
    /*
     * As fichas vêm de um `any`, e uma ficha sem `meioPropagacao` fazia o
     * documento estampar "undefined" em duas colunas — num papel que vai à
     * fiscalização.
     */
    const pdf = await renderPcmsoPdf(contexto(["COSTUREIRA"]));
    const texto = textosComPosicao(pdf as never).map((t) => t.texto).join(" | ");
    expect(texto, "o documento imprimiu a palavra undefined")
      .not.toMatch(/undefined/i);
  }, 60_000);
});

describe("a fonte geradora não recebe o processo inteiro", () => {
  const loader = readFileSync(raiz("src", "lib", "pcmsoPdfContextoLoader.ts"), "utf-8");

  it("sem fonte cadastrada, a coluna diz que falta", () => {
    /*
     * Era `r.fonte_geradora || r.processo || "Processo de trabalho"`. Sem o
     * campo, a célula recebia quinze linhas descrevendo a rotina do setor.
     */
    expect(loader, "voltou a cair no texto do processo")
      .not.toMatch(/fonte:\s*r\.fonte_geradora \|\| r\.processo/);
    expect(loader).toContain('fonte: textoCurto(r.fonte_geradora) || "Não informado"');
  });

  it("as medidas vêm da lista do banco, sem grudar os itens", () => {
    expect(loader).toContain("Array.isArray(r.controles_existentes)");
  });
});
