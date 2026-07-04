export type OsStatus = "rascunho" | "emitida" | "arquivada";
export type OsEscopo = "funcionario" | "funcao" | "ghe";

export const OS_STATUS_LABEL: Record<OsStatus, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  arquivada: "Arquivada",
};

export const OS_STATUS_COLOR: Record<OsStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-300",
  emitida: "bg-emerald-100 text-emerald-800 border-emerald-300",
  arquivada: "bg-zinc-100 text-zinc-500 border-zinc-300",
};

export const OS_ESCOPO_LABEL: Record<OsEscopo, string> = {
  funcionario: "Por funcionário",
  funcao: "Por função",
  ghe: "Por GES/GHE",
};

export interface OsRiscoSnapshot {
  grupo: string;
  descricao: string;
  fonte?: string | null;
  exposicao?: string | null;
  lesoes?: string | null;
  limite?: string | null;
}

export interface OsEpiSnapshot {
  nome: string;
  ca?: string | null;
}

export interface OrdemServicoSst {
  id: string;
  empresa_id: string;
  ghe_id: string | null;
  funcao_id: string | null;
  funcionario_id: string | null;
  escopo: OsEscopo;
  titulo: string;
  atividades: string | null;
  riscos_snapshot: OsRiscoSnapshot[];
  epis_snapshot: OsEpiSnapshot[];
  medidas_preventivas: string | null;
  proibicoes: string | null;
  procedimentos_acidente: string | null;
  responsabilidades: string | null;
  responsavel_tecnico_nome: string | null;
  responsavel_tecnico_registro: string | null;
  status: OsStatus;
  versao: number;
  data_emissao: string | null;
  pdf_hash: string | null;
  pdf_drive_view_link: string | null;
  pdf_gerado_em: string | null;
  created_at: string;
  updated_at: string;
}
