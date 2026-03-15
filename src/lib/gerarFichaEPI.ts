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
  created_at: string;
  quantidade: number;
  epi_nome: string;
  epi_ca: string | null;
  epi_descricao: string | null;
  epi_validade: string | null;
  observacao: string | null;
  tipo: string;
  status: string;
  data_devolucao: string | null;
  assinatura_colaborador: string | null;
}

interface FichaData {
  empresa: EmpresaData;
  funcionario: FuncionarioData;
  entregas: EntregaItem[];
}

const MARGIN = 15;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

const DECLARACAO = `DECLARO ter recebido o(s) Equipamento(s) de Proteção Individual - EPI's., abaixo especificado(s) nos termos do artigo 166 e 167 da CLT, com redação dada pela Lei Federal nº 6.514/77, objetivando a proteção da incolumidade física, bem como a neutralização de possíveis agentes insalubres conforme o art. 191, inciso II, da norma jurídica mencionada, e ainda, o treinamento para o uso correto do(s) mesmo(s). COMPROMETO-ME a utilizá-los sempre para os fins a que se destinam, estando ciente que o não uso incorrerá contra a minha pessoa em ato faltoso, sujeitando-me as penalidades legais. RESPONSABILIZO-ME por sua guarda, conservação, uso correto, e a devolução ao SESMT em qualquer estado que se encontre o equipamento, indenizando a empresa no caso de perda, extravio ou danos por uso incorreto (art. 462, parágrafo 1º, da CLT), e, a comunicação ao superior hierárquico ou Técnico em Segurança do Trabalho caso ocorra qualquer alteração que o torne impróprio para o uso, sendo possível a retirada ou troca de EPI sempre que necessário.`;

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatDateTime(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return formatDate(isoStr);
  }
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

function drawTableHeader(doc: jsPDF, y: number, colWidths: number[]): number {
  const headers = ["Entrega", "Devolução", "Qtde.", "Equipamento", "CA nº", "Motivo", "Assinatura"];

  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, CONTENT_W, 7, "FD");
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(7.5);
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
  doc.text("Gerado no sistema EPISafety", PAGE_W / 2, footerY, { align: "center" });
  doc.text("Documento assinado eletronicamente, conforme MP 2.200-2/01, Art. 10º, §2.", PAGE_W / 2, footerY + 4, { align: "center" });
}

export function gerarFichaEPI(data: FichaData) {
  const doc = new jsPDF("l", "mm", "a4");
  // Landscape A4: 297mm wide, margins 15 each side = 267mm content
  // Entrega(32) + Devolução(24) + Qtde(16) + Equipamento(78) + CA nº(24) + Motivo(33) + Assinatura(60) = 267
  const colWidths = [32, 24, 16, 78, 24, 33, 60];
  const ROW_H = 18;
  const MAX_Y = PAGE_H - 30;

  const headerHeight = 120;
  const rowsPerPage = Math.floor((MAX_Y - headerHeight) / ROW_H);
  const totalPages = Math.max(1, Math.ceil(data.entregas.length / Math.max(1, rowsPerPage)));

  let pageNum = 1;
  let y = drawPageHeader(doc, data, pageNum, totalPages);
  y = drawTableHeader(doc, y, colWidths);

  const tipoLabels: Record<string, string> = { entrega: "Entrega", substituicao: "Substituição", perda: "Perda", dano: "Dano", troca: "Troca", devolucao: "Devolução" };
  const statusLabels: Record<string, string> = { ativo: "Ativo", substituido: "Substituído", devolvido: "Devolvido", perdido: "Perdido", danificado: "Danificado", trocado: "Trocado" };

  data.entregas.forEach((entrega, idx) => {
    if (y + ROW_H > MAX_Y) {
      drawFooter(doc);
      doc.addPage();
      pageNum++;
      y = drawPageHeader(doc, data, pageNum, totalPages);
      y = drawTableHeader(doc, y, colWidths);
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

    // Entrega date+time
    const entregaDateTime = formatDateTime(entrega.created_at);
    const entregaLines = doc.splitTextToSize(entregaDateTime, colWidths[0] - 4);
    doc.text(entregaLines, x + colWidths[0] / 2, y + ROW_H / 2 - (entregaLines.length > 1 ? 2 : 0), { align: "center" });
    x += colWidths[0];

    // Devolução date
    if (entrega.data_devolucao) {
      doc.text(formatDate(entrega.data_devolucao), x + colWidths[1] / 2, y + ROW_H / 2 + 1, { align: "center" });
    }
    x += colWidths[1];

    // Qtde
    doc.text(String(entrega.quantidade), x + colWidths[2] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[2];

    // Equipamento - with proper text clipping
    const eqX = x + 2;
    const eqMaxW = colWidths[3] - 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    // Truncate name if too long
    let epiNome = entrega.epi_nome || "—";
    while (doc.getTextWidth(epiNome) > eqMaxW && epiNome.length > 3) {
      epiNome = epiNome.substring(0, epiNome.length - 4) + "...";
    }
    doc.text(epiNome, eqX, y + 5);
    
    // Description - properly wrapped and limited
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    if (entrega.epi_descricao) {
      const descLines = doc.splitTextToSize(entrega.epi_descricao, eqMaxW);
      doc.text(descLines.slice(0, 2), eqX, y + 9);
    }

    // Validade do C.A.
    doc.setFontSize(5.5);
    doc.setTextColor(80);
    const validadeText = entrega.epi_validade ? `Val. C.A: ${formatDate(entrega.epi_validade)}` : "";
    if (validadeText) {
      doc.text(validadeText, eqX, y + (entrega.epi_descricao ? 14 : 9));
    }
    doc.setTextColor(0);
    x += colWidths[3];

    // CA nº
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(entrega.epi_ca || "—", x + colWidths[4] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[4];

    // Motivo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const motivo = tipoLabels[entrega.tipo] || entrega.tipo;
    doc.text(motivo, x + colWidths[5] / 2, y + ROW_H / 2 + 1, { align: "center" });
    x += colWidths[5];

    // Assinatura - per-row signature
    const sigX = x;
    if (entrega.assinatura_colaborador) {
      if (entrega.assinatura_colaborador === "BIOMETRIA_DIGITAL" || entrega.assinatura_colaborador === "RECONHECIMENTO_FACIAL") {
        const cx = sigX + colWidths[6] / 2;
        const cy = y + ROW_H / 2 - 2;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 100, 0);
        const label = entrega.assinatura_colaborador === "RECONHECIMENTO_FACIAL" ? "REC. FACIAL" : "BIOMETRIA DIGITAL";
        doc.text(label, cx, cy, { align: "center" });
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        const desc = entrega.assinatura_colaborador === "RECONHECIMENTO_FACIAL" 
          ? "Portaria Nº 2.175/2022 - NR-6" 
          : "Impressão digital coletada";
        doc.text(desc, cx, cy + 4, { align: "center" });
        doc.setTextColor(0);
      } else {
        try {
          doc.addImage(entrega.assinatura_colaborador, "PNG", sigX + 2, y + 1, colWidths[6] - 4, ROW_H * 0.55);
        } catch (e) { /* ignore */ }
      }
    }
    // Use individual delivery date+time
    doc.setFontSize(4.5);
    doc.setTextColor(100);
    const sigDateTime = formatDateTime(entrega.created_at);
    doc.text(sigDateTime, sigX + colWidths[6] / 2, y + ROW_H - 2, { align: "center" });
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
