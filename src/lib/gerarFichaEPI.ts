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

export function gerarFichaEPI(data: FichaData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const drawLine = (y1: number) => {
    doc.setDrawColor(200);
    doc.line(margin, y1, pageWidth - margin, y1);
  };

  // === HEADER ===
  doc.setFillColor(30, 41, 59); // dark slate
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.empresa.nome || "Empresa", margin, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (data.empresa.cnpj) doc.text(`CNPJ: ${data.empresa.cnpj}`, margin, 21);
  if (data.empresa.endereco) doc.text(data.empresa.endereco, margin, 27);

  // Title
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE FORNECIMENTO E REPOSIÇÃO DE EPI", pageWidth - margin, 14, { align: "right" });

  y = 40;
  doc.setTextColor(0, 0, 0);

  // === EMPLOYEE INFO ===
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 28, "F");
  doc.setDrawColor(200);
  doc.rect(margin, y, contentWidth, 28, "S");

  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("NOME DO COLABORADOR", margin + 3, y);
  doc.text("FUNÇÃO / SETOR", margin + contentWidth * 0.55, y);

  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.funcionario.nome, margin + 3, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.funcionario.cargo || "—"} / ${data.funcionario.setor || "—"}`, margin + contentWidth * 0.55, y);

  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("CPF", margin + 3, y);
  doc.text("MATRÍCULA", margin + contentWidth * 0.35, y);
  doc.text("DATA DE ADMISSÃO", margin + contentWidth * 0.65, y);

  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(data.funcionario.cpf || "—", margin + 3, y);
  doc.text(data.funcionario.matricula || "—", margin + contentWidth * 0.35, y);
  doc.text(data.funcionario.data_admissao || "—", margin + contentWidth * 0.65, y);

  y += 10;

  // === DECLARATION ===
  doc.setFontSize(7);
  doc.setTextColor(80);
  const declaracao = `DECLARO ter recebido o(s) Equipamento(s) de Proteção Individual - EPI's abaixo especificado(s) nos termos do artigo 166 e 167 da CLT, com redação dada pela Lei Federal nº 6.514/77, objetivando a proteção da incolumidade física. COMPROMETO-ME a utilizá-los sempre para os fins a que se destinam, estando ciente que o não uso incorrerá contra a minha pessoa em ato faltoso, sujeitando-me as penalidades legais. RESPONSABILIZO-ME por sua guarda, conservação, uso correto, e a devolução ao setor responsável.`;
  const lines = doc.splitTextToSize(declaracao, contentWidth);
  doc.text(lines, margin, y);
  y += lines.length * 3.5 + 5;

  // === TABLE HEADER ===
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  const cols = [
    { label: "DATA ENTREGA", x: margin + 2, w: 25 },
    { label: "QTD", x: margin + 27, w: 12 },
    { label: "CA", x: margin + 39, w: 20 },
    { label: "DISCRIMINAÇÃO DO EPI", x: margin + 59, w: 75 },
    { label: "OBSERVAÇÃO", x: margin + 134, w: 46 },
  ];

  cols.forEach(col => doc.text(col.label, col.x, y + 5.5));
  y += 8;

  // === TABLE ROWS ===
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(8);

  const rowHeight = 7;
  data.entregas.forEach((entrega, i) => {
    if (y + rowHeight > 240) {
      doc.addPage();
      y = margin;
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }
    doc.setDrawColor(230);
    doc.rect(margin, y, contentWidth, rowHeight, "S");

    doc.text(entrega.data || "—", cols[0].x, y + 5);
    doc.text(String(entrega.quantidade), cols[1].x, y + 5);
    doc.text(entrega.epi_ca || "—", cols[2].x, y + 5);
    doc.text(entrega.epi_nome || "—", cols[3].x, y + 5);
    doc.text(entrega.observacao || "—", cols[4].x, y + 5);

    y += rowHeight;
  });

  // Empty rows to fill
  const minRows = 15;
  for (let i = data.entregas.length; i < minRows; i++) {
    if (y + rowHeight > 240) break;
    doc.setDrawColor(230);
    doc.rect(margin, y, contentWidth, rowHeight, "S");
    y += rowHeight;
  }

  y += 8;

  // === SIGNATURES ===
  if (y + 60 > 280) {
    doc.addPage();
    y = margin;
  }

  const sigWidth = contentWidth / 2 - 5;

  // Collaborator signature
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Assinatura do Colaborador", margin, y);
  doc.text("Assinatura do Responsável", margin + sigWidth + 10, y);
  y += 3;

  if (data.assinaturaColaborador) {
    try {
      doc.addImage(data.assinaturaColaborador, "PNG", margin, y, sigWidth, 30);
    } catch (e) { /* ignore */ }
  }
  doc.setDrawColor(150);
  doc.line(margin, y + 32, margin + sigWidth, y + 32);

  if (data.assinaturaResponsavel) {
    try {
      doc.addImage(data.assinaturaResponsavel, "PNG", margin + sigWidth + 10, y, sigWidth, 30);
    } catch (e) { /* ignore */ }
  }
  doc.line(margin + sigWidth + 10, y + 32, pageWidth - margin, y + 32);

  y += 35;
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.funcionario.nome, margin, y);
  doc.text(data.responsavelNome || "—", margin + sigWidth + 10, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(data.funcionario.cargo || "", margin, y);
  doc.text(data.responsavelCargo || "", margin + sigWidth + 10, y);

  y += 5;
  doc.setFontSize(7);
  doc.text(`Assinado em: ${data.dataAssinatura}`, margin, y);
  doc.text(`Assinado em: ${data.dataAssinatura}`, margin + sigWidth + 10, y);

  // === FOOTER ===
  const footerY = 285;
  doc.setDrawColor(200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text("Documento gerado eletronicamente pelo sistema EPI Control. Assinaturas digitais possuem validade conforme legislação vigente.", margin, footerY);
  doc.text(`Código: FICHA-${Date.now().toString(36).toUpperCase()}`, pageWidth - margin, footerY, { align: "right" });

  return doc;
}
