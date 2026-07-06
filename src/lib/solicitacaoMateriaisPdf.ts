import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SolicitacaoPdfItem {
  tipo_item: string;
  nome_item: string;
  ca?: string | null;
  unidade_medida: string;
  quantidade_solicitada: number;
  quantidade_aprovada?: number | null;
  justificativa_item?: string | null;
  observacoes?: string | null;
}

export interface SolicitacaoPdfInput {
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  numero: string;
  titulo: string;
  data_solicitacao: string;
  data_necessidade?: string | null;
  solicitante?: string | null;
  setor?: string | null;
  local_obra?: string | null;
  prioridade: string;
  status: string;
  justificativa?: string | null;
  observacoes?: string | null;
  aprovador?: string | null;
  itens: SolicitacaoPdfItem[];
}

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  try { return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR"); } catch { return d; }
};

export function gerarSolicitacaoPdf(s: SolicitacaoPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;

  // Header
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SOLICITAÇÃO DE MATERIAIS DE SEGURANÇA", M, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${s.numero}   •   ${fmtDate(s.data_solicitacao)}`, M, 17);

  doc.setTextColor(0);
  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(s.empresa_nome || "Empresa", M, y);
  if (s.empresa_cnpj) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`CNPJ: ${s.empresa_cnpj}`, M, y + 5);
    y += 5;
  }
  y += 8;

  // Dados gerais
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dados da Solicitação", M, y);
  y += 5;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 4;

  const kv: [string, string][] = [
    ["Título", s.titulo],
    ["Solicitante", s.solicitante || "-"],
    ["Setor", s.setor || "-"],
    ["Obra / Local", s.local_obra || "-"],
    ["Data de Necessidade", fmtDate(s.data_necessidade)],
    ["Prioridade", (s.prioridade || "-").toUpperCase()],
    ["Status", (s.status || "-").toUpperCase()],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  kv.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), M + 42, y);
    y += 5;
  });

  if (s.justificativa) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Justificativa:", M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.justificativa, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 4 + 2;
  }

  // Itens
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["#", "Tipo", "Item", "CA", "Un.", "Qtd Solic.", "Qtd Aprov.", "Justificativa"]],
    body: s.itens.map((it, i) => [
      String(i + 1),
      it.tipo_item,
      it.nome_item + (it.observacoes ? `\n${it.observacoes}` : ""),
      it.ca || "-",
      it.unidade_medida,
      String(it.quantidade_solicitada),
      it.quantidade_aprovada != null ? String(it.quantidade_aprovada) : "-",
      it.justificativa_item || "-",
    ]),
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { cellWidth: 16 },
      4: { cellWidth: 10 },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
    },
    margin: { left: M, right: M },
  });

  // Rodapé assinatura
  let yEnd = (doc as any).lastAutoTable?.finalY || y;
  yEnd += 20;
  if (yEnd > 260) { doc.addPage(); yEnd = 40; }
  const half = (W - M * 2) / 2;
  doc.setDrawColor(120);
  doc.line(M, yEnd, M + half - 5, yEnd);
  doc.line(M + half + 5, yEnd, W - M, yEnd);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Assinatura do Solicitante", M, yEnd + 5);
  doc.text("Assinatura do Aprovador", M + half + 5, yEnd + 5);
  if (s.aprovador) doc.text(s.aprovador, M + half + 5, yEnd + 10);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Documento gerado pelo SafetySoluções", M, 290);

  doc.save(`Solicitacao_${s.numero}.pdf`);
}
