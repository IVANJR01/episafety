import * as XLSX from "xlsx";
import { formatDate } from "./orcamentoCalc";
import { calcularDescontoAvista, gerarTabelaParcelas, gerarTabelaInfinitepay, INFINITEPAY_LINK_KEY, PagamentoConfig } from "./orcamentoPagamento";

interface OrcamentoExcelData {
  numero_orcamento: string;
  titulo: string;
  status: string;
  data_emissao: string;
  data_validade: string | null;
  cliente_nome?: string | null;
  cliente_cnpj_cpf?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  responsavel_cliente?: string | null;
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
  observacoes?: string | null;
  subtotal: number;
  desconto_tipo?: string | null;
  desconto_valor: number;
  impostos_valor: number;
  taxa_extra: number;
  total: number;
}

interface OrcamentoExcelItem {
  tipo?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  total_item: number;
}

export function exportarOrcamentoExcel(orc: OrcamentoExcelData, itens: OrcamentoExcelItem[]) {
  const wb = XLSX.utils.book_new();

  const proposta: (string | number)[][] = [
    ["Número", orc.numero_orcamento],
    ["Título", orc.titulo],
    ["Status", orc.status],
    ["Data de Emissão", formatDate(orc.data_emissao)],
    ["Validade", formatDate(orc.data_validade)],
    ["Cliente", orc.cliente_nome || ""],
    ["CNPJ/CPF", orc.cliente_cnpj_cpf || ""],
    ["Responsável", orc.responsavel_cliente || ""],
    ["Telefone", orc.cliente_telefone || ""],
    ["E-mail", orc.cliente_email || ""],
    ["Condições de pagamento", (orc.formas_pagamento && orc.formas_pagamento.length ? orc.formas_pagamento.join(" | ") : (orc.condicoes_pagamento || ""))],
    ["Formas de pagamento", (orc.formas_pagamento || []).join(", ")],
  ];

  const pc = orc.pagamento_config || null;
  if (pc) {
    const usaAvista = pc.formas.includes("À vista") || (pc.formas.includes("PIX") && pc.avista.aplica_pix);
    if (usaAvista) {
      const d = calcularDescontoAvista(orc.total, pc.avista.desconto_tipo, pc.avista.desconto_valor);
      proposta.push(
        ["Desconto à vista/PIX", pc.avista.desconto_tipo === "percentual" ? `${pc.avista.desconto_valor}%` : d.desconto],
        ["Valor final à vista/PIX", d.valor_final],
      );
    }
    if (pc.formas.includes("Cartão de crédito")) {
      proposta.push(
        ["Máximo de parcelas", pc.cartao.max_parcelas],
        ["Sem juros até", pc.cartao.parcelas_sem_juros],
        ["Juros mensal (%)", pc.cartao.juros_mensal],
      );
    }
  }

  proposta.push(
    ["Detalhes da condição", orc.condicoes_pagamento_detalhe || ""],
    ["Prazo de execução", orc.prazo_execucao || ""],
    ["Observações", orc.observacoes || ""],
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(proposta), "Proposta");


  const head = [["#", "Tipo", "Descrição", "Unidade", "Quantidade", "Valor Unitário", "Desconto", "Total"]];
  const body = itens.map((it, i) => [
    i + 1,
    it.tipo || "",
    it.descricao,
    it.unidade || "",
    it.quantidade,
    it.valor_unitario,
    it.desconto,
    it.total_item,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, ...body]), "Itens");

  const descontoAplicado =
    orc.desconto_tipo === "percentual"
      ? (orc.subtotal * (orc.desconto_valor || 0)) / 100
      : orc.desconto_valor || 0;
  const resumo = [
    ["Subtotal", orc.subtotal],
    [orc.desconto_tipo === "percentual" ? `Desconto comercial (${orc.desconto_valor}%)` : "Desconto comercial", descontoAplicado],
    ["Impostos", orc.impostos_valor],
    ["Taxa extra", orc.taxa_extra],
    ["Total base da proposta", orc.total],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  if (pc && pc.formas.includes("Cartão de crédito")) {
    // Cartão SEMPRE usa o Total base da proposta (nunca o valor com desconto PIX/à vista).
    const base = orc.total;



    const tabela = gerarTabelaParcelas(base, pc.cartao);
    const parc: (string | number)[][] = [["Parcela", "Taxa (%)", "Valor da parcela", "Total", "Com juros"]];
    for (const p of tabela) parc.push([`${p.n}x`, p.taxa ?? 0, p.valor_parcela, p.total, p.tem_juros ? "Sim" : "Não"]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(parc), "Parcelamento");
  }

  if (pc && pc.infinitepay && pc.formas.includes(INFINITEPAY_LINK_KEY)) {
    const tabInf = gerarTabelaInfinitepay(orc.total, pc.infinitepay);
    const parc: (string | number)[][] = [["Parcela", "Taxa (%)", "Cliente paga", "Valor da parcela", "Você recebe (líquido)"]];
    for (const p of tabInf) parc.push([`${p.n}x`, p.taxa, p.valor_cobrado, p.valor_parcela, p.liquido]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(parc), "Parcelamento InfinitePay");
  }

  XLSX.writeFile(wb, `orcamento-${orc.numero_orcamento}.xlsx`);
}
