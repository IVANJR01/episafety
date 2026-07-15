import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBRL, formatDate } from "./orcamentoCalc";
import { STATUS_LABEL, OrcamentoStatus } from "./orcamentoTypes";
import { calcularDescontoAvista, calcularNupay, gerarTabelaParcelas, NUPAY_KEY, PagamentoConfig } from "./orcamentoPagamento";

interface EmpresaHeader {
  nome?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
}

interface OrcamentoPdfData {
  numero_orcamento: string;
  titulo: string;
  status: OrcamentoStatus;
  data_emissao: string;
  data_validade: string | null;
  cliente_nome?: string | null;
  cliente_cnpj_cpf?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  cliente_endereco?: string | null;
  responsavel_cliente?: string | null;
  observacoes?: string | null;
  condicoes_pagamento?: string | null;
  condicoes_pagamento_detalhe?: string | null;
  formas_pagamento?: string[] | null;
  cartao_credito_config?: {
    parcelas: number;
    tipo: "sem_juros" | "com_juros";
    juros_mensal: number;
    valor_parcela: number;
    total_com_juros: number;
  } | null;
  pagamento_config?: PagamentoConfig | null;
  prazo_execucao?: string | null;
  validade_proposta?: string | null;
  subtotal: number;
  desconto_tipo?: string | null;
  desconto_valor: number;
  impostos_valor: number;
  taxa_extra: number;
  total: number;
}

interface OrcamentoItemPdf {
  tipo?: string | null;
  descricao: string;
  detalhe?: string | null;
  unidade?: string | null;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  total_item: number;
}

