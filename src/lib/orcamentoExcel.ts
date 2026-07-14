import * as XLSX from "xlsx";
import { formatDate } from "./orcamentoCalc";
import { calcularDescontoAvista, gerarTabelaParcelas, PagamentoConfig } from "./orcamentoPagamento";

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

  const proposta = [
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
    ["Aceita cartão de crédito", orc.cartao_credito_config ? "Sim" : "Não"],
    ["Parcelas cartão", orc.cartao_credito_config?.parcelas ?? ""],
    ["Tipo de juros", orc.cartao_credito_config ? (orc.cartao_credito_config.tipo === "com_juros" ? "Com juros" : "Sem juros") : ""],
    ["Juros mensal (%)", orc.cartao_credito_config?.juros_mensal ?? ""],
    ["Valor da parcela", orc.cartao_credito_config?.valor_parcela ?? ""],
    ["Total com juros", orc.cartao_credito_config?.total_com_juros ?? ""],
    ["Detalhes da condição", orc.condicoes_pagamento_detalhe || ""],
    ["Prazo de execução", orc.prazo_execucao || ""],
    ["Observações", orc.observacoes || ""],
  ];
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
    [orc.desconto_tipo === "percentual" ? `Desconto (${orc.desconto_valor}%)` : "Desconto", descontoAplicado],
    ["Impostos", orc.impostos_valor],
    ["Taxa extra", orc.taxa_extra],
    ["TOTAL", orc.total],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  XLSX.writeFile(wb, `orcamento-${orc.numero_orcamento}.xlsx`);
}
