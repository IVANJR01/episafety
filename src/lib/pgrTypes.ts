export type PgrStatus = "rascunho" | "em_revisao" | "vigente" | "substituido" | "arquivado";

export const PGR_STATUS_LABEL: Record<PgrStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  vigente: "Vigente",
  substituido: "Substituído",
  arquivado: "Arquivado",
};

export const PGR_STATUS_COLOR: Record<PgrStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-300",
  em_revisao: "bg-amber-100 text-amber-800 border-amber-300",
  vigente: "bg-emerald-100 text-emerald-800 border-emerald-300",
  substituido: "bg-zinc-100 text-zinc-600 border-zinc-300",
  arquivado: "bg-zinc-100 text-zinc-500 border-zinc-300",
};

export interface PgrDocumento {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  versao: number;
  status: PgrStatus;
  data_emissao: string | null;
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  responsavel_tecnico_id: string | null;
  resp_tec_nome: string | null;
  resp_tec_registro: string | null;
  metodologia_avaliacao: string | null;
  escopo: string | null;
  observacoes: string | null;
  documento_origem_id: string | null;
  pdf_hash: string | null;
  pdf_drive_view_link: string | null;
  pdf_gerado_em: string | null;
  conteudo_atualizado_em?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PgrRevisao {
  id: string;
  pgr_id: string;
  empresa_id: string;
  versao_anterior: number | null;
  versao_nova: number | null;
  status_anterior: PgrStatus | null;
  status_novo: PgrStatus | null;
  acao: string;
  motivo: string | null;
  user_email: string | null;
  created_at: string;
}

export const PGR_IMMUTABLE_STATUSES: PgrStatus[] = ["vigente", "substituido", "arquivado"];
export const isEditavel = (s: PgrStatus) => !PGR_IMMUTABLE_STATUSES.includes(s);
