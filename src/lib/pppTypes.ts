export type PppStatus = "rascunho" | "em_revisao" | "vigente" | "substituido" | "arquivado";
export type PppMotivoEmissao = "inicial" | "atualizacao" | "correcao" | "demissao";

export const PPP_STATUS_LABEL: Record<PppStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  vigente: "Vigente",
  substituido: "Substituído",
  arquivado: "Arquivado",
};

export const PPP_STATUS_COLOR: Record<PppStatus, string> = {
  rascunho: "bg-gray-100 text-gray-700 border-gray-300",
  em_revisao: "bg-amber-100 text-amber-700 border-amber-300",
  vigente: "bg-emerald-100 text-emerald-700 border-emerald-300",
  substituido: "bg-slate-100 text-slate-700 border-slate-300",
  arquivado: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

export const PPP_MOTIVO_LABEL: Record<PppMotivoEmissao, string> = {
  inicial: "Inicial",
  atualizacao: "Atualização",
  correcao: "Correção",
  demissao: "Demissão / Rescisão",
};

export interface PppDocumento {
  id: string;
  empresa_id: string;
  funcionario_id: string;
  versao: number;
  versao_pai_id: string | null;
  status: PppStatus;
  motivo_emissao: PppMotivoEmissao;
  data_emissao: string | null;
  cbo_consolidado: string | null;
  descricao_atividade_consolidada: string | null;
  observacoes: string | null;
  publicado_em: string | null;
  publicado_por: string | null;
  conteudo_atualizado_em: string;
  created_at: string;
  updated_at: string;
}

export function isPppEditavel(status: PppStatus): boolean {
  return status === "rascunho" || status === "em_revisao";
}
