import jsPDF from "jspdf";

interface EmpresaData {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  logo_url: string | null;
}

interface FuncionarioData {
  nome: string;
  cargo: string | null;
  setor: string | null;
  cpf: string | null;
  matricula: string | null;
  data_admissao: string | null;
}

interface EntregaItem {
  data: string;
  quantidade: number;
  epi_nome: string;
  epi_ca: string | null;
  observacao: string | null;
}

interface FichaData {
  empresa: EmpresaData;
  funcionario: FuncionarioData;
  entregas: EntregaItem[];
  assinaturaColaborador: string | null;
  assinaturaResponsavel: string | null;
  responsavelNome: string;
  responsavelCargo: string;
  dataAssinatura: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

const DECLARACAO = `DECLARO ter recebido o(s) Equipamento(s) de Proteção Individual - EPI's., abaixo especificado(s) nos termos do artigo 166 e 167 da CLT, com redação dada pela Lei Federal nº 6.514/77, objetivando a proteção da incolumidade física, bem como a neutralização de possíveis agentes insalubres conforme o art. 191, inciso II, da norma jurídica mencionada, e ainda, o treinamento para o uso correto do(s) mesmo(s). COMPROMETO-ME a utilizá-los sempre para os fins a que se destinam, estando ciente que o não uso incorrerá contra a minha pessoa em ato faltoso, sujeitando-me as penalidades legais. RESPONSABILIZO-ME por sua guarda, conservação, uso correto, e a devolução ao SESMT em qualquer estado que se encontre o equipamento, indenizando a empresa no caso de perda, extravio ou danos por uso incorreto (art. 462, parágrafo 1º, da CLT), e, a comunicação ao superior hierárquico ou Técnico em Segurança do Trabalho caso ocorra qualquer alteração que o torne impróprio para o uso, sendo possível a retirada ou troca de EPI sempre que necessário.`;

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function drawPageHeader(doc: jsPDF, data: FichaData, pageNum: number, totalPages: number) {
  let y = 10;

  // Top info line
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const now = new Date();
  doc.text(`Documento gerado em: ${now.toLocaleDateString("pt-BR")}`, MARGIN, y);
  doc.text(`Pág. ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, y, { align: "right" });

  y = 28;

  // Company name centered
  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.empresa.nome || "EMPRESA", PAGE_W / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(12);
  doc.text("Ficha de EPI - Trabalhadores", PAGE_W / 2, y, { align: "center" });

  y += 7;
  const cnpjText = data.empresa.cnpj ? ` (${data.empresa.cnpj})` : "";
  doc.text(`${data.empresa.nome || "EMPRESA"}${cnpjText}`, PAGE_W / 2, y, { align: "center" });

  y += 10;

  // Employee info table
  const colWidths = [0.40, 0.30, 0.12, 0.18]; // proportions
  const headers = ["Nome do Trabalhador", "Função", "Matrícula", "Data de admissão"];
  const values = [
    data.funcionario.nome,
    data.funcionario.cargo || "—",
    data.funcionario.matricula || "—",
    formatDate(data.funcionario.data_admissao || ""),
  ];

  const rowH = 7;
  let x = MARGIN;

  // Header row
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, CONTENT_W, rowH, "FD");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);

  for (let i = 0; i < headers.length; i++) {
    const w = CONTENT_W * colWidths[i];
    doc.rect(x, y, w, rowH, "S");
    doc.text(headers[i], x + 2, y + 5);
    x += w;
  }

  y += rowH;
  x = MARGIN;

  // Values row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let i = 0; i < values.length; i++) {
    const w = CONTENT_W * colWidths[i];
    doc.rect(x, y, w, rowH, "S");
    doc.text(values[i], x + 2, y + 5);
    x += w;
  }

  y += rowH + 3;

  // Declaration text
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  const lines = doc.splitTextToSize(DECLARACAO, CONTENT_W);
  doc.text(lines, MARGIN, y);
  y += lines.length * 3 + 4;

  return y;
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const colWidths = [22, 22, 14, 52, 16, 22, 22]; // = 170 = CONTENT_W
  const headers = ["Entrega", "Devolução", "Qtde.", "Equipamento", "CA nº", "Motivo", "Assinatura"];

  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, CONTENT_W, 7, "FD");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);

  let x = MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(x, y, colWidths[i], 7, "S");
    doc.text(headers[i], x + colWidths[i] / 2, y + 5, { align: "center" });
    x += colWidths[i];
  }

  return y + 7;
}

function drawFooter(doc: jsPDF) {
  const footerY = PAGE_H - 15;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Gerado no sistema EPI Control", PAGE_W / 2, footerY, { align: "center" });
  doc.text("Documento assinado eletronicamente, conforme MP 2.200-2/01, Art. 10º, §2.", PAGE_W / 2, footerY + 4, { align: "center" });
}

export function gerarFichaEPI(data: FichaData) {
  const doc = new jsPDF("p", "mm", "a4");
  const colWidths = [22, 22, 14, 52, 16, 22, 22];
  const ROW_H = 18;
  const MAX_Y = PAGE_H - 30; // leave space for footer

  // Calculate total pages
  const headerHeight = 120; // approximate
  const rowsPerPage = Math.floor((MAX_Y - headerHeight) / ROW_H);
  const totalPages = Math.max(1, Math.ceil(data.entregas.length / Math.max(1, rowsPerPage)));

  let pageNum = 1;
  let y = drawPageHeader(doc, data, pageNum, totalPages);
  y = drawTableHeader(doc, y);

  const tipoLabels: Record<string, string> = { entrega: "Entrega", troca: "Substituição", devolucao: "Devolução" };

  data.entregas.forEach((entrega, idx) => {
    if (y + ROW_H > MAX_Y) {
      drawFooter(doc);
      doc.addPage();
      pageNum++;
      y = drawPageHeader(doc, data, pageNum, totalPages);
      y = drawTableHeader(doc, y);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    let x = MARGIN;
    for (let i = 0; i < colWidths.length; i++) {
      doc.rect(x, y, colWidths[i], ROW_H, "S");
      x += colWidths[i];
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(0);

    x = MARGIN;

    // Entrega date
    doc.text(formatDate(entrega.data), x + colWidths[0] / 2, y + ROW_H / 2, { align: "center" });
    x += colWidths[0];

    // Devolução (empty for now)
    x += colWidths[1];

    // Qtde
    doc.text(String(entrega.quantidade), x + colWidths[2] / 2, y + ROW_H / 2, { align: "center" });
    x += colWidths[2];

    // Equipamento - name bold, then details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const epiName = entrega.epi_nome || "—";
    doc.text(epiName, MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 5);
    
    if (entrega.epi_ca) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text(`Validade do C.A: —`, MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 9);
    }

    if (entrega.observacao) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      const obsLines = doc.splitTextToSize(entrega.observacao, colWidths[3] - 4);
      doc.text(obsLines.slice(0, 2), MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 13);
    }

    x += colWidths[3];

    // CA nº
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(entrega.epi_ca || "—", x + colWidths[4] / 2, y + ROW_H / 2, { align: "center" });
    x += colWidths[4];

    // Motivo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Entrega", x + colWidths[5] / 2, y + ROW_H / 2, { align: "center" });
    x += colWidths[5];

    // Assinatura column - draw signature image if available
    const sigX = x;
    if (data.assinaturaColaborador) {
      try {
        doc.addImage(data.assinaturaColaborador, "PNG", sigX + 1, y + 1, colWidths[6] - 2, ROW_H * 0.55);
      } catch (e) { /* ignore */ }
    }
    // Date/time under signature
    doc.setFontSize(5);
    doc.setTextColor(100);
    doc.text(data.dataAssinatura, sigX + colWidths[6] / 2, y + ROW_H - 2, { align: "center" });
    doc.setTextColor(0);

    y += ROW_H;
  });

  // Fill empty rows to minimum
  const minRows = 5;
  for (let i = data.entregas.length; i < minRows; i++) {
    if (y + ROW_H > MAX_Y) break;
    let x = MARGIN;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    for (let j = 0; j < colWidths.length; j++) {
      doc.rect(x, y, colWidths[j], ROW_H, "S");
      x += colWidths[j];
    }
    y += ROW_H;
  }

  // Footer
  drawFooter(doc);

  return doc;
}
