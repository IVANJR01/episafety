export type GrauInsalubridade = "nenhum" | "minimo" | "medio" | "maximo";
export type LaudoStatus = "rascunho" | "emitido" | "arquivado";
export type TipoAgenteInsalubridade = "fisico" | "quimico" | "biologico";

export const GRAU_INSALUBRIDADE_LABEL: Record<GrauInsalubridade, string> = {
  nenhum: "Sem enquadramento",
  minimo: "Grau mínimo (10%)",
  medio: "Grau médio (20%)",
  maximo: "Grau máximo (40%)",
};

export const GRAU_INSALUBRIDADE_PERCENTUAL: Record<GrauInsalubridade, number> = {
  nenhum: 0,
  minimo: 10,
  medio: 20,
  maximo: 40,
};

export const TIPO_AGENTE_LABEL: Record<TipoAgenteInsalubridade, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
};

export const STATUS_LAUDO_LABEL: Record<LaudoStatus, string> = {
  rascunho: "Rascunho",
  emitido: "Emitido",
  arquivado: "Arquivado",
};

export const STATUS_LAUDO_COLOR: Record<LaudoStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-300",
  emitido: "bg-emerald-100 text-emerald-800 border-emerald-300",
  arquivado: "bg-zinc-100 text-zinc-500 border-zinc-300",
};

export interface AgenteInsalubridade {
  agente: string;
  tipo: TipoAgenteInsalubridade;
  fonte_geradora?: string;
  tecnica_avaliacao?: string;
  resultado_medicao?: string;
  limite_tolerancia?: string;
  epi_epc_neutraliza: boolean;
  grau: GrauInsalubridade;
}

export interface LaudoInsalubridade {
  id: string;
  empresa_id: string;
  funcionario_id: string | null;
  setor: string | null;
  funcao: string | null;
  titulo: string;
  data_avaliacao: string | null;
  data_emissao: string | null;
  agentes: AgenteInsalubridade[];
  grau_conclusao: GrauInsalubridade;
  percentual_aplicavel: number;
  caracterizado: boolean;
  base_legal: string | null;
  metodologia: string | null;
  fundamentacao: string | null;
  recomendacoes: string | null;
  responsavel_tecnico_nome: string | null;
  responsavel_tecnico_registro: string | null;
  status: LaudoStatus;
  versao: number;
  pdf_gerado_em: string | null;
  created_at: string;
  updated_at: string;
}

export function grauMaisSevero(agentes: AgenteInsalubridade[]): GrauInsalubridade {
  const ordem: GrauInsalubridade[] = ["nenhum", "minimo", "medio", "maximo"];
  let maior: GrauInsalubridade = "nenhum";
  for (const a of agentes) {
    if (ordem.indexOf(a.grau) > ordem.indexOf(maior)) maior = a.grau;
  }
  return maior;
}
