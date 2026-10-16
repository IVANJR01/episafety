import jsPDF from "jspdf";
import { mesExtenso } from "@/lib/mesPrevisto";
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
const COR_CINZA_CABECALHO: [number, number, number] = [226, 232, 240];
const COR_CINZA_SUBGRUPO: [number, number, number] = [238, 242, 246];

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
 * Desenha a Tabela de Riscos no Modelo do Print do Usuário (4 colunas):
 * Tipo de Agente | Perigo/Fonte Exposição | Possíveis Lesões ou Agravos à Saúde | Limite de Exposição
 */
function desenharGrupoRiscoModeloPrint(
  b: BuilderState,
  tituloGrupo: string,
  riscos: PcmsoRiscoTabelaG91[]
) {
  const doc = b.doc;
  const colW = [40, 50, 58, 32]; // Total = 180mm

  ensureSpace(b, 18);

  // 1. Linha com Nome do Grupo de Risco (ex: "Risco Físico", "Risco Químico", etc.)
  doc.setFillColor(COR_CINZA_SUBGRUPO[0], COR_CINZA_SUBGRUPO[1], COR_CINZA_SUBGRUPO[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "F");
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.25);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
  doc.text(tituloGrupo, MARGEM + LARGURA_UTIL / 2, b.y + 3.9, { align: "center" });
  b.y += 5.5;

  // 2. Cabeçalho das 4 Colunas
  const ROTULOS = [
    "Tipo de Agente",
    "Perigo/Fonte Exposição",
    "Possíveis Lesões ou Agravos à Saúde",
    "Limite de Exposição",
  ];

  doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6.5, "F");
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

  let cx = MARGEM;
  ROTULOS.forEach((rotulo, idx) => {
    if (idx > 0) doc.line(cx, b.y, cx, b.y + 6.5);
    const linhasRotulo = doc.splitTextToSize(rotulo, colW[idx] - 3);
    if (linhasRotulo.length > 1) {
      doc.text(linhasRotulo, cx + colW[idx] / 2, b.y + 2.8, { align: "center" });
    } else {
      doc.text(rotulo, cx + colW[idx] / 2, b.y + 4.2, { align: "center" });
    }
    cx += colW[idx];
  });
  b.y += 6.5;

  // 3. Linhas de Dados do Grupo
  const listaParaRender = riscos.length > 0 ? riscos : [
    {
      agente: "Ausência de Fator de Risco",
      fonte: "Não se aplica",
      danos: "Não se aplica",
      meioPropagacao: "Não se aplica",
      formaExposicao: "Não se aplica",
    },
  ];

  const celula = (v: unknown): string =>
    v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

  listaParaRender.forEach((r, idx) => {
    const l1 = doc.splitTextToSize(celula(r.agente), colW[0] - 4);
    const l2 = doc.splitTextToSize(celula(r.fonte), colW[1] - 4);
    const l3 = doc.splitTextToSize(celula(r.danos), colW[2] - 4);
    const formaValor = celula((r as { formaExposicao?: unknown }).formaExposicao || "Não se aplica");
    const l4 = doc.splitTextToSize(formaValor, colW[3] - 4);

    const maxLinhas = Math.max(l1.length, l2.length, l3.length, l4.length);
    const alturaLinha = Math.max(5.5, maxLinhas * 3.2 + 2.5);

    ensureSpace(b, alturaLinha);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setLineWidth(0.25);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaLinha, "FD");

    // Divisórias verticais
    let xSep = MARGEM;
    for (let c = 0; c < colW.length - 1; c++) {
      xSep += colW[c];
      doc.line(xSep, b.y, xSep, b.y + alturaLinha);
    }

    doc.setFont("helvetica", r.agente === "Ausência de Fator de Risco" ? "italic" : "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

    let xCol = MARGEM;
    // Col 1: Tipo de Agente
    if (r.agente === "Ausência de Fator de Risco") {
      doc.text(l1, xCol + colW[0] / 2, b.y + 3.6, { align: "center" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.text(l1, xCol + 2, b.y + 3.6);
      doc.setFont("helvetica", "normal");
    }
    xCol += colW[0];

    // Col 2: Perigo/Fonte Exposição
    if (celula(r.fonte).toLowerCase() === "não se aplica") {
      doc.text(l2, xCol + colW[1] / 2, b.y + 3.6, { align: "center" });
    } else {
      doc.text(l2, xCol + 2, b.y + 3.6);
    }
    xCol += colW[1];

    // Col 3: Possíveis Lesões ou Agravos à Saúde
    if (celula(r.danos).toLowerCase() === "não se aplica") {
      doc.text(l3, xCol + colW[2] / 2, b.y + 3.6, { align: "center" });
    } else {
      doc.text(l3, xCol + 2, b.y + 3.6);
    }
    xCol += colW[2];

    // Col 4: Limite de Exposição
    doc.text(l4, xCol + colW[3] / 2, b.y + 3.6, { align: "center" });

    b.y += alturaLinha;
  });
}

/**
 * Desenha a Matriz de Exames no Modelo do Print:
 * Código | Exame | ADM | Periódico | RT | MRO | DEM
 */
function desenharMatrizExames(b: BuilderState, exames: PcmsoFichaExameG91["exames"]) {
  const doc = b.doc;
  const colW = [18, 76, 17, 22, 15, 17, 15]; // Total = 180mm

  ensureSpace(b, 20);

  // Cabeçalho das 7 Colunas
  doc.setFillColor(COR_CINZA_CABECALHO[0], COR_CINZA_CABECALHO[1], COR_CINZA_CABECALHO[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
  doc.setLineWidth(0.25);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);

  let cx = MARGEM;
  doc.text("Código", cx + colW[0] / 2, b.y + 4.2, { align: "center" });
  cx += colW[0];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("Exame", cx + colW[1] / 2, b.y + 4.2, { align: "center" });
  cx += colW[1];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("ADM", cx + colW[2] / 2, b.y + 4.2, { align: "center" });
  cx += colW[2];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("Periódico", cx + colW[3] / 2, b.y + 4.2, { align: "center" });
  cx += colW[3];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("RT", cx + colW[4] / 2, b.y + 4.2, { align: "center" });
  cx += colW[4];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("MRO", cx + colW[5] / 2, b.y + 4.2, { align: "center" });
  cx += colW[5];
  doc.line(cx, b.y, cx, b.y + 6);
  doc.text("DEM", cx + colW[6] / 2, b.y + 4.2, { align: "center" });
  b.y += 6;

  // Linhas de Exames
  exames.forEach((ex, idx) => {
    const nomeLinhas = doc.splitTextToSize(ex.nome, colW[1] - 4);
    const alturaLinha = Math.max(5.5, nomeLinhas.length * 3.2 + 2.5);

    ensureSpace(b, alturaLinha);

    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setLineWidth(0.25);
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
    doc.text(ex.codigo || "0295", xCol + colW[0] / 2, b.y + 3.8, { align: "center" });
    xCol += colW[0];

    // Nome
    doc.setFont("helvetica", "normal");
    doc.text(nomeLinhas, xCol + 2, b.y + 3.8);
    xCol += colW[1];

    // Colunas de Periodicidade
    const formatarValor = (val: string) => {
      if (!val || val === "—") return "—";
      return val;
    };

    const pintarCelula = (val: string, largura: number) => {
      const v = formatarValor(val);
      doc.text(v, xCol + largura / 2, b.y + 3.8, { align: "center" });
      xCol += largura;
    };

    pintarCelula(ex.adm, colW[2]);
    pintarCelula(ex.periodico, colW[3]);
    pintarCelula(ex.rt, colW[4]);
    pintarCelula(ex.mdf, colW[5]);
    pintarCelula(ex.dem, colW[6]);

    b.y += alturaLinha;
  });

  // Nota de exame audiométrico
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);

  const notaAudio = doc.splitTextToSize(
    "* O exame audiométrico deve ser realizado, no mínimo: na admissão; anualmente, tendo como referência o exame admissional e na demissão.",
    LARGURA_UTIL - 4,
  ) as string[];
  ensureSpace(b, notaAudio.length * 2.8 + 6);
  notaAudio.forEach((linha, i) => doc.text(linha, MARGEM + LARGURA_UTIL / 2, b.y + 3.2 + i * 2.8, { align: "center" }));
  b.y += notaAudio.length * 2.8 + 1.5;

  // Legenda explicativa normativa
  const linhasLegenda = [
    "Legenda: M: Masculino, F: Feminino, ADM: Admissão, MRO: Mudança de Riscos Ocupacionais, RT: Retorno ao Trabalho, DEM: Demissional",
    "(*) exigido quando a mudança implicar exposição a risco diferente do atual",
  ];
  ensureSpace(b, linhasLegenda.length * 2.8 + 4);
  linhasLegenda.forEach((linha, i) => doc.text(linha, MARGEM + LARGURA_UTIL / 2, b.y + 3 + i * 2.8, { align: "center" }));
  b.y += linhasLegenda.length * 2.8 + 4;
}

// ---------------------------------------------------------------------------
// GERADOR PRINCIPAL DO PCMSO COMPLETO
// ---------------------------------------------------------------------------

/**
 * Grau de risco como a NR-04 escreve: "01 (Um)".
 *
 * O PCMSO imprimia o número cru com um zero colado na frente, e caía em "02"
 * quando o cadastro estava vazio — afirmar grau 2 sem saber muda o
 * enquadramento da empresa e o prazo do exame demissional. Sem o dado, vazio.
 *
 * Mesma regra já aplicada no PGR, para que os dois documentos da mesma
 * empresa não digam a mesma coisa de dois jeitos.
 */
const GRAU_EXTENSO = ["", "Um", "Dois", "Três", "Quatro"];
export function grauDeRiscoExtenso(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) return "—";
  return `${String(n).padStart(2, "0")} (${GRAU_EXTENSO[n]})`;
}