export function gerarOrcamentoPdf(
  orc: OrcamentoPdfData,
  itens: OrcamentoItemPdf[],
  empresa: EmpresaHeader,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 14;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(empresa.nome || "SafetySoluções", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = [
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : "",
    empresa.telefone ? `Tel: ${empresa.telefone}` : "",
    empresa.email || "",
    empresa.endereco || "",
  ].filter(Boolean);
  linhas.forEach((l) => {
    doc.text(l, marginX, y);
    y += 4;
  });

  // Título proposta (direita)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PROPOSTA COMERCIAL", pageW - marginX, 16, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${orc.numero_orcamento}`, pageW - marginX, 22, { align: "right" });
  doc.text(`Emissão: ${formatDate(orc.data_emissao)}`, pageW - marginX, 27, { align: "right" });
  if (orc.data_validade) doc.text(`Validade: ${formatDate(orc.data_validade)}`, pageW - marginX, 32, { align: "right" });
  doc.text(`Status: ${STATUS_LABEL[orc.status] || orc.status}`, pageW - marginX, 37, { align: "right" });

  y = Math.max(y, 42);
  doc.setDrawColor(220);
  doc.line(marginX, y, pageW - marginX, y);
  y += 6;

  // Cliente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cliente", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const cli = [
    orc.cliente_nome ? `Nome: ${orc.cliente_nome}` : "",
    orc.cliente_cnpj_cpf ? `CNPJ/CPF: ${orc.cliente_cnpj_cpf}` : "",
    orc.responsavel_cliente ? `Responsável: ${orc.responsavel_cliente}` : "",
    orc.cliente_telefone ? `Telefone: ${orc.cliente_telefone}` : "",
    orc.cliente_email ? `E-mail: ${orc.cliente_email}` : "",
    orc.cliente_endereco ? `Endereço: ${orc.cliente_endereco}` : "",
  ].filter(Boolean);
  cli.forEach((l) => {
    doc.text(l, marginX, y);
    y += 4;
  });
  y += 3;

  // Escopo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Escopo da Proposta", marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const tituloWrap = doc.splitTextToSize(orc.titulo || "", pageW - marginX * 2);
  doc.text(tituloWrap, marginX, y);
  y += tituloWrap.length * 5 + 1;
  if (orc.observacoes) {
    doc.setFontSize(9);
    const obs = doc.splitTextToSize(orc.observacoes, pageW - marginX * 2);
    doc.text(obs, marginX, y);
    y += obs.length * 4 + 2;
  }

  // Tabela de itens
  autoTable(doc, {
    startY: y + 2,
    head: [["#", "Descrição", "Un.", "Qtd", "Vl. Unit.", "Desc.", "Total"]],
    body: itens.map((it, i) => [
      String(i + 1),
      it.descricao + (it.detalhe ? `\n${it.detalhe}` : ""),
      it.unidade || "",
      String(it.quantidade),
      formatBRL(it.valor_unitario),
      formatBRL(it.desconto),
      formatBRL(it.total_item),
    ]),
    theme: "striped",
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
    margin: { left: marginX, right: marginX },
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo financeiro
  const boxX = pageW - marginX - 70;
  doc.setDrawColor(220);
  doc.rect(boxX, y, 70, 36);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const drawLine = (label: string, value: string, off: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, boxX + 2, y + off);
    doc.text(value, boxX + 68, y + off, { align: "right" });
  };
  drawLine("Subtotal", formatBRL(orc.subtotal), 6);
  const descLabel = orc.desconto_tipo === "percentual" ? `Desconto comercial (${orc.desconto_valor}%)` : "Desconto comercial";
  drawLine(descLabel, `- ${formatBRL(
    orc.desconto_tipo === "percentual" ? (orc.subtotal * orc.desconto_valor) / 100 : orc.desconto_valor,
  )}`, 12);
  drawLine("Impostos", formatBRL(orc.impostos_valor), 18);
  drawLine("Taxa extra", formatBRL(orc.taxa_extra), 24);
  drawLine("Total base", formatBRL(orc.total), 32, true);


  y += 44;

  // Condições comerciais
  if ((orc.formas_pagamento && orc.formas_pagamento.length) || orc.condicoes_pagamento || orc.prazo_execucao || orc.validade_proposta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Condições de Pagamento", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const formas = orc.formas_pagamento || [];
    const pc = orc.pagamento_config || null;
    const usaAvista = pc && (formas.includes("À vista") || (formas.includes("PIX") && pc.avista.aplica_pix));

    if (formas.length) {
      for (const f of formas) {
        if (f === "Cartão de crédito" && pc) {
          const c = pc.cartao;
          const modo = c.modo || "juros_composto";
          const linhaCartao = modo === "taxa_por_parcela"
            ? `• Cartão de crédito: parcelamento em até ${c.max_parcelas}x conforme tabela de taxas abaixo.`
            : c.parcelas_sem_juros >= c.max_parcelas
              ? `• Cartão de crédito: até ${c.max_parcelas}x sem juros`
              : c.parcelas_sem_juros > 0
                ? `• Cartão de crédito: até ${c.parcelas_sem_juros}x sem juros; de ${c.parcelas_sem_juros + 1}x a ${c.max_parcelas}x com juros de ${c.juros_mensal.toFixed(2)}% a.m.`
                : `• Cartão de crédito: até ${c.max_parcelas}x com juros de ${c.juros_mensal.toFixed(2)}% a.m.`;
          const wrap = doc.splitTextToSize(linhaCartao, pageW - marginX * 2);
          doc.text(wrap, marginX, y); y += wrap.length * 4;
        } else if (f === NUPAY_KEY && pc) {
          const taxa = pc.nupay?.taxa ?? 0;
          const np = calcularNupay(orc.total, taxa);
          doc.text(`• ${f}: ${formatBRL(np.valor_final)} (taxa ${taxa.toFixed(2)}%)`, marginX, y); y += 4;
        } else if ((f === "À vista" || (f === "PIX" && pc?.avista.aplica_pix)) && pc && pc.avista.desconto_valor > 0) {
          const d = calcularDescontoAvista(orc.total, pc.avista.desconto_tipo, pc.avista.desconto_valor);
          const label = pc.avista.desconto_tipo === "percentual" ? `${pc.avista.desconto_valor}%` : formatBRL(pc.avista.desconto_valor);
          doc.text(`• ${f} com ${label} de desconto: ${formatBRL(d.valor_final)}`, marginX, y); y += 4;
        } else {
          doc.text(`• ${f}: ${formatBRL(orc.total)}`, marginX, y); y += 4;
        }
      }
    } else if (orc.condicoes_pagamento) {
      doc.text(`Pagamento: ${orc.condicoes_pagamento}`, marginX, y); y += 4;
    }

    // Cartão SEMPRE usa o Total base da proposta (nunca o valor com desconto PIX/à vista).
    if (pc && formas.includes("Cartão de crédito")) {
      const base = orc.total;

      const modo = pc.cartao.modo || "juros_composto";
      const tabela = gerarTabelaParcelas(base, pc.cartao);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [modo === "taxa_por_parcela" ? ["Parcela", "Taxa", "Valor", "Total", "Juros"] : ["Parcela", "Valor", "Total", "Juros"]],
        body: tabela.map((p) => modo === "taxa_por_parcela"
          ? [`${p.n}x`, `${(p.taxa ?? 0).toFixed(2)}%`, formatBRL(p.valor_parcela), formatBRL(p.total), p.tem_juros ? "com juros" : "sem juros"]
          : [`${p.n}x`, formatBRL(p.valor_parcela), formatBRL(p.total), p.tem_juros ? "com juros" : "sem juros"]),
        theme: "grid",
        headStyles: { fillColor: [234, 88, 12], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: modo === "taxa_por_parcela"
          ? { 0: { cellWidth: 18, halign: "center" }, 1: { cellWidth: 20, halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "left" } }
          : { 0: { cellWidth: 20, halign: "center" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "left" } },
        margin: { left: marginX, right: marginX },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    if (orc.condicoes_pagamento_detalhe) {
      const det = doc.splitTextToSize(`Detalhes: ${orc.condicoes_pagamento_detalhe}`, pageW - marginX * 2);
      doc.text(det, marginX, y); y += det.length * 4;
    }
    if (orc.prazo_execucao) { doc.text(`Prazo de execução: ${orc.prazo_execucao}`, marginX, y); y += 4; }
    if (orc.validade_proposta) { doc.text(`Validade: ${orc.validade_proposta}`, marginX, y); y += 4; }
  }


  // Assinaturas
  const pageH = doc.internal.pageSize.getHeight();
  const sigY = pageH - 30;
  doc.setDrawColor(120);
  doc.line(marginX, sigY, marginX + 70, sigY);
  doc.line(pageW - marginX - 70, sigY, pageW - marginX, sigY);
  doc.setFontSize(8);
  doc.text("Responsável pela proposta", marginX, sigY + 4);
  doc.text("Aprovação do cliente", pageW - marginX, sigY + 4, { align: "right" });

  // Marca d'água rascunho
  if (orc.status === "rascunho") {
    doc.setTextColor(240);
    doc.setFontSize(70);
    doc.setFont("helvetica", "bold");
    doc.text("RASCUNHO", pageW / 2, pageH / 2, { align: "center", angle: 30 });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  }

  // Rodapé + numeração
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `Documento gerado pelo SafetySoluções — Página ${i} de ${pages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  return doc;
}
