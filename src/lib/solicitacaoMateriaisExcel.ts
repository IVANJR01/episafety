import * as XLSX from "xlsx";

export interface SolicitacaoXlsxInput {
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
  itens: {
    tipo_item: string;
    nome_item: string;
    ca?: string | null;
    unidade_medida: string;
    quantidade_solicitada: number;
    quantidade_aprovada?: number | null;
    quantidade_comprada?: number | null;
    quantidade_recebida?: number | null;
    justificativa_item?: string | null;
    observacoes?: string | null;
    imagem?: string | null;
  }[];
}

export function exportarSolicitacaoExcel(s: SolicitacaoXlsxInput) {
  const wb = XLSX.utils.book_new();

  const dados = [
    ["Nº Solicitação", s.numero],
    ["Título", s.titulo],
    ["Data da Solicitação", s.data_solicitacao],
    ["Data de Necessidade", s.data_necessidade || ""],
    ["Solicitante", s.solicitante || ""],
    ["Setor", s.setor || ""],
    ["Obra/Local", s.local_obra || ""],
    ["Prioridade", s.prioridade],
    ["Status", s.status],
    ["Justificativa", s.justificativa || ""],
    ["Observações", s.observacoes || ""],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(dados);
  ws1["!cols"] = [{ wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Solicitação");

  const header = [
    "Tipo", "Item", "CA", "Unidade",
    "Qtd Solicitada", "Qtd Aprovada", "Qtd Comprada", "Qtd Recebida",
    "Justificativa", "Observações", "Imagem",
  ];
  const rows = s.itens.map((it) => [
    it.tipo_item, it.nome_item, it.ca || "", it.unidade_medida,
    it.quantidade_solicitada, it.quantidade_aprovada ?? "",
    it.quantidade_comprada ?? "", it.quantidade_recebida ?? "",
    it.justificativa_item || "", it.observacoes || "",
    it.imagem ? "Imagem anexada" : "",
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws2["!cols"] = [
    { wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 30 }, { wch: 30 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Itens");

  XLSX.writeFile(wb, `Solicitacao_${s.numero}.xlsx`);
}