export async function renderPcmsoPdf(ctx: PcmsoPdfContext, opts?: { qrUrl?: string }): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const { empresa, medicoCoordenador, pcmso, emissor } = ctx;
  const anoCapa = (pcmso.data_emissao || pcmso.data_vigencia_inicio || new Date().toISOString()).slice(0, 4);
  const vigenciaInicio = fmtDate(pcmso.data_vigencia_inicio);
  const vigenciaFim = fmtDate(pcmso.data_vigencia_fim);
  const logo = ctx.emissorLogoDataUrl || ctx.empresaLogoDataUrl;

  // =========================================================================
  // PÁGINA 1: CAPA OFICIAL (IDÊNTICA AO PGR DO SAFETY SOLUÇÕES)
  // =========================================================================
  capaTimbrada(doc, {
    logoDataUrl: logo,
    /*
     * A capa não repete a identificação da empresa nem o bloco de versões.
     *
     * Trazia "REV. 00 / PCMSO v1" no alto e uma tabela com Empresa, CNPJ,
     * CNAE, Grau de Risco e Médico Coordenador. Tudo isso já está completo na
     * página 2, e na capa só deixava a folha poluída — a mesma limpeza já
     * feita na capa do PGR. A capa diz o que o documento é: sigla, título,
     * norma e vigência.
     */
    sigla: "PCMSO",
    titulo: "Programa de Controle Médico de Saúde Ocupacional",
    subtitulo: "NR-07 — Portaria SEPRT n.º 6.734/2020",
    nota: pcmso.data_vigencia_inicio && pcmso.data_vigencia_fim
      ? `Vigência: ${vigenciaInicio} a ${vigenciaFim}`
      : null,
    empresaNome: empresa.nome || "Empresa",
    identificacao: [],
    campos: [],
    linhasTabela: [],
    /*
     * Cidade e UF da EMPRESA. Caíam em "Alto Santo / CE" quando o cadastro
     * estava vazio — a cidade da consultoria no lugar da cidade do cliente.
     * Sem o dado, fica só o ano.
     */
    rodapeLocal: [empresa.cidade, empresa.uf].filter(Boolean).join(" / ")
      ? `${[empresa.cidade, empresa.uf].filter(Boolean).join(" / ")} – ${anoCapa}`
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

  /*
   * Identificação da empresa CLIENTE.
   *
   * Três campos vinham com valor inventado quando o cadastro estava vazio, e
   * documento legal não preenche lacuna com chute:
   *   - grau de risco caía em "02" — afirmar grau 2 sem saber muda o
   *     enquadramento da empresa e o prazo do exame demissional;
   *   - cidade/UF caíam em "Alto Santo / CE";
   *   - o TELEFONE caía no telefone da consultoria, e o documento dizia que
   *     aquele era o contato do cliente.
   * Sem o dado, agora sai travessão — que é o que o leitor precisa ver.
   */
  const secundarios = (empresa as { cnae_secundario?: string | null }).cnae_secundario
    || empresa.cnae_descricao || "";
  const dadosEmpresaTabela: [string, string][] = [
    ["Razão Social:", empresa.nome || "—"],
    ["Nome Fantasia:", empresa.nome_fantasia || empresa.nome || "—"],
    ["CNPJ:", `${empresa.cnpj || "—"}          Grau de Risco: ${grauDeRiscoExtenso(empresa.grau_risco)}`],
    ["Endereço:", `${empresa.endereco_completo || [empresa.logradouro, empresa.numero, empresa.bairro].filter(Boolean).join(", ") || "—"}`],
    ["Cidade / UF / CEP:", `${[empresa.cidade, empresa.uf].filter(Boolean).join(" / ") || "—"} — CEP: ${empresa.cep || "—"}`],
    ["CNAE Principal:", empresa.cnae_principal || "—"],
    ["CNAE Secundário:", secundarios || "—"],
    ["Telefone / Contato:", `${empresa.telefone || "—"}          E-mail: ${empresa.email || "—"}`],
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

  /*
   * Quem elaborou o documento sai do cadastro do EMISSOR, não do código.
   *
   * Razão social, CNPJ, telefone e endereço da SafetySoluções estavam escritos
   * à mão aqui. Qualquer outra consultoria que usasse o sistema emitiria um
   * PCMSO declarando o CNPJ da SafetySoluções como responsável técnica — o que
   * é falso sobre quem responde pelo documento.
   *
   * Sem cadastro de emissor, cai no texto de antes, para não regredir para
   * quem já usa o sistema hoje.
   */
  const assessoriaNome = (emissor?.nome || "").trim()
    || "SAFETY SOLUÇÕES EM ENGENHARIA DE SEGURANÇA E MEDICINA DO TRABALHO LTDA";
  const assessoriaCnpj = (emissor?.cnpj || "").trim() || "33.725.753/0001-90";
  const assessoriaContato = (emissor?.contato || "").trim() || "(88) 99653-6252";
  const assessoriaEndereco = (emissor?.endereco || "").trim()
    || "Rua Cel. Vicente Saraiva, 1147 - Sala 04 - Centro - Alto Santo / CE";

  const dadosAssessoria: [string, string][] = [
    ["Razão Social:", assessoriaNome],
    ["CNPJ:", `${assessoriaCnpj}          Telefone: ${assessoriaContato}`],
    ["Endereço:", assessoriaEndereco],
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
      /* Sem a cidade cadastrada, não se nomeia um município qualquer. */
      [empresa.cidade, empresa.uf].filter(Boolean).length
        ? `Hospital / Pronto Atendimento Municipal (${[empresa.cidade, empresa.uf].filter(Boolean).join(" / ")})`
        : "Hospital / Pronto Atendimento Municipal",
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

  // Renderiza cada Ficha de Exame no modelo do Print enviado pelo usuário
  ctx.fichasExame.forEach((ficha) => {
    // Quebra de página para manter cada ficha limpa no topo da folha
    if (b.y > 55) {
      b.doc.addPage();
      b.paginaAtual++;
      b.y = 22;
    }

    const colWHeader = [75, 105]; // Total = 180mm

    // 1. Barra Superior da Ficha: "Ficha de Exame {numero}"
    ensureSpace(b, 25);
    doc.setFillColor(COR_CINZA_CABECALHO[0], COR_CINZA_CABECALHO[1], COR_CINZA_CABECALHO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6.5, "F");
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setLineWidth(0.25);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(`Ficha de Exame ${ficha.numero}`, MARGEM + LARGURA_UTIL / 2, b.y + 4.5, { align: "center" });
    b.y += 6.5;

    // 2. Linha de Rótulos: "Setor" | "Função"
    doc.setFillColor(COR_CINZA_CLARO[0], COR_CINZA_CLARO[1], COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "F");
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "S");
    doc.line(MARGEM + colWHeader[0], b.y, MARGEM + colWHeader[0], b.y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text("Setor", MARGEM + colWHeader[0] / 2, b.y + 3.8, { align: "center" });
    doc.text("Função", MARGEM + colWHeader[0] + colWHeader[1] / 2, b.y + 3.8, { align: "center" });
    b.y += 5.5;

    // 3. Linha de Conteúdo: Nome do Setor | Funções
    const textoFuncoes = ficha.funcoes.join(", ") || "Funções do Setor";
    const linhasFuncoes = doc.splitTextToSize(textoFuncoes, colWHeader[1] - 6) as string[];
    const alturaBlocoFuncoes = Math.max(7, linhasFuncoes.length * 3.4 + 3);

    ensureSpace(b, alturaBlocoFuncoes + 10);

    doc.setFillColor(255, 255, 255);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, alturaBlocoFuncoes, "FD");
    doc.line(MARGEM + colWHeader[0], b.y, MARGEM + colWHeader[0], b.y + alturaBlocoFuncoes);

    // Setor centralizado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(ficha.setor.toUpperCase(), MARGEM + colWHeader[0] / 2, b.y + alturaBlocoFuncoes / 2 + 1.2, { align: "center" });

    // Funções centralizadas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const startYFuncoes = b.y + (alturaBlocoFuncoes - linhasFuncoes.length * 3.2) / 2 + 2.4;
    linhasFuncoes.forEach((linha, i) => {
      doc.text(linha, MARGEM + colWHeader[0] + colWHeader[1] / 2, startYFuncoes + i * 3.2, { align: "center" });
    });
    b.y += alturaBlocoFuncoes;

    // 4. Barra: "Descrição dos Riscos"
    doc.setFillColor(COR_CINZA_CABECALHO[0], COR_CINZA_CABECALHO[1], COR_CINZA_CABECALHO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "F");
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setLineWidth(0.25);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 5.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text("DESCRIÇÃO DOS RISCOS", MARGEM + LARGURA_UTIL / 2, b.y + 3.8, { align: "center" });
    b.y += 5.5;

    // 5. Grupos de Risco na ordem oficial
    desenharGrupoRiscoModeloPrint(b, "Risco Físico", ficha.riscosFisicos);
    desenharGrupoRiscoModeloPrint(b, "Risco Químico", ficha.riscosQuimicos);
    desenharGrupoRiscoModeloPrint(b, "Risco Biológico", ficha.riscosBiologicos);
    desenharGrupoRiscoModeloPrint(b, "Risco Ergonômico", ficha.riscosErgonomicos);
    desenharGrupoRiscoModeloPrint(b, "Risco de Acidentes", ficha.riscosAcidentes);

    // 6. Matriz de Exames da Ficha
    desenharMatrizExames(b, ficha.exames);

    b.y += 6;
  });

  // =========================================================================
  // SEÇÃO 12: CRITÉRIOS DE INTERPRETAÇÃO E CONDUTAS
  //
  // Exigida pela NR-07, item 7.5.4 "c": a organização deve garantir que o
  // PCMSO "contenha os critérios de interpretação e planejamento das condutas
  // relacionadas aos achados dos exames médicos". O documento não tinha seção
  // nenhuma sobre isso — era uma falta perante a norma, não um detalhe de
  // layout.
  //
  // O texto abaixo descreve a CONDUTA, que é o que a norma pede do programa, e
  // sai da própria NR: 7.5.5 (reavaliar o inventário com os responsáveis pelo
  // PGR), 7.5.9.1 (retorno gradativo), 7.6.5 (discutir com SST e CIPA). Não
  // há aqui critério clínico — isso é do médico coordenador, e a última linha
  // diz exatamente isso.
  // =========================================================================
  desenharTituloSecao(b, "12", "Critérios de Interpretação e Condutas");
  desenharParagrafo(
    b,
    "Os achados dos exames médicos ocupacionais são interpretados pelo Médico Coordenador deste PCMSO e orientam as condutas descritas a seguir, conforme o item 7.5.4 \"c\" da NR-07:"
  );
  [
    "a) Resultado dentro dos parâmetros de normalidade: mantém-se a periodicidade de exames definida neste programa para a função.",
    "b) Resultado alterado sem relação com o trabalho: o empregado é orientado e encaminhado à rede de assistência à saúde, mantendo-se a aptidão quando a alteração não comprometer o exercício seguro da função.",
    "c) Resultado alterado com suspeita de relação com o trabalho: repetição ou complementação do exame, avaliação do nexo causal, reavaliação da exposição e das medidas de controle e, quando indicado, afastamento da exposição.",
    "d) Confirmada doença relacionada ao trabalho: emissão da Comunicação de Acidente de Trabalho (CAT), notificação epidemiológica quando aplicável, encaminhamento à Previdência Social e definição de restrições ou readaptação.",
    "e) No retorno ao trabalho, a avaliação médica define a necessidade de retorno gradativo (NR-07, subitem 7.5.9.1).",
    "f) Identificada inconsistência no inventário de riscos, o Médico Coordenador a reavalia em conjunto com os responsáveis pelo PGR (NR-07, subitem 7.5.5).",
    "g) Os achados e suas condutas são apresentados e discutidos com os responsáveis por segurança e saúde no trabalho e com a CIPA, quando existente (NR-07, subitem 7.6.5).",
  ].forEach((linha) => desenharParagrafo(b, linha, 7.5, 2));
  desenharParagrafo(
    b,
    "A interpretação clínica de cada achado, os critérios de aptidão e as condutas individuais são atribuição exclusiva do Médico Coordenador e dos médicos examinadores, registradas no prontuário médico individual do empregado.",
    7.5,
    4
  );

  // =========================================================================
  // SEÇÃO 13: RELATÓRIO ANALÍTICO
  //
  // Exigido pelo item 7.5.4 "e" c/c 7.6.2: o PCMSO deve incluir relatório
  // analítico do programa. O sistema já calculava as estatísticas de ASO e
  // guardava o texto do médico, e NADA disso chegava ao documento.
  //
  // As alíneas "a" e "b" do 7.6.2 (número de exames clínicos e número e tipos
  // de complementares) saem dos dados; as demais dependem de prontuário, que é
  // do médico — por isso o texto dele entra inteiro, e o 7.6.6 dispensa as
  // outras alíneas para organizações pequenas.
  // =========================================================================
  desenharTituloSecao(b, "13", "Relatório Analítico do Programa");
  desenharParagrafo(
    b,
    "Relatório analítico elaborado conforme o subitem 7.6.2 da NR-07, considerando o período de vigência deste programa:"
  );
  {
    const e = ctx.estatisticasAsos;
    desenharParagrafo(
      b,
      `a) Exames clínicos ocupacionais realizados: ${e.total} (admissionais: ${e.admissional}; periódicos: ${e.periodico}; retorno ao trabalho: ${e.retorno}; mudança de riscos: ${e.mudanca}; demissionais: ${e.demissional}).`,
      7.5,
      2
    );
    desenharParagrafo(
      b,
      `b) Resultados de aptidão registrados: ${e.aptos} aptos, ${e.restricoes} aptos com restrição e ${e.inaptos} inaptos.`,
      7.5,
      2
    );
    const texto = (ctx.relatorioAnaliticoTexto || "").trim();
    desenharParagrafo(
      b,
      texto
        || "Análise do Médico Coordenador não registrada até a emissão deste documento. As alíneas \"c\" a \"f\" do subitem 7.6.2 dependem dos dados dos prontuários médicos e são elaboradas pelo Médico Coordenador do PCMSO.",
      7.5,
      4
    );
  }

  // =========================================================================
  // SEÇÃO 14: MÉDICOS EXAMINADORES
  // =========================================================================
  desenharTituloSecao(b, "14", "Médicos Examinadores e Profissionais Habilitados");
  desenharParagrafo(
    b,
    "Médicos examinadores, fonoaudiólogos e profissionais de saúde legalmente habilitados e autorizados pelo Médico Coordenador a realizar as avaliações clínicas e exames complementares ocupacionais (NR-07):"
  );

  ensureSpace(b, (ctx.medicosExaminadores.length + 1) * 6 + 6);
  doc.setFillColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
  doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NOME DO PROFISSIONAL", MARGEM + 3, b.y + 4.2);
  doc.text("REGISTRO PROFISSIONAL", MARGEM + 110, b.y + 4.2);
  doc.text("CONSELHO / UF", DIREITA - 4, b.y + 4.2, { align: "right" });
  b.y += 6;

  ctx.medicosExaminadores.forEach((med, idx) => {
    doc.setDrawColor(COR_BORDA[0], COR_BORDA[1], COR_BORDA[2]);
    doc.setFillColor(idx % 2 === 0 ? 255 : COR_CINZA_CLARO[0], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[1], idx % 2 === 0 ? 255 : COR_CINZA_CLARO[2]);
    doc.rect(MARGEM, b.y, LARGURA_UTIL, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
    doc.text(med.nome, MARGEM + 3, b.y + 4.2);

    const ufUpper = (med.uf || "").toUpperCase();
    const crmUpper = (med.crm || "").toUpperCase();
    const isFono = ufUpper.includes("CRFA") || crmUpper.includes("CRFA") || ufUpper.includes("CRF");
    const regTexto = isFono
      ? (crmUpper.startsWith("CRFA") ? crmUpper : `CRFa ${med.crm}`)
      : `CRM ${med.crm}`;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COR_TEXTO[0], COR_TEXTO[1], COR_TEXTO[2]);
    doc.text(regTexto, MARGEM + 110, b.y + 4.2);
    doc.text(med.uf || "CE", DIREITA - 8, b.y + 4.2, { align: "right" });
    b.y += 6;
  });
  b.y += 6;

  // =========================================================================
  // SEÇÃO 13: CRONOGRAMA ANUAL DE AÇÕES E TREINAMENTOS (PADRÃO G91)
  // =========================================================================
  desenharTituloSecao(b, "15", "Cronograma Anual de Ações e Treinamentos");
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
    /*
     * Mês e ano, não dia.
     *
     * O cronograma planeja o ano — "campanha de vacinação em maio" —, e
     * imprimir 20/05/2026 afirma um dia que ninguém combinou. Sem data
     * cadastrada, o prazo sai em palavras.
     */
    const prazo = mesExtenso(acao.data_planejada);
    doc.text(prazo || "Durante a vigência", MARGEM + 120, b.y + 4.8);
    doc.text(acao.observacoes || "Execução integral conforme cronograma pactuado.", MARGEM + 32, b.y + 10.5, { maxWidth: LARGURA_UTIL - 36 });

    b.y += 18;
  });

  b.y += 4;

  // =========================================================================
  // SEÇÃO 14: TERMO DE ENCERRAMENTO E RESPONSABILIDADE (PADRÃO G91)
  // =========================================================================
  desenharTituloSecao(b, "16", "Termo de Encerramento e Responsabilidade");
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
  desenharTituloSecao(b, "17", "Referência Bibliográfica");
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
