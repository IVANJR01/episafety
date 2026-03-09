import jsPDF from "jspdf";

interface EmpresaData {
  nome: string;
  cnpj: string | null;
  logo_url: string | null;
}

interface ParticipanteData {
  nome: string;
  matricula: string | null;
  setor: string | null;
  cargo: string | null;
  assinatura: string | null;
}

interface DDSData {
  empresa: EmpresaData;
  data: string;
  tema: string;
  palestrante: string | null;
  local: string | null;
  duracao: string | null;
  observacao: string | null;
  participantes: ParticipanteData[];
}

const MARGIN = 12;
const PAGE_W = 297; // landscape A4
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function drawHeader(doc: jsPDF, data: DDSData, pageNum: number, totalPages: number): number {
  let y = 10;

  // Page info
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const now = new Date();
  doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, MARGIN, y);
  doc.text(`Pág. ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, y, { align: "right" });

  y = 22;

  // Company name
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.empresa.nome || "EMPRESA", PAGE_W / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(11);
  doc.text("LISTA DE PRESENÇA - DDS", PAGE_W / 2, y, { align: "center" });

  if (data.empresa.cnpj) {
    y += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${data.empresa.cnpj}`, PAGE_W / 2, y, { align: "center" });
  }

  y += 8;

  // Info table - 2 rows of key-value pairs
  const infoRowH = 8;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Row 1: Data | Duração | Palestrante
  const col1W = CONTENT_W * 0.2;
  const col2W = CONTENT_W * 0.2;
  const col3W = CONTENT_W * 0.6;

  doc.setFillColor(230, 230, 230);
  
  // Labels
  let x = MARGIN;
  doc.rect(x, y, col1W, infoRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DATA:", x + 2, y + 5.5);
  
  doc.rect(x + col1W, y, col1W, infoRowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(formatDate(data.data), x + col1W + 2, y + 5.5);

  x = MARGIN + col1W * 2;
  doc.setFillColor(230, 230, 230);
  doc.rect(x, y, col2W, infoRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DURAÇÃO:", x + 2, y + 5.5);

  doc.rect(x + col2W, y, col2W, infoRowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.duracao || "—", x + col2W + 2, y + 5.5);

  x = MARGIN + col1W * 2 + col2W * 2;
  const remainW = CONTENT_W - (col1W * 2 + col2W * 2);
  const labelW = remainW * 0.4;
  const valueW = remainW * 0.6;
  doc.setFillColor(230, 230, 230);
  doc.rect(x, y, labelW, infoRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("PALESTRANTE:", x + 2, y + 5.5);

  doc.rect(x + labelW, y, valueW, infoRowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.palestrante || "—", x + labelW + 2, y + 5.5);

  y += infoRowH;

  // Row 2: Tema (full width)
  doc.setFillColor(230, 230, 230);
  const temaLabelW = col1W;
  doc.rect(MARGIN, y, temaLabelW, infoRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("TEMA:", MARGIN + 2, y + 5.5);

  doc.rect(MARGIN + temaLabelW, y, CONTENT_W - temaLabelW, infoRowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const temaText = doc.splitTextToSize(data.tema, CONTENT_W - temaLabelW - 4);
  doc.text(temaText[0] || "—", MARGIN + temaLabelW + 2, y + 5.5);

  y += infoRowH;

  // Row 3: Local
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, temaLabelW, infoRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("LOCAL:", MARGIN + 2, y + 5.5);

  doc.rect(MARGIN + temaLabelW, y, CONTENT_W - temaLabelW, infoRowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(data.local || "—", MARGIN + temaLabelW + 2, y + 5.5);

  y += infoRowH + 4;

  return y;
}

function drawTableHeader(doc: jsPDF, y: number, colWidths: number[]): number {
  const headers = ["Nº", "MATRÍCULA", "NOME COMPLETO", "SETOR", "ASSINATURA"];

  doc.setFillColor(50, 50, 50);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, 8, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);

  let x = MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + colWidths[i] / 2, y + 5.5, { align: "center" });
    x += colWidths[i];
  }

  doc.setTextColor(0);
  return y + 8;
}

function drawFooter(doc: jsPDF) {
  const footerY = PAGE_H - 10;
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Gerado no sistema EPISafety", PAGE_W / 2, footerY, { align: "center" });
  doc.text("Documento assinado eletronicamente, conforme MP 2.200-2/01, Art. 10º, §2.", PAGE_W / 2, footerY + 3.5, { align: "center" });
}

export function gerarFichaDDS(data: DDSData) {
  const doc = new jsPDF("l", "mm", "a4");

  // Nº(12) + Matrícula(28) + Nome(80) + Setor(50) + Assinatura(103) = 273
  const colWidths = [12, 28, 80, 50, CONTENT_W - 12 - 28 - 80 - 50];
  const ROW_H = 16;
  const MAX_Y = PAGE_H - 20;

  const headerHeight = 85;
  const rowsPerFirstPage = Math.floor((MAX_Y - headerHeight) / ROW_H);
  const rowsPerNextPage = Math.floor((MAX_Y - 50) / ROW_H);

  const totalParticipants = data.participantes.length;
  let totalPages = 1;
  let remaining = totalParticipants - rowsPerFirstPage;
  while (remaining > 0) {
    totalPages++;
    remaining -= rowsPerNextPage;
  }
  totalPages = Math.max(1, totalPages);

  let pageNum = 1;
  let y = drawHeader(doc, data, pageNum, totalPages);
  y = drawTableHeader(doc, y, colWidths);

  data.participantes.forEach((part, idx) => {
    const maxRows = pageNum === 1 ? rowsPerFirstPage : rowsPerNextPage;
    if (y + ROW_H > MAX_Y) {
      drawFooter(doc);
      doc.addPage();
      pageNum++;
      // Simplified header for continuation pages
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(`${data.empresa.nome} — DDS: ${data.tema} — ${formatDate(data.data)}`, MARGIN, 12);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Pág. ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, 12, { align: "right" });
      doc.setTextColor(0);
      y = 18;
      y = drawTableHeader(doc, y, colWidths);
    }

    // Alternate row bg
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H, "F");
    }

    // Draw cell borders
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    let x = MARGIN;
    for (let i = 0; i < colWidths.length; i++) {
      doc.rect(x, y, colWidths[i], ROW_H, "S");
      x += colWidths[i];
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(0);

    x = MARGIN;

    // Nº
    doc.text(String(idx + 1), x + colWidths[0] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[0];

    // Matrícula
    doc.text(part.matricula || "—", x + colWidths[1] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[1];

    // Nome
    doc.setFont("helvetica", "bold");
    let nome = part.nome;
    while (doc.getTextWidth(nome) > colWidths[2] - 4 && nome.length > 3) {
      nome = nome.substring(0, nome.length - 4) + "...";
    }
    doc.text(nome, x + 3, y + ROW_H / 2 + 1);
    x += colWidths[2];

    // Setor
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let setor = part.setor || "—";
    while (doc.getTextWidth(setor) > colWidths[3] - 4 && setor.length > 3) {
      setor = setor.substring(0, setor.length - 4) + "...";
    }
    doc.text(setor, x + colWidths[3] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[3];

    // Assinatura
    if (part.assinatura) {
      try {
        const sigW = colWidths[4] - 6;
        const sigH = ROW_H - 4;
        doc.addImage(part.assinatura, "PNG", x + 3, y + 2, sigW, sigH);
      } catch (e) { /* ignore */ }
    }

    y += ROW_H;
  });

  // Fill empty rows to minimum 10
  const minRows = 10;
  for (let i = data.participantes.length; i < minRows; i++) {
    if (y + ROW_H > MAX_Y) break;

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H, "F");
    }

    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    let x = MARGIN;
    for (let j = 0; j < colWidths.length; j++) {
      doc.rect(x, y, colWidths[j], ROW_H, "S");
      x += colWidths[j];
    }

    // Nº
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(String(i + 1), MARGIN + colWidths[0] / 2, y + ROW_H / 2 + 1, { align: "center" });
    doc.setTextColor(0);

    y += ROW_H;
  }

  // Observação section if present
  if (data.observacao && y + 20 < MAX_Y) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("OBSERVAÇÃO:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const obsLines = doc.splitTextToSize(data.observacao, CONTENT_W - 4);
    doc.text(obsLines, MARGIN, y + 4);
  }

  drawFooter(doc);

  return doc;
}
