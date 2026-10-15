import jsPDF from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocumentoSeguro } from "@/lib/secureStorage";
import { capaTimbrada, rodapePaginas, fmtDate } from "@/lib/pdfTimbrado";
import type {
  PcmsoPdfContext,
  PcmsoFichaExameG91,
  PcmsoRiscoTabelaG91,
  PcmsoQuadroLaboralItem,
  PcmsoAtividadeItem,
} from "./pcmsoPdfContextoLoader";

const LARGURA = 210;
const ALTURA = 297;
const MARGEM = 15;
const DIREITA = LARGURA - MARGEM;
const LARGURA_UTIL = DIREITA - MARGEM; // 180mm

const COR_PRIMARIA: [number, number, number] = [15, 42, 68]; // Azul Marinho Oficial Safety
const COR_SECUNDARIA: [number, number, number] = [242, 169, 0]; // Laranja Safety
const COR_TEXTO: [number, number, number] = [30, 41, 59];
const COR_CINZA_CLARO: [number, number, number] = [248, 250, 252];
const COR_CINZA_TABELA: [number, number, number] = [241, 245, 249];
const COR_BORDA: [number, number, number] = [203, 213, 225];
const COR_VERDE: [number, number, number] = [22, 101, 52];

interface SumarioItem {
  num: string;
  titulo: string;
  pagina: number;
}

interface BuilderState {
  doc: jsPDF;
  y: number;
  paginaAtual: number;
  sumario: SumarioItem[];
}

function ensureSpace(b: BuilderState, needed: number) {
  if (b.y + needed > ALTURA - 20) {
    b.doc.addPage();
    b.paginaAtual++;
    b.y = 22;
  }
}

function desenharTituloSecao(b: BuilderState, num: string, titulo: string) {
  ensureSpace(b, 16);
  const doc = b.doc;
  b.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(`${num} – ${titulo.toUpperCase()}`, MARGEM, b.y);

  // Registra no sumário dinâmico
  b.sumario.push({
    num,
    titulo,
    pagina: b.paginaAtual,
  });

  b.y += 3;
  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGEM, b.y, MARGEM + 45, b.y);
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGEM + 45, b.y, DIREITA, b.y);
  b.y += 6;
}

function desenharSubtitulo(b: BuilderState, texto: string) {
  ensureSpace(b, 10);
  const doc = b.doc;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(texto, MARGEM, b.y);
  b.y += 4.5;
}

function desenharParagrafo(b: BuilderState, texto: string, fontSize = 8, espacoAbaixo = 3.5) {
  const doc = b.doc;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  const linhas = doc.splitTextToSize(texto, LARGURA_UTIL);
  const altura = linhas.length * (fontSize * 0.44);
  ensureSpace(b, altura + espacoAbaixo);
  doc.text(linhas, MARGEM, b.y);
  b.y += altura + espacoAbaixo;
}

// ---------------------------------------------------------------------------
// DESENHO DAS TABELAS TÉCNICAS NO PADRÃO G91
// ---------------------------------------------------------------------------

/**
 * Desenha a Tabela de Quadro Laboral (Seção 04)
 * Colunas: FICHA DE EXAME | SETOR | FUNÇÃO / CARGO
 */
