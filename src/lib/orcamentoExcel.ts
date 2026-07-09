import * as XLSX from "xlsx";
import { formatDate } from "./orcamentoCalc";

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
    ["Condições de pagamento", orc.condicoes_pagamento || ""],
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
