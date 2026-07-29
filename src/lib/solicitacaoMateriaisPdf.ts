import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SolicitacaoPdfItem {
  tipo_item: string;
  nome_item: string;
  descricao?: string | null;
  ca?: string | null;
  unidade_medida: string;
  quantidade_solicitada: number;
  quantidade_aprovada?: number | null;
  justificativa_item?: string | null;
  observacoes?: string | null;
  imagem_dataurl?: string | null;
}

export interface SolicitacaoPdfInput {
  empresa_logo_dataurl?: string | null;
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  empresa_endereco?: string | null;
  empresa_telefone?: string | null;
  unidade_nome?: string | null;
  contrato_nome?: string | null;
  obra_nome?: string | null;
  numero: string;
  titulo: string;
  data_solicitacao: string;
  data_necessidade?: string | null;
  solicitante?: string | null;
  setor?: string | null;
  local_obra?: string | null;
  prioridade: string;
  status: string;
  status_key?: string;
  justificativa?: string | null;
  observacoes?: string | null;
  aprovador?: string | null;
  aprovado_em?: string | null;
  comprada_em?: string | null;
  recebida_em?: string | null;
  nota_fiscal?: string | null;
  itens: SolicitacaoPdfItem[];
}

const fmtDate = (d?: string | null) => {
  if (!d) return "N.A";
  try { return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR"); } catch { return d; }
};
const fmtDateTime = (d?: string | null) => {
  if (!d) return "N.A";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
};
const na = (v?: string | null) => (v && String(v).trim() ? String(v) : "N.A");

export function gerarSolicitacaoPdf(s: SolicitacaoPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 15;
  const isDraft = (s.status_key || "").toLowerCase() === "rascunho";

  const hasLogo = !!s.empresa_logo_dataurl;
  const logoW = 22;
  const logoH = 18;
  const titleX = hasLogo ? M + logoW + 4 : M;

  const drawHeader = () => {
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, W, 22, "F");
    if (hasLogo) {
      // White plate under logo to keep it readable over the orange band
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, 2, logoW, logoH, 1.5, 1.5, "F");
      try {
        doc.addImage(s.empresa_logo_dataurl as string, "PNG", M + 1, 3, logoW - 2, logoH - 2, undefined, "FAST");
      } catch (e) {
        // ignore render failure
      }
    }
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SOLICITAÇÃO DE MATERIAIS DE SEGURANÇA", titleX, 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Nº ${s.numero}   •   ${fmtDate(s.data_solicitacao)}`, titleX, 17);
    // Badge de status
    const statusTxt = (s.status || "N.A").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const badgeW = doc.getTextWidth(statusTxt) + 8;
    const badgeH = 7;
    const badgeX = W - M - badgeW;
    const badgeY = 7;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, "F");
    doc.setTextColor(234, 88, 12);
    doc.text(statusTxt, badgeX + badgeW / 2, badgeY + 5, { align: "center" });
    doc.setTextColor(0);
  };

  const drawWatermark = () => {
    if (!isDraft) return;
    doc.saveGraphicsState?.();
    // @ts-ignore
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
    if (gs) (doc as any).setGState(gs);
    doc.setTextColor(200, 80, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(90);
    doc.text("RASCUNHO", W / 2, H / 2, { align: "center", angle: 35 });
    doc.setTextColor(0);
    doc.restoreGraphicsState?.();
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text("Documento gerado pelo SafetySoluções", M, H - 8);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - M, H - 8, { align: "right" });
    doc.setTextColor(0);
  };

  drawHeader();
  drawWatermark();

  let y = 30;

  // Empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(na(s.empresa_nome), M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const empLine1: string[] = [];
  if (s.empresa_cnpj) empLine1.push(`CNPJ: ${s.empresa_cnpj}`);
  if (s.empresa_telefone) empLine1.push(`Tel: ${s.empresa_telefone}`);
  if (empLine1.length) { doc.text(empLine1.join("   •   "), M, y); y += 4; }
  if (s.empresa_endereco) { doc.text(String(s.empresa_endereco), M, y); y += 4; }
  const orgLine: string[] = [];
  if (s.unidade_nome) orgLine.push(`Unidade: ${s.unidade_nome}`);
  if (s.contrato_nome) orgLine.push(`Contrato: ${s.contrato_nome}`);
  if (s.obra_nome) orgLine.push(`Obra: ${s.obra_nome}`);
  if (orgLine.length) { doc.text(orgLine.join("   •   "), M, y); y += 4; }
  y += 4;

  // Dados da solicitação — duas colunas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Dados da Solicitação", M, y);
  y += 3;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 5;

  const rows: [string, string, string, string][] = [
    ["Título", na(s.titulo), "Solicitante", na(s.solicitante)],
    ["Setor", na(s.setor), "Obra / Local", na(s.local_obra || s.obra_nome)],
    ["Data Solicitação", fmtDate(s.data_solicitacao), "Data Necessidade", fmtDate(s.data_necessidade)],
    ["Prioridade", (s.prioridade || "N.A").toUpperCase(), "Status", (s.status || "N.A").toUpperCase()],
    ["Aprovado por", na(s.aprovador), "Data Aprovação", fmtDateTime(s.aprovado_em)],
    ["Data Compra", fmtDateTime(s.comprada_em), "Data Recebimento", fmtDateTime(s.recebida_em)],
  ];
  const colW = (W - M * 2) / 2;
  const labelW = 32;
  doc.setFontSize(9);
  rows.forEach(([k1, v1, k2, v2]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${k1}:`, M, y);
    doc.text(`${k2}:`, M + colW, y);
    doc.setFont("helvetica", "normal");
    const v1Lines = doc.splitTextToSize(String(v1), colW - labelW - 2);
    const v2Lines = doc.splitTextToSize(String(v2), colW - labelW - 2);
    doc.text(v1Lines, M + labelW, y);
    doc.text(v2Lines, M + colW + labelW, y);
    y += Math.max(v1Lines.length, v2Lines.length) * 4 + 1;
  });

  if (s.justificativa) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Justificativa:", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.justificativa, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 4;
  }
  if (s.observacoes) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(s.observacoes, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 4;
  }

  // Tabela de itens
  //
  // A foto vai numa COLUNA, ao lado do item. Antes havia uma secao "Imagens dos
  // Materiais" no fim do documento, com as fotos numa grade de 3 e rotulos
  // "#1 — nome": quem conferia a solicitacao tinha de ir e voltar entre a
  // tabela e a galeria para saber de que item era cada foto.
  const COL_FOTO = 1;
  const FOTO_BOX = 18; // mm — lado do quadro reservado a imagem

  /** Desenha a imagem dentro do quadro sem distorcer, centralizada. */
  const desenharFoto = (dataUrl: string, x: number, y2: number, box: number) => {
    const props = doc.getImageProperties(dataUrl);
    const escala = Math.min(box / props.width, box / props.height);
    const w = props.width * escala;
    const h = props.height * escala;
    const fmt = /png/i.test(String(props.fileType)) ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, x + (box - w) / 2, y2 + (box - h) / 2, w, h, undefined, "FAST");
  };

  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["#", "Foto", "Tipo", "Item / Descrição", "CA", "Un.", "Qtd", "Aprovada", "Justificativa"]],
    body: s.itens.map((it, i) => {
      const nome = it.nome_item + (it.descricao ? `\n${it.descricao}` : "") + (it.observacoes ? `\nObs: ${it.observacoes}` : "");
      return [
        String(i + 1),
        "", // preenchida em didDrawCell — a celula guarda a imagem, nao texto
        it.tipo_item,
        nome,
        it.ca || "-",
        it.unidade_medida,
        String(it.quantidade_solicitada),
        it.quantidade_aprovada != null ? String(it.quantidade_aprovada) : "Pendente",
        it.justificativa_item || "-",
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 245, 240] },
    // Larguras somam os 180mm uteis do A4 retrato (210 - 2x15 de margem).
    // Antes "Qtd Solic." e "Qtd Aprov." tinham 14mm e quebravam: o cabecalho ia
    // para duas linhas e "Pendente" virava "Penden/te". Os titulos encurtaram e
    // a largura foi para onde o texto precisa.
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },                    // #
      1: { cellWidth: FOTO_BOX + 4, halign: "center" },         // Foto
      2: { cellWidth: 16 },                                     // Tipo
      3: { cellWidth: 50 },                                     // Item / Descrição
      4: { cellWidth: 14, halign: "center" },                   // CA
      5: { cellWidth: 9, halign: "center" },                    // Un.
      6: { cellWidth: 12, halign: "center" },                   // Qtd
      7: { cellWidth: 18, halign: "center" },                   // Aprovada
      8: { cellWidth: "auto" },                                 // Justificativa
    },
    // Reserva altura so nas linhas que tem foto — item sem imagem continua
    // ocupando uma linha baixa.
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== COL_FOTO) return;
      if (s.itens[data.row.index]?.imagem_dataurl) {
        data.cell.styles.minCellHeight = FOTO_BOX + 4;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== COL_FOTO) return;
      const dataUrl = s.itens[data.row.index]?.imagem_dataurl;
      if (!dataUrl) return;
      const x = data.cell.x + (data.cell.width - FOTO_BOX) / 2;
      const y2 = data.cell.y + (data.cell.height - FOTO_BOX) / 2;
      try {
        desenharFoto(String(dataUrl), x, y2, FOTO_BOX);
      } catch {
        // Imagem ilegivel nao pode derrubar o PDF inteiro: marca o lugar.
        doc.setDrawColor(200);
        doc.rect(x, y2, FOTO_BOX, FOTO_BOX);
      }
    },
    margin: { left: M, right: M, top: 28, bottom: 15 },
    rowPageBreak: "avoid",
    showHead: "everyPage",
    didDrawPage: () => {
      // Redraw header + watermark on every page
      drawHeader();
      drawWatermark();
    },
  });

  let yEnd = (doc as any).lastAutoTable?.finalY || y;
  yEnd += 6;

  // Totalizadores
  const totalItens = s.itens.length;
  const totEpi = s.itens.filter((i) => (i.tipo_item || "").toUpperCase() === "EPI").length;
  const totEpc = s.itens.filter((i) => (i.tipo_item || "").toUpperCase() === "EPC").length;
  const totMat = s.itens.filter((i) => /material/i.test(i.tipo_item || "")).length;
  const totFer = s.itens.filter((i) => /ferramenta/i.test(i.tipo_item || "")).length;
  const totOutros = totalItens - totEpi - totEpc - totMat - totFer;
  const totQtd = s.itens.reduce((acc, i) => acc + (Number(i.quantidade_solicitada) || 0), 0);
  const totAprov = s.itens.reduce((acc, i) => acc + (Number(i.quantidade_aprovada) || 0), 0);

  if (yEnd > H - 55) { doc.addPage(); yEnd = 30; drawHeader(); drawWatermark(); }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumo", M, yEnd);
  yEnd += 3;
  doc.setDrawColor(200);
  doc.line(M, yEnd, W - M, yEnd);
  yEnd += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const resumo = [
    `Total de itens: ${totalItens}`,
    `EPIs: ${totEpi}`,
    `EPCs: ${totEpc}`,
    `Materiais de segurança: ${totMat}`,
    `Ferramentas: ${totFer}`,
    `Outros: ${totOutros}`,
    `Qtd. total solicitada: ${totQtd}`,
    `Qtd. total aprovada: ${totAprov}`,
  ];
  const colWidth = (W - M * 2) / 2;
  resumo.forEach((txt, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(txt, M + col * colWidth, yEnd + row * 4.5);
  });
  yEnd += Math.ceil(resumo.length / 2) * 4.5 + 4;

  // A secao "Imagens dos Materiais" saiu daqui: as fotos agora ficam na coluna
  // Foto, ao lado do item a que pertencem. Manter as duas seria a mesma imagem
  // impressa duas vezes, e a galeria do fim nao dizia de que item era cada uma
  // sem consultar o numero na tabela.

  // Assinaturas
  if (yEnd > H - 35) { doc.addPage(); yEnd = 40; drawHeader(); drawWatermark(); }
  yEnd += 10;
  const half = (W - M * 2) / 2;
  doc.setDrawColor(120);
  doc.line(M, yEnd, M + half - 5, yEnd);
  doc.line(M + half + 5, yEnd, W - M, yEnd);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Solicitante", M, yEnd + 5);
  doc.text("Aprovador", M + half + 5, yEnd + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(na(s.solicitante), M, yEnd + 10);
  doc.text(`Data: ${fmtDate(s.data_solicitacao)}`, M, yEnd + 14);
  if (s.aprovador && s.aprovado_em) {
    doc.text(s.aprovador, M + half + 5, yEnd + 10);
    doc.text(`Data: ${fmtDateTime(s.aprovado_em)}`, M + half + 5, yEnd + 14);
  } else {
    doc.setTextColor(150);
    doc.text("Aguardando aprovação", M + half + 5, yEnd + 10);
    doc.setTextColor(0);
  }

  // Rodapé com paginação em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(`Solicitacao_${s.numero}.pdf`);
}
