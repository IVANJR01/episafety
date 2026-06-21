export type LtcatStatus = "rascunho" | "em_revisao" | "vigente" | "substituido" | "arquivado";

export type LtcatMotivoEmissao =
  | "inicial"
  | "revisao_periodica"
  | "mudanca_ambiental"
  | "correcao";

export const LTCAT_STATUS_LABEL: Record<LtcatStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  vigente: "Vigente",
  substituido: "Substituído",
  arquivado: "Arquivado",
};

export const LTCAT_STATUS_COLOR: Record<LtcatStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-300",
  em_revisao: "bg-amber-100 text-amber-800 border-amber-300",
  vigente: "bg-emerald-100 text-emerald-800 border-emerald-300",
  substituido: "bg-zinc-100 text-zinc-600 border-zinc-300",
  arquivado: "bg-zinc-100 text-zinc-500 border-zinc-300",
};

export const LTCAT_MOTIVO_LABEL: Record<LtcatMotivoEmissao, string> = {
  inicial: "Inicial",
  revisao_periodica: "Revisão periódica",
  mudanca_ambiental: "Mudança ambiental",
  correcao: "Correção técnica",
};

export interface LtcatDocumento {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  pgr_id: string | null;
  versao: number;
  versao_pai_id: string | null;
  status: LtcatStatus;
  motivo_emissao: LtcatMotivoEmissao;
  data_emissao: string | null;
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  cnae: string | null;
  grau_risco: number | null;
  escopo: string | null;
  metodologia_geral: string | null;
  observacoes: string | null;
  publicado_em: string | null;
  publicado_por: string | null;
  conteudo_atualizado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface LtcatRevisao {
  id: string;
  ltcat_id: string;
  empresa_id: string;
  versao_anterior: number | null;
  versao_nova: number | null;
  motivo: string;
  status_anterior: LtcatStatus | null;
  status_novo: LtcatStatus | null;
  user_email: string | null;
  created_at: string;
}

export interface LtcatResponsavelTecnico {
  id: string;
  ltcat_id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  profissao: string;
  registro_profissional: string;
  uf_registro: string | null;
  numero_art: string | null;
  email: string | null;
  telefone: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export const LTCAT_IMMUTABLE_STATUSES: LtcatStatus[] = ["vigente", "substituido", "arquivado"];
export const isLtcatEditavel = (s: LtcatStatus) => !LTCAT_IMMUTABLE_STATUSES.includes(s);