function desenharQuadroLaboral(b: BuilderState, lista: PcmsoQuadroLaboralItem[]) {
  const doc = b.doc;
  const colW = [35, 45, 100]; // Total = 180mm

  const desenharCabecalho = () => {
    ensureSpace(b, 8);
    doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("FICHA DE EXAME", MARGEM + 3, b.y + 4.8);
    doc.text("SETOR", MARGEM + colW[0] + 3, b.y + 4.8);
    doc.text("FUNÇÃO / CARGOS", MARGEM + colW[0] + colW[1] + 3, b.y + 4.8);
    b.y += 7;
  };

  desenharCabecalho();

  lista.forEach((item, idx) => {
    const funcoesStr = item.funcoes.join(", ");
    const funcoesLinhas = doc.splitTextToSize(funcoesStr, colW[2] - 6);
    const alturaLinha = Math.max(6.5, funcoesLinhas.length * 3.8 + 2.5);

    if (b.y + alturaLinha > ALTURA - 20) {
      b.doc.addPage();
      b.paginaAtual++;
      b.y = 22;
      desenharCabecalho();
    }

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_TABELA[0], idx % 2 === 0 ? 255 : COR_CINZA_TABELA[1], idx % 2 === 0 ? 255 : COR_CINZA_TABELA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaLinha, "FD");

    // Divisórias verticais
    doc.line(MARGEM + colW[0], b.y, MARGEM + colW[0], b.y + alturaLinha);
    doc.line(MARGEM + colW[0] + colW[1], b.y, MARGEM + colW[0] + colW[1], b.y + alturaLinha);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(item.fichaNumero, MARGEM + 3, b.y + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(doc.splitTextToSize(item.setor, colW[1] - 6), MARGEM + colW[0] + 3, b.y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.text(funcoesLinhas, MARGEM + colW[0] + colW[1] + 3, b.y + 4.5);

    b.y += alturaLinha;
  });

  b.y += 5;
}

/**
 * Desenha a Tabela de Descrição das Atividades (Seção 07)
 * Colunas: SETOR | FUNÇÃO | DESCRIÇÃO DAS ATIVIDADES
 */
function desenharTabelaAtividades(b: BuilderState, lista: PcmsoAtividadeItem[]) {
  const doc = b.doc;
  const colW = [35, 45, 100]; // Total = 180mm

  const desenharCabecalho = () => {
    ensureSpace(b, 8);
    doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("SETOR", MARGEM + 3, b.y + 4.8);
    doc.text("FUNÇÃO", MARGEM + colW[0] + 3, b.y + 4.8);
    doc.text("DESCRIÇÃO DAS ATIVIDADES", MARGEM + colW[0] + colW[1] + 3, b.y + 4.8);
    b.y += 7;
  };

  desenharCabecalho();

  lista.forEach((item, idx) => {
    const setorLinhas = doc.splitTextToSize(item.setor, colW[0] - 6);
    const funcaoLinhas = doc.splitTextToSize(item.funcao, colW[1] - 6);
    const descLinhas = doc.splitTextToSize(item.descricao || "Executar as tarefas inerentes à função conforme diretrizes operacionais.", colW[2] - 6);

    const maxLinhas = Math.max(setorLinhas.length, funcaoLinhas.length, descLinhas.length);
    const alturaLinha = Math.max(7, maxLinhas * 3.8 + 3);

    if (b.y + alturaLinha > ALTURA - 20) {
      b.doc.addPage();
      b.paginaAtual++;
      b.y = 22;
      desenharCabecalho();
    }

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_TABELA[0], idx % 2 === 0 ? 255 : COR_CINZA_TABELA[1], idx % 2 === 0 ? 255 : COR_CINZA_TABELA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaLinha, "FD");

    // Divisórias verticais
    doc.line(MARGEM + colW[0], b.y, MARGEM + colW[0], b.y + alturaLinha);
    doc.line(MARGEM + colW[0] + colW[1], b.y, MARGEM + colW[0] + colW[1], b.y + alturaLinha);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(setorLinhas, MARGEM + 3, b.y + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(funcaoLinhas, MARGEM + colW[0] + 3, b.y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.text(descLinhas, MARGEM + colW[0] + colW[1] + 3, b.y + 4.5);

    b.y += alturaLinha;
  });

  b.y += 5;
}

/**
 * Desenha a Tabela de Riscos em 5 Colunas Técnicas (Padrão G91)
 * Agente / Perigo | Fonte Geradora | Danos à saúde | Meios de Propagação | Formas de Exposição
 */
function desenharTabelaRiscos5Colunas(
  b: BuilderState,
  tituloGrupo: string,
  corGrupo: [number, number, number],
  riscos: PcmsoRiscoTabelaG91[]
) {
  const doc = b.doc;
  const colW = [35, 40, 40, 32, 33]; // Total = 180mm

  ensureSpace(b, 14);

  // Faixa do Grupo de Risco
  doc.setFillColor(corGrupo[0], corGrupo[1], corGrupo[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(tituloGrupo.toUpperCase(), MARGEM + 3, b.y + 4);
  b.y += 5.5;

  // Cabeçalho da Tabela
  doc.setFillColor(COR_CINZA_TABELA[0], COR_CINZA_TABELA[1], COR_CINZA_TABELA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);

  let cx = MARGEM;
  doc.text("AGENTE / PERIGO", cx + 2, b.y + 4.2);
  cx += colW[0];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("FONTE GERADORA", cx + 2, b.y + 4.2);
  cx += colW[1];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("POSSÍVEIS DANOS À SAÚDE", cx + 2, b.y + 4.2);
  cx += colW[2];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("MEIOS DE PROPAGAÇÃO", cx + 2, b.y + 4.2);
  cx += colW[3];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("FORMA DE EXPOSIÇÃO", cx + 2, b.y + 4.2);
  b.y += 6;

  // Linhas de Dados
  const listaParaRender = riscos.length > 0 ? riscos : [
    {
      agente: "Ausência de Fator de Risco",
      fonte: "Não se aplica",
      danos: "Não se aplica",
      meioPropagacao: "Não se aplica",
      formaExposicao: "Não se aplica",
    },
  ];

  /*
   * Campo ausente vira célula vazia, nunca a palavra "undefined".
   *
   * O `splitTextToSize` recebe o valor como veio: faltando a chave, ele
   * escrevia literalmente "undefined" na coluna — e um documento que vai à
   * fiscalização não pode estampar termo de programador. Conferido com uma
   * ficha sem `meioPropagacao`, que saía "undefined" em duas colunas.
   */
  const celula = (v: unknown): string =>
    v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

  listaParaRender.forEach((r, idx) => {
    const l1 = doc.splitTextToSize(celula(r.agente), colW[0] - 4);
    const l2 = doc.splitTextToSize(celula(r.fonte), colW[1] - 4);
    const l3 = doc.splitTextToSize(celula(r.danos), colW[2] - 4);
    const l4 = doc.splitTextToSize(celula((r as { meioPropagacao?: unknown }).meioPropagacao), colW[3] - 4);
    const l5 = doc.splitTextToSize(celula((r as { formaExposicao?: unknown }).formaExposicao), colW[4] - 4);

    const maxLinhas = Math.max(l1.length, l2.length, l3.length, l4.length, l5.length);
    const alturaLinha = Math.max(6, maxLinhas * 3.4 + 2.5);

    ensureSpace(b, alturaLinha);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaLinha, "FD");

    // Divisórias verticais
    let xSep = MARGEM;
    for (let c = 0; c < colW.length - 1; c++) {
      xSep += colW[c];
      doc.line(xSep, b.y, xSep, b.y + alturaLinha);
    }

    doc.setFont("helvetica", r.agente === "Ausência de Fator de Risco" ? "italic" : "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

    let xCol = MARGEM;
    doc.text(l1, xCol + 2, b.y + 3.8);
    xCol += colW[0];
    doc.setFont("helvetica", "normal");
    doc.text(l2, xCol + 2, b.y + 3.8);
    xCol += colW[1];
    doc.text(l3, xCol + 2, b.y + 3.8);
    xCol += colW[2];
    doc.text(l4, xCol + 2, b.y + 3.8);
    xCol += colW[3];
    doc.text(l5, xCol + 2, b.y + 3.8);

    b.y += alturaLinha;
  });

  b.y += 2.5;
}

/**
 * Desenha a Matriz de Exames Médicos Ocupacionais no Padrão G91
 * Código | Exame Ocupacional | ADM | Periódico | RT | MDF | DEM
 */
function desenharMatrizExames(b: BuilderState, exames: PcmsoFichaExameG91["exames"]) {
  const doc = b.doc;
  const colW = [18, 72, 18, 18, 18, 18, 18]; // Total = 180mm

  ensureSpace(b, 14);

  // Faixa Superior
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("EXAMES MÉDICOS OCUPACIONAIS E COMPLEMENTARES OBRIGATÓRIOS", MARGEM + 3, b.y + 4);
  b.y += 5.5;

  // Cabeçalho da Matriz
  doc.setFillColor(COR_CINZA_TABELA[0], COR_CINZA_TABELA[1], COR_CINZA_TABELA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);

  let cx = MARGEM;
  doc.text("CÓDIGO", cx + colW[0] / 2, b.y + 4.2, { align: "center" });
  cx += colW[0];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("EXAME OCUPACIONAL", cx + 3, b.y + 4.2);
  cx += colW[1];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("ADM", cx + colW[2] / 2, b.y + 4.2, { align: "center" });
  cx += colW[2];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("PERIÓDICO", cx + colW[3] / 2, b.y + 4.2, { align: "center" });
  cx += colW[3];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("RT", cx + colW[4] / 2, b.y + 4.2, { align: "center" });
  cx += colW[4];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("MDF", cx + colW[5] / 2, b.y + 4.2, { align: "center" });
  cx += colW[5];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("DEM", cx + colW[6] / 2, b.y + 4.2, { align: "center" });
  b.y += 6;

  // Linhas de Exames
  exames.forEach((ex, idx) => {
    const nomeLinhas = doc.splitTextToSize(ex.nome, colW[1] - 6);
    const alturaLinha = Math.max(6, nomeLinhas.length * 3.5 + 2.5);

    ensureSpace(b, alturaLinha);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaLinha, "FD");

    // Divisórias verticais
    let xSep = MARGEM;
    for (let c = 0; c < colW.length - 1; c++) {
      xSep += colW[c];
      doc.line(xSep, b.y, xSep, b.y + alturaLinha);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

    let xCol = MARGEM;
    // Código
    doc.setFont("helvetica", "bold");
    doc.text(ex.codigo || "0295", xCol + colW[0] / 2, b.y + 4, { align: "center" });
    xCol += colW[0];

    // Nome
    doc.setFont("helvetica", "bold");
    doc.text(nomeLinhas, xCol + 3, b.y + 4);
    xCol += colW[1];

    // Colunas de Periodicidade com realce
    const pintarCelula = (val: string, largura: number) => {
      if (val === "SIM" || val === "Anual" || val.includes("meses")) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(COR_VERDE[0], COR_VERDE[1], COR_VERDE[2]);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // cinza suave para traço "—"
      }
      doc.text(val, xCol + largura / 2, b.y + 4, { align: "center" });
      xCol += largura;
    };

    pintarCelula(ex.adm, colW[2]);
    pintarCelula(ex.periodico, colW[3]);
    pintarCelula(ex.rt, colW[4]);
    pintarCelula(ex.mdf, colW[5]);
    pintarCelula(ex.dem, colW[6]);

    b.y += alturaLinha;
  });

  // Legenda explicativa normativa logo abaixo da tabela
  ensureSpace(b, 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Legenda: ADM = Admissional | Periódico = Anual (conforme NR-07) | RT = Retorno ao Trabalho | MDF = Mudança de Riscos Ocupacionais | DEM = Demissional",
    MARGEM + 2,
    b.y + 4
  );
  b.y += 6;
}

// ---------------------------------------------------------------------------
// GERADOR PRINCIPAL DO PCMSO COMPLETO
// ---------------------------------------------------------------------------

export async function renderPcmsoPdf(ctx: PcmsoPdfContext, opts?: { qrUrl?: string }): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const { empresa, medicoCoordenador, pcmso } = ctx;
  const anoCapa = (pcmso.data_emissao || pcmso.data_vigencia_inicio || new Date().toISOString()).slice(0, 4);
  const vigenciaInicio = fmtDate(pcmso.data_vigencia_inicio);
  const vigenciaFim = fmtDate(pcmso.data_vigencia_fim);
  const logo = ctx.emissorLogoDataUrl || ctx.empresaLogoDataUrl;

  // =========================================================================
  // PÁGINA 1: CAPA OFICIAL (IDÊNTICA AO PGR DO SAFETY SOLUÇÕES)
  // =========================================================================
  capaTimbrada(doc, {
    logoDataUrl: logo,
    revisao: `REV. ${String(Math.max(0, (pcmso.versao || 1) - 1)).padStart(2, "0")}`,
    meta: `PCMSO v${pcmso.versao || 1}`,
    sigla: "PCMSO",
    titulo: "Programa de Controle Médico de Saúde Ocupacional",
    subtitulo: "NR-07 — Portaria SEPRT n.º 6.734/2020",
    nota: pcmso.data_vigencia_inicio && pcmso.data_vigencia_fim
      ? `Vigência: ${vigenciaInicio} a ${vigenciaFim}`
      : null,
    empresaNome: empresa.nome || "Empresa",
    identificacao: [],
    campos: [],
    linhasTabela: [
      ["Empresa", empresa.nome],
      ["CNPJ", empresa.cnpj || "—"],
      ["CNAE", `${empresa.cnae_principal || "—"}`],
      ["Grau de Risco", `0${empresa.grau_risco || 2}`],
      ["Médico Coord.", `${medicoCoordenador.nome} — CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm}`],
    ],
    rodapeLocal: [empresa.cidade || "Alto Santo", empresa.uf || "CE"].filter(Boolean).join(" / ")
      ? `${[empresa.cidade || "Alto Santo", empresa.uf || "CE"].filter(Boolean).join(" / ")} – ${anoCapa}`
      : anoCapa,
  });

  // =========================================================================
  // PÁGINA 2: CONTROLE DE REVISÕES E DADOS CADASTRAIS (PADRÃO G91)
  // =========================================================================
  doc.addPage();
  const b: BuilderState = {
    doc,
    y: 22,
    paginaAtual: 2,
    sumario: [],
  };

  // Faixa de Vigência no Topo
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 9, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(`INÍCIO DA VALIDADE: ${vigenciaInicio}`, MARGEM + 5, b.y + 6);
  doc.text(`REVISAR ATÉ: ${vigenciaFim}`, MARGEM + 105, b.y + 6);
  b.y += 12;

  // Bloco 1: Dados da Empresa Contratante
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("DADOS DA EMPRESA / UNIDADE OPERACIONAL", MARGEM + 3, b.y + 4.2);
  b.y += 6;

  const dadosEmpresaTabela: [string, string][] = [
    ["Razão Social:", empresa.nome || "—"],
    ["Nome Fantasia:", empresa.nome_fantasia || empresa.nome || "—"],
    ["CNPJ:", `${empresa.cnpj || "—"}          Grau de Risco: 0${empresa.grau_risco || 2}`],
    ["Endereço:", `${empresa.endereco_completo || [empresa.logradouro, empresa.numero, empresa.bairro].filter(Boolean).join(", ") || "—"}`],
    ["Cidade / UF / CEP:", `${empresa.cidade || "Alto Santo"} / ${empresa.uf || "CE"} — CEP: ${empresa.cep || "—"}`],
    ["CNAE Principal:", `${empresa.cnae_principal || "—"} - ${empresa.cnae_descricao || "Atividade Principal"}`],
    ["Telefone / Contato:", `${empresa.telefone || "(88) 99653-6252"}          E-mail: ${empresa.email || "—"}`],
  ];

  doc.setFillColor(255, 255, 255);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, dadosEmpresaTabela.length * 6.5, "FD");
  dadosEmpresaTabela.forEach(([rot, val]) => {
    doc.line(MARGEM, b.y + 6.5, DIREITA, b.y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(rot, MARGEM + 3, b.y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(val, MARGEM + 42, b.y + 4.5, { maxWidth: 135 });
    b.y += 6.5;
  });
  b.y += 4;

  // Bloco 2: Dados da Empresa Elaboradora
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("EMPRESA ASSESSORA / RESPONSÁVEL TÉCNICA PELA ELABORAÇÃO", MARGEM + 3, b.y + 4.2);
  b.y += 6;

  const dadosAssessoria: [string, string][] = [
    ["Razão Social:", "SAFETY SOLUÇÕES EM ENGENHARIA DE SEGURANÇA E MEDICINA DO TRABALHO LTDA"],
    ["CNPJ:", "33.725.753/0001-90          Telefone: (88) 99653-6252"],
    ["Endereço:", "Rua Cel. Vicente Saraiva, 1147 - Sala 04 - Centro - Alto Santo / CE"],
    ["Médico Coordenador:", `${medicoCoordenador.nome} — CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm}`],
  ];

  doc.setFillColor(255, 255, 255);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, dadosAssessoria.length * 6.5, "FD");
  dadosAssessoria.forEach(([rot, val]) => {
    doc.line(MARGEM, b.y + 6.5, DIREITA, b.y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(rot, MARGEM + 3, b.y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(val, MARGEM + 42, b.y + 4.5, { maxWidth: 135 });
    b.y += 6.5;
  });
  b.y += 4;

  // Bloco 3: Histórico de Revisões
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("CONTROLE DE REVISÕES DO DOCUMENTO", MARGEM + 3, b.y + 4.2);
  b.y += 6;

  doc.setFillColor(COR_CINZA_TABELA[0], COR_CINZA_TABELA[1], COR_CINZA_TABELA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text("REVISÃO", MARGEM + 3, b.y + 4.2);
  doc.text("DATA", MARGEM + 25, b.y + 4.2);
  doc.text("DESCRIÇÃO DA REVISÃO / ALTERAÇÕES", MARGEM + 55, b.y + 4.2);
  b.y += 6;

  doc.setFillColor(255, 255, 255);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 7, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(`REV. ${String(Math.max(0, (pcmso.versao || 1) - 1)).padStart(2, "0")}`, MARGEM + 3, b.y + 4.8);
  doc.text(vigenciaInicio, MARGEM + 25, b.y + 4.8);
  doc.text("Emissão do Programa de Controle Médico de Saúde Ocupacional.", MARGEM + 55, b.y + 4.8);
  b.y += 12;

  // =========================================================================
  // PÁGINA 3: SUMÁRIO OFICIAL (RESERVADA PARA DESENHO DINÂMICO NO FINAL)
  // =========================================================================
  doc.addPage();
  b.paginaAtual = 3;
  const paginaDoSumario = 3;

  // Quebra para iniciar o conteúdo na Página 4
  doc.addPage();
  b.paginaAtual = 4;
  b.y = 22;

  // =========================================================================
  // SEÇÃO 01: APRESENTAÇÃO
  // =========================================================================
  desenharTituloSecao(b, "01", "Apresentação");
  desenharParagrafo(
    b,
    "O Programa de Controle Médico de Saúde Ocupacional – PCMSO é um programa médico de atenção à saúde do trabalhador, implementado pela Organização, visando a prevenção, o rastreamento e o diagnóstico precoce dos agravos à saúde relacionados ao trabalho, inclusive de natureza subclínica, além da constatação da existência de casos de doenças profissionais ou danos irreversíveis à saúde dos empregados."
  );
  desenharParagrafo(
    b,
    "A Norma Regulamentadora 07 (NR-07) do Ministério do Trabalho e Previdência estabelece as diretrizes e requisitos para o desenvolvimento do PCMSO nas organizações, com o objetivo precípuo de proteger e preservar a saúde de seus trabalhadores em relação aos riscos ocupacionais identificados e classificados no Programa de Gerenciamento de Riscos - PGR da organização."
  );
  desenharParagrafo(
    b,
    "Esta Norma se aplica às organizações e aos órgãos públicos da administração direta e indireta, bem como aos órgãos dos poderes legislativo e judiciário e ao Ministério Público, que possuam empregados regidos pela Consolidação das Leis do Trabalho - CLT."
  );

  // =========================================================================
  // SEÇÃO 02: LEGISLAÇÕES APLICADAS
  // =========================================================================
  desenharTituloSecao(b, "02", "Legislações Aplicadas");
  desenharParagrafo(
    b,
    "O Programa de Controle Médico de Saúde Ocupacional – PCMSO tem sua origem e vigência alicerçados no ordenamento jurídico brasileiro de Segurança e Medicina do Trabalho:"
  );
  desenharParagrafo(
    b,
    "• Lei Federal N.º 6.514, de 22 de dezembro de 1977 – Altera o Capítulo V do Título II da Consolidação das Leis do Trabalho (CLT), incumbindo ao Ministério do Trabalho estabelecer preceitos e normas relativas à segurança e medicina do trabalho em todo o território nacional."
  );
  desenharParagrafo(
    b,
    "• Portaria N.º 3.214, de 08 de junho de 1978 – Aprova as Normas Regulamentadoras (NRs) de Segurança e Saúde no Trabalho."
  );
  desenharParagrafo(
    b,
    "• Portaria SEPRT N.º 6.734, de 09 de março de 2020 – Estabelece o novo texto da Norma Regulamentadora N.º 07 (PCMSO), em vigor a partir de 03 de janeiro de 2022, promovendo a integração direta ao PGR da NR-01."
  );
  desenharParagrafo(
    b,
    "• Portaria SEPRT N.º 6.730, de 09 de março de 2020 – Aprova a nova redação da Norma Regulamentadora N.º 01 (Disposições Gerais e Gerenciamento de Riscos Ocupacionais - PGR/GRO)."
  );

  // =========================================================================
  // SEÇÃO 03: MÉDICO COORDENADOR
  // =========================================================================
  desenharTituloSecao(b, "03", "Médico Coordenador do PCMSO");
  desenharParagrafo(
    b,
    "Em atendimento ao subitem 7.5.11 da NR-07, a organização designou o seguinte Médico do Trabalho para a coordenação, planejamento e execução do PCMSO:"
  );

  ensureSpace(b, 30);
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 24, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text("MÉDICO DO TRABALHO COORDENADOR:", MARGEM + 4, b.y + 6);
  doc.text("REGISTRO NO CONSELHO REGIONAL:", MARGEM + 4, b.y + 12);
  doc.text("EMPRESA ASSESSORA / CONVÊNIO:", MARGEM + 4, b.y + 18);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(`${medicoCoordenador.nome}`, MARGEM + 65, b.y + 6);
  doc.text(`CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm} - Especialista em Medicina do Trabalho`, MARGEM + 65, b.y + 12);
  doc.text("SAFETY SOLUÇÕES EM ENGENHARIA DE SEGURANÇA E MEDICINA DO TRABALHO", MARGEM + 65, b.y + 18, { maxWidth: 110 });
  b.y += 28;

  // =========================================================================
  // SEÇÃO 04: QUADRO LABORAL (ESTRUTURA G91)
  // =========================================================================
  desenharTituloSecao(b, "04", "Quadro Laboral da Empresa");
  desenharParagrafo(
    b,
    "O quadro laboral a seguir consolida os setores operacionais e administrativos da empresa, vinculando cada função/cargo à sua respectiva Ficha de Exame e procedimentos de monitoramento ocupacional:"
  );

  desenharQuadroLaboral(b, ctx.quadroLaboral);

  // =========================================================================
  // SEÇÃO 05: CONSIDERAÇÕES GERAIS SOBRE O PCMSO
  // =========================================================================
  desenharTituloSecao(b, "05", "Considerações Gerais sobre o PCMSO");
  desenharParagrafo(
    b,
    "O PCMSO é parte integrante do conjunto mais amplo de iniciativas da organização no campo da saúde de seus empregados, devendo estar harmonizado com o disposto nas demais Normas Regulamentadoras. São diretrizes fundamentais do PCMSO:"
  );

  const diretrizes = [
    "a) Rastrear e detectar precocemente os agravos à saúde relacionados ao trabalho;",
    "b) Detectar possíveis exposições excessivas a agentes nocivos ocupacionais;",
    "c) Definir a aptidão de cada empregado para exercer suas funções ou tarefas determinadas;",
    "d) Subsidiar a implantação e o monitoramento da eficácia das medidas de prevenção adotadas na organização;",
    "e) Subsidiar análises epidemiológicas e estatísticas sobre os agravos à saúde e sua relação com os riscos ocupacionais;",
    "f) Subsidiar decisões sobre o afastamento de empregados de situações de trabalho que possam comprometer sua saúde;",
    "g) Subsidiar a emissão de notificações de agravos relacionados ao trabalho, de acordo com a regulamentação pertinente;",
    "h) Subsidiar o encaminhamento de empregados à Previdência Social;",
    "i) Acompanhar de forma diferenciada o empregado cujo estado de saúde possa ser especialmente afetado pelos riscos ocupacionais;",
    "j) Subsidiar ações de readaptação e reabilitação profissional;",
    "k) Controlar a imunização ativa dos empregados, relacionada a riscos ocupacionais, conforme recomendação do Ministério da Saúde.",
  ];
  diretrizes.forEach((d) => desenharParagrafo(b, d, 7.5, 2.2));

  desenharParagrafo(
    b,
    "O PCMSO inclui ações de vigilância passiva da saúde ocupacional (demanda espontânea dos colaboradores) e vigilância ativa (exames dirigidos com foco em sinais e sintomas de agravos). O PCMSO não tem caráter de seleção de pessoal.",
    8,
    4
  );

  // =========================================================================
  // SEÇÃO 06: DIRETRIZES E ATRIBUIÇÕES CONFORME NR-07
  // =========================================================================
  desenharTituloSecao(b, "06", "Diretrizes e Atribuições Conforme NR-07");
  desenharParagrafo(
    b,
    "Compete ao Empregador: garantir a elaboração e efetiva implantação do PCMSO; custear sem ônus para o empregado todos os procedimentos e exames relacionados ao programa; indicar médico do trabalho responsável pela coordenação; zelar pela guarda e sigilo dos prontuários médicos por no mínimo 20 (vinte) anos após o desligamento do colaborador."
  );
  desenharParagrafo(
    b,
    "Compete ao Médico Coordenador: realizar os exames médicos ou encarregar os mesmos a médicos examinadores qualificados; planejar e executar o programa de acordo com os riscos inventariados no PGR; emitir o Relatório Analítico anual com dados estatísticos e epidemiológicos; encaminhar trabalhadores à perícia médica previdenciária quando indicado."
  );
  desenharParagrafo(
    b,
    "Compete aos Empregados: submeter-se aos exames médicos previstos no PCMSO; comparecer aos agendamentos clínicos munidos de documentos de identificação; colaborar na preservação da integridade física e saúde individual e coletiva nos ambientes de trabalho."
  );

  // =========================================================================
  // SEÇÃO 07: DESCRIÇÃO DAS ATIVIDADES (TABELA CONSOLIDADA G91)
  // =========================================================================
  desenharTituloSecao(b, "07", "Descrição das Atividades");
  desenharParagrafo(
    b,
    "A relação abaixo especifica as atribuições e tarefas desempenhadas em cada função da organização, servindo de base para o enquadramento de riscos ergonômicos, físicos, químicos e mecânicos:"
  );

  desenharTabelaAtividades(b, ctx.atividadesLista);

  // =========================================================================
  // SEÇÃO 08: EXAMES MÉDICOS OCUPACIONAIS
  // =========================================================================
  desenharTituloSecao(b, "08", "Exames Médicos Ocupacionais");
  desenharParagrafo(
    b,
    "O PCMSO compreende a realização obrigatória dos exames médicos ocupacionais nas seguintes modalidades:"
  );
  desenharParagrafo(
    b,
    "• Exame Admissional: realizado obrigatoriamente antes que o empregado assuma suas atividades profissionais na empresa.\n" +
      "• Exame Periódico: realizado anualmente (a cada 12 meses) para trabalhadores expostos a riscos ocupacionais ou portadores de doenças crônicas, e bienalmente (a cada 24 meses) para os demais colaboradores sem exposição a riscos específicos.\n" +
      "• Exame de Retorno ao Trabalho: realizado obrigatoriamente antes do retorno às atividades para empregados afastados por período igual ou superior a 30 (trinta) dias por motivo de doença ou acidente, de natureza ocupacional ou não.\n" +
      "• Exame de Mudança de Riscos Ocupacionais: realizado obrigatoriamente antes da data de transferência de setor ou função que implique mudança na exposição a riscos ocupacionais em relação ao PGR.\n" +
      "• Exame Demissional: realizado em até 10 (dez) dias contados do término do contrato de trabalho, sendo dispensado se o exame ocupacional mais recente tiver sido realizado há menos de 135 dias (para Grau de Risco 1 e 2) ou menos de 90 dias (Grau de Risco 3 e 4).",
    7.5,
    4
  );

  // =========================================================================
  // SEÇÃO 09: DEFINIÇÕES SOBRE O ASO
  // =========================================================================
  desenharTituloSecao(b, "09", "Definições sobre o ASO (Atestado de Saúde Ocupacional)");
  desenharParagrafo(
    b,
    "Para cada exame médico ocupacional realizado, o médico emitirá o Atestado de Saúde Ocupacional - ASO em 2 (duas) vias físicas ou formato digital com assinatura eletrônica qualificada, devendo conter obrigatoriamente:"
  );
  desenharParagrafo(
    b,
    "a) Razão social e CNPJ da organização;\n" +
      "b) Nome completo, CPF e função do empregado;\n" +
      "c) Descrição dos fatores de riscos ocupacionais identificados no inventário do PGR ou indicação de inexistência de riscos específicos;\n" +
      "d) Indicação dos exames médicos clínicos e complementares realizados e suas respectivas datas;\n" +
      "e) Definição de APTO ou INAPTO para a função exercida ou a exercer;\n" +
      "f) Nome, número de registro no CRM e assinatura do médico examinador;\n" +
      "g) Nome, número de registro no CRM do Médico Coordenador do PCMSO.\n" +
      "As informações emitidas no ASO subsidiam diretamente a transmissão do evento S-2220 (Monitoramento da Saúde do Trabalhador) ao eSocial nacional.",
    7.5,
    4
  );

  // =========================================================================
  // SEÇÃO 10: PRIMEIROS SOCORROS E EMERGÊNCIA (ESTRUTURA G91)
  // =========================================================================
  desenharTituloSecao(b, "10", "Primeiros Socorros e Encaminhamento de Acidentados");
  desenharParagrafo(
    b,
    "Em conformidade com a NR-01 (subitem 1.5.6.2), as organizações devem prever meios e recursos para a prestação de primeiros socorros e o encaminhamento ágil de colaboradores acidentados aos serviços de saúde pública de urgência."
  );
  desenharParagrafo(
    b,
    "A empresa deve manter Caixa de Primeiros Socorros na cor branca com cruz verde, afixada em local acessível e de conhecimento de todos, sob a guarda de responsável treinado, contendo os seguintes materiais padronizados pelo Médico do Trabalho:"
  );

  // Tabela da Composição do Kit
  const kitItens: [string, string][] = [
    ["Termômetro clínico digital", "01 unidade"],
    ["Tesoura cirúrgica de ponta romba (sem ponta)", "01 unidade"],
    ["Pinça anatômica para curativos", "01 unidade"],
    ["Pacotes de compressas de gaze esterilizada (7,5 x 7,5 cm)", "10 pacotes"],
    ["Rolos de atadura de crepe de 10 cm e 15 cm", "04 rolos de cada"],
    ["Fita adesiva hospitalar tipo esparadrapo / micropore", "02 rolos"],
    ["Curativos adesivos hipoalergênicos de pronto uso (tipo Band-Aid)", "01 caixa"],
    ["Luvas de procedimento cirúrgico descartáveis (tamanhos M e G)", "01 caixa com 50 pares"],
    ["Óculos de proteção individual para o socorrista", "01 unidade"],
    ["Solução fisiológica a 0,9% para limpeza ocular e de ferimentos (250 ml / 500 ml)", "02 frascos"],
    ["Solução antisséptica tópica aquosa (Clorexidina 0,2% ou PVPI)", "01 frasco"],
  ];

  ensureSpace(b, kitItens.length * 5.5 + 10);
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("COMPOSIÇÃO PADRONIZADA DO KIT DE PRIMEIROS SOCORROS", MARGEM + 3, b.y + 4.2);
  doc.text("QUANTIDADE MÍNIMA", DIREITA - 4, b.y + 4.2, { align: "right" });
  b.y += 6;

  kitItens.forEach(([item, qtd], idx) => {
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(item, MARGEM + 3, b.y + 3.8);

    doc.setFont("helvetica", "bold");
    doc.text(qtd, DIREITA - 4, b.y + 3.8, { align: "right" });
    b.y += 5.2;
  });
  b.y += 4;

  // Caixa de Alerta sobre Proibição de Medicamentos
  ensureSpace(b, 20);
  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setFillColor(254, 243, 199); // amarelo suave de atenção
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 16, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("IMPORTANTE — RESTRIÇÃO LEGAL A MEDICAMENTOS NA CAIXA DE PRIMEIROS SOCORROS:", MARGEM + 3, b.y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(
    "Em estrito cumprimento à legislação sanitária vigente e ao Código de Ética Médica, a caixa de primeiros socorros NÃO deve conter medicamentos orais ou injetáveis (analgésicos, antitérmicos, anti-inflamatórios, antibióticos, calmantes, etc.). A administração de medicamentos é ato privativo da medicina, sendo expressamente vedada a automedicação e a distribuição de remédios por leigos ou socorristas.",
    MARGEM + 3,
    b.y + 9,
    { maxWidth: LARGURA_UTIL - 6 }
  );
  b.y += 20;

  // Tabela de Telefones Úteis e Órgãos de Emergência
  ensureSpace(b, 35);
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("ÓRGÃOS DE EMERGÊNCIA E TELEFONES ÚTEIS", MARGEM + 3, b.y + 4.2);
  b.y += 6;

  const telefonesEmergencia: [string, string, string][] = [
    ["SAMU - Serviço de Atendimento Móvel de Urgência", "192", "Remoção de doentes e emergências clínicas"],
    ["Corpo de Bombeiros Militar", "193", "Resgate, traumas e combate a incêndios"],
    ["Polícia Militar", "190", "Segurança pública e ocorrências emergenciais"],
    ["Defesa Civil", "199", "Prevenção de sinistros e calamidades"],
    ["Disque Intoxicação (ANVISA / CEATOX)", "0800 722 6001", "Orientações médicas sobre intoxicações"],
    [
      `Hospital / Pronto Atendimento Municipal (${empresa.cidade || "Alto Santo"} / ${empresa.uf || "CE"})`,
      empresa.telefone || "Central Local",
      "Unidade de referência médica para pronto atendimento",
    ],
  ];

  telefonesEmergencia.forEach(([servico, tel, destino], idx) => {
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(servico, MARGEM + 3, b.y + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
    doc.text(tel, MARGEM + 105, b.y + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(destino, MARGEM + 125, b.y + 4, { maxWidth: 50 });

    b.y += 5.5;
  });
  b.y += 6;

  // =========================================================================
  // SEÇÃO 11: FICHAS DE EXAME - RELAÇÃO DE PROCEDIMENTOS E DIAGNÓSTICOS
  // =========================================================================
  desenharTituloSecao(b, "11", "Relação de Procedimentos e Diagnósticos (Fichas de Exame)");
  desenharParagrafo(
    b,
    "As fichas a seguir detalham, por setor e grupo homogêneo, a correlação entre os agentes agressivos inventariados no PGR e os exames clínicos e complementares exigidos pela NR-07 para a preservação da saúde dos colaboradores:"
  );

  // Renderiza cada Ficha de Exame no modelo G91
  ctx.fichasExame.forEach((ficha) => {
    ensureSpace(b, 35);

    // Faixa Superior da Ficha
    doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${ficha.numero.toUpperCase()} — SETOR: ${ficha.setor.toUpperCase()}`, MARGEM + 3, b.y + 5);
    b.y += 7;

    /*
     * Linha de funções vinculadas.
     *
     * A faixa tinha altura fixa de 7 mm e avançava 9 mm, qualquer que fosse o
     * tamanho da lista. O setor ADMINISTRAÇÃO E GESTÃO tem 25 funções: o texto
     * quebrava em três linhas e as duas últimas saíam POR CIMA do título
     * "1. DESCRIÇÃO DOS RISCOS OCUPACIONAIS" logo abaixo — conferido no PCMSO
     * emitido em 10/2026, páginas 9, 12 e 13.
     *
     * Agora a altura sai da medição do texto. `splitTextToSize` devolve as
     * linhas que o jsPDF realmente vai desenhar, que é a única medida que não
     * erra quando o cadastro cresce.
     */
    const LARG_ROTULO = 31;
    const ALTURA_LINHA = 3.2;
    const textoFuncoes = ficha.funcoes.join(", ") || "Funções do Setor";
    const linhasFuncoes = doc.splitTextToSize(
      textoFuncoes,
      LARGURA_UTIL - LARG_ROTULO - 6,
    ) as string[];
    const alturaFaixa = Math.max(7, linhasFuncoes.length * ALTURA_LINHA + 3.4);

    /* A faixa não pode começar no pé da página e terminar na seguinte. */
    ensureSpace(b, alturaFaixa + 12);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaFaixa, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text("Funções abrangidas:", MARGEM + 3, b.y + 4.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    linhasFuncoes.forEach((linha, i) => {
      doc.text(linha, MARGEM + LARG_ROTULO + 3, b.y + 4.8 + i * ALTURA_LINHA);
    });
    b.y += alturaFaixa + 2;

    // Subtítulo Riscos
    desenharSubtitulo(b, "1. DESCRIÇÃO DOS RISCOS OCUPACIONAIS");

    // Tabelas dos 5 Grupos de Risco
    desenharTabelaRiscos5Colunas(b, "Grupo I - Riscos Físicos", [37, 99, 235], ficha.riscosFisicos);
    desenharTabelaRiscos5Colunas(b, "Grupo II - Riscos Químicos", [185, 28, 28], ficha.riscosQuimicos);
    desenharTabelaRiscos5Colunas(b, "Grupo III - Riscos Biológicos", [16, 149, 193], ficha.riscosBiologicos);
    desenharTabelaRiscos5Colunas(b, "Grupo IV - Riscos Ergonômicos", [202, 138, 4], ficha.riscosErgonomicos);
    desenharTabelaRiscos5Colunas(b, "Grupo V - Riscos de Acidentes / Mecânicos", [71, 85, 105], ficha.riscosAcidentes);

    // Subtítulo Exames
    b.y += 2;
    desenharSubtitulo(b, "2. RELAÇÃO DE EXAMES MÉDICOS OCUPACIONAIS");

    // Matriz de Exames da Ficha
    desenharMatrizExames(b, ficha.exames);

    b.y += 8;
  });

  // =========================================================================
  // SEÇÃO 12: MÉDICOS EXAMINADORES
  // =========================================================================
  desenharTituloSecao(b, "12", "Médicos Examinadores Autorizados");
  desenharParagrafo(
    b,
    "Médicos e profissionais capacitados autorizados pelo Médico Coordenador a realizar os exames clínicos ocupacionais (ASO) no âmbito deste PCMSO:"
  );

  ensureSpace(b, (ctx.medicosExaminadores.length + 1) * 6 + 6);
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NOME DO PROFISSIONAL", MARGEM + 3, b.y + 4.2);
  doc.text("REGISTRO CRM", MARGEM + 110, b.y + 4.2);
  doc.text("ESTADO / UF", DIREITA - 4, b.y + 4.2, { align: "right" });
  b.y += 6;

  ctx.medicosExaminadores.forEach((med, idx) => {
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(med.nome, MARGEM + 3, b.y + 4.2);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(`CRM ${med.crm}`, MARGEM + 110, b.y + 4.2);
    doc.text(med.uf, DIREITA - 8, b.y + 4.2, { align: "right" });
    b.y += 6;
  });
  b.y += 6;

  // =========================================================================
  // SEÇÃO 13: CRONOGRAMA ANUAL DE AÇÕES E TREINAMENTOS (PADRÃO G91)
  // =========================================================================
  desenharTituloSecao(b, "13", "Cronograma Anual de Ações e Treinamentos");
  desenharParagrafo(
    b,
    "Metas, ações e treinamentos preventivos programados para execução ao longo do período de vigência deste PCMSO:"
  );

  const cronogramaAcoes = ctx.cronograma.length > 0 ? ctx.cronograma : [
    {
      id: "1",
      acao: "Realização e Controle dos Exames Médicos Periódicos",
      responsavel: "Médico Coordenador / RH",
      data_planejada: vigenciaInicio,
      status: "Em andamento",
      observacoes: "Convocação e controle de 100% dos exames ocupacionais.",
    },
    {
      id: "2",
      acao: "Inspeção e Reposição dos Materiais da Caixa de Primeiros Socorros",
      responsavel: "SESMT / Brigada",
      data_planejada: vigenciaInicio,
      status: "Em andamento",
      observacoes: "Verificação mensal de validades e integridade dos itens.",
    },
    {
      id: "3",
      acao: "Treinamento de Primeiros Socorros e Suporte Básico de Vida",
      responsavel: "Assessoria Técnica",
      data_planejada: vigenciaInicio,
      status: "Planejado",
      observacoes: "Capacitação prática para colaboradores e brigadistas.",
    },
    {
      id: "4",
      acao: "Campanha Interna de Saúde e Prevenção de Doenças Crônicas / Ergonomia",
      responsavel: "Médico Coordenador",
      data_planejada: vigenciaInicio,
      status: "Planejado",
      observacoes: "Orientações posturais, controle de hipertensão e ginástica laboral.",
    },
    {
      id: "5",
      acao: "Elaboração do Relatório Analítico Anual do PCMSO",
      responsavel: "Médico Coordenador",
      data_planejada: vigenciaFim,
      status: "Planejado",
      observacoes: "Consolidação dos dados estatísticos, exames e dados epidemiológicos.",
    },
  ];

  cronogramaAcoes.forEach((acao) => {
    ensureSpace(b, 26);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(`AÇÃO: ${acao.acao.toUpperCase()}`, MARGEM + 3, b.y + 4.2);
    doc.text(`Status: ${acao.status || "Planejado"}`, DIREITA - 3, b.y + 4.2, { align: "right" });
    b.y += 6;

    doc.setFillColor(255, 255, 255);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 16, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text("Responsável:", MARGEM + 3, b.y + 4.8);
    doc.text("Previsão / Prazo:", MARGEM + 95, b.y + 4.8);
    doc.text("Observações / Meta:", MARGEM + 3, b.y + 10.5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(acao.responsavel || "Direção da Empresa", MARGEM + 24, b.y + 4.8);
    doc.text(fmtDate(acao.data_planejada) || "Durante a vigência", MARGEM + 120, b.y + 4.8);
    doc.text(acao.observacoes || "Execução integral conforme cronograma pactuado.", MARGEM + 32, b.y + 10.5, { maxWidth: LARGURA_UTIL - 36 });

    b.y += 18;
  });

  b.y += 4;

  // =========================================================================
  // SEÇÃO 14: TERMO DE ENCERRAMENTO E RESPONSABILIDADE (PADRÃO G91)
  // =========================================================================
  desenharTituloSecao(b, "14", "Termo de Encerramento e Responsabilidade");
  desenharParagrafo(
    b,
    "Pelo presente instrumento, a Organização e o Médico Coordenador assumem formalmente o compromisso de garantir a viabilização e efetiva implantação do Programa de Controle Médico de Saúde Ocupacional (PCMSO), zelando pela realização e custeando sem qualquer ônus para os colaboradores os exames e procedimentos preconizados pela Norma Regulamentadora 07."
  );
  desenharParagrafo(
    b,
    "Este PCMSO tem validade de 12 (doze) meses a contar da data de sua emissão, devendo ser revisto sempre que houver modificações nos riscos inventariados pelo PGR, processos de trabalho, máquinas ou novas instalações."
  );

  ensureSpace(b, 48);
  b.y += 14;

  // Assinatura do Médico Coordenador
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.line(MARGEM + 10, b.y, MARGEM + 80, b.y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(medicoCoordenador.nome, MARGEM + 45, b.y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(`Médico do Trabalho — CRM/${medicoCoordenador.uf} ${medicoCoordenador.crm}`, MARGEM + 45, b.y + 8.5, { align: "center" });
  doc.text("Responsável Técnico pelo PCMSO", MARGEM + 45, b.y + 12, { align: "center" });

  // Assinatura do Empregador / Representante Legal
  doc.line(DIREITA - 80, b.y, DIREITA - 10, b.y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text(empresa.nome, DIREITA - 45, b.y + 4.5, { align: "center", maxWidth: 68 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text("Direção da Empresa / Representante Legal", DIREITA - 45, b.y + 8.5, { align: "center" });
  doc.text("Responsável pela Execução do PCMSO", DIREITA - 45, b.y + 12, { align: "center" });

  b.y += 24;

  // =========================================================================
  // SEÇÃO 15: REFERÊNCIA BIBLIOGRÁFICA
  // =========================================================================
  desenharTituloSecao(b, "15", "Referência Bibliográfica");
  const bibliografia = [
    "• NR-07 - Programa de Controle Médico de Saúde Ocupacional: Portaria SEPRT n.º 6.734, de 09/03/2020.",
    "• NR-01 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais: Portaria SEPRT n.º 6.730, de 09/03/2020.",
    "• NR-17 - Ergonomia: Portaria MTP n.º 423, de 07/10/2021.",
    "• NR-05 - Comissão Interna de Prevenção de Acidentes e Assédio: Portaria MTP n.º 4.219, de 20/12/2022.",
    "• FUNDACENTRO: Guias de Vigilância em Saúde dos Trabalhadores e Critérios de Avaliação Ocupacional.",
    "• CLT - Consolidação das Leis do Trabalho: Decreto-Lei 5.452/1943 e Lei Federal 6.514/1977.",
  ];
  bibliografia.forEach((item) => desenharParagrafo(b, item, 7.5, 2.5));

  // =========================================================================
  // DESENHO DO SUMÁRIO DINÂMICO NA PÁGINA 3 COM PONTILHADOS E PÁGINAS EXATAS
  // =========================================================================
  doc.setPage(paginaDoSumario);
  let sy = 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.text("SUMÁRIO", MARGEM, sy);
  sy += 3;

  doc.setDrawColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGEM, sy, MARGEM + 30, sy);
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGEM + 30, sy, DIREITA, sy);
  sy += 8;

  b.sumario.forEach((s) => {
    const textoNumTitulo = `${s.num} – ${s.titulo.toUpperCase()}`;
    const paginaTexto = `pág. ${s.pagina}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(textoNumTitulo, MARGEM, sy);

    const wTexto = doc.getTextWidth(textoNumTitulo);
    const wPagina = doc.getTextWidth(paginaTexto);

    // Pontilhado elegante entre o título e o número da página
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 190, 205);
    const xInicioPontos = MARGEM + wTexto + 2;
    const xFimPontos = DIREITA - wPagina - 2;

    if (xFimPontos > xInicioPontos + 5) {
      let px = xInicioPontos;
      while (px < xFimPontos) {
        doc.text(".", px, sy);
        px += 2.2;
      }
    }

    // Número da página alinhado à direita
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COR_SECUNDARIA[0], COR_SECUNDARIA[1], COR_SECUNDARIA[2]);
    doc.text(paginaTexto, DIREITA, sy, { align: "right" });

    sy += 7.5;
  });

  // Retorna para a última página
  doc.setPage(doc.getNumberOfPages());

  // =========================================================================
  // CABEÇALHO E RODAPÉ OFICIAL TIMBRADO (IDÊNTICO AO PGR DO SAFETY SOLUÇÕES)
  // =========================================================================
  const qrUrl = opts?.qrUrl || (typeof window !== "undefined" ? `${window.location.origin}/pcmso/validar/${pcmso.id}` : `https://safetysolucoes.com/pcmso/validar/${pcmso.id}`);

  await rodapePaginas(doc, {
    qrUrl,
    logoDataUrl: logo,
    tituloCabecalho: "PCMSO — Programa de Controle Médico de Saúde Ocupacional",
    subtituloCabecalho: `${empresa.nome} (NR-07)`,
    linhas: (pagina, total) => [
      `PCMSO — ${empresa.nome}`,
      `Vigência: ${vigenciaInicio} a ${vigenciaFim}`,
      `Página ${pagina} de ${total}`,
    ],
  });

  return doc;
}

export async function generateAndUploadPcmsoPdf(pcmsoId: string): Promise<{ blob: Blob; fileName: string; viewLink?: string }> {
  const { carregarPcmsoPdfContexto } = await import("./pcmsoPdfContextoLoader");
  const ctx = await carregarPcmsoPdfContexto(pcmsoId);
  const pdf = await renderPcmsoPdf(ctx);

  const blob = pdf.output("blob");
  const empSlug = (ctx.empresa.nome || "empresa").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const fileName = `PCMSO_${empSlug}_v${ctx.pcmso.versao || 1}.pdf`;

  // Download automático no navegador do usuário
  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // Upload seguro no storage
  try {
    const up = await uploadDocumentoSeguro({
      empresa_id: ctx.empresa.id,
      kind: "pdf",
      modulo: "pcmso" as any,
      documento_id: pcmsoId,
      versao: ctx.pcmso.versao || 1,
      fileName,
      blob,
      driveFolderFallback: `PCMSO/Documento`,
    });

    await (supabase.from as any)("pcmso_documentos")
      .update({
        pdf_drive_file_id: up.ref,
        pdf_drive_view_link: up.viewLink,
        pdf_gerado_em: new Date().toISOString(),
      })
      .eq("id", pcmsoId);

    return { blob, fileName, viewLink: up.viewLink };
  } catch (err) {
    console.warn("[pcmsoPdf] Aviso: upload no storage retornou fallback, download local garantido.", err);
    return { blob, fileName };
  }
}
