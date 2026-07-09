export type OrcamentoStatus =
  | "rascunho"
  | "enviado"
  | "visualizado"
  | "aprovado"
  | "recusado"
  | "vencido"
  | "cancelado";

export const STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  visualizado: "Visualizado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<OrcamentoStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  visualizado: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  recusado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  vencido: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  cancelado: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const TIPOS_ITEM = [
  { value: "servico", label: "Serviço" },
  { value: "produto", label: "Produto" },
  { value: "treinamento", label: "Treinamento" },
  { value: "documento_sst", label: "Documento SST" },
  { value: "mensalidade", label: "Mensalidade" },
  { value: "outro", label: "Outro" },
] as const;

export const CATEGORIAS_CATALOGO = [
  "Documentos SST",
  "Treinamentos",
  "Consultoria",
  "Serviços de Campo",
  "Mensalidade",
  "Outro",
] as const;

export function isVencido(status: OrcamentoStatus, validade: string | null): boolean {
  if (status === "aprovado" || status === "recusado" || status === "cancelado") return false;
  if (!validade) return false;
  return validade < new Date().toISOString().slice(0, 10);
}
