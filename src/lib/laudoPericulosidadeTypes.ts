export type LaudoStatus = "rascunho" | "emitido" | "arquivado";

export type CategoriaPericulosidade =
  | "energia_eletrica"
  | "inflamaveis_explosivos"
  | "radiacoes_ionizantes"
  | "seguranca_pessoal_patrimonial"
  | "motocicleta"
  | "roubo_violencia_fisica";

export const CATEGORIA_PERICULOSIDADE_LABEL: Record<CategoriaPericulosidade, string> = {
  energia_eletrica: "Energia elétrica (NR-16, Anexo 4)",
  inflamaveis_explosivos: "Inflamáveis / Explosivos (NR-16, Anexos 1 e 2)",
  radiacoes_ionizantes: "Radiações ionizantes / substâncias radioativas (NR-16, Anexo 5)",
  seguranca_pessoal_patrimonial: "Segurança pessoal e patrimonial (NR-16, Anexo 3)",
  motocicleta: "Uso de motocicleta em vias públicas (NR-16, Anexo 5 — Lei 12.997/2014)",
  roubo_violencia_fisica: "Atividades sujeitas a roubo ou violência física (NR-16, Anexo 3)",
};

export const FORMA_EXPOSICAO_LABEL: Record<string, string> = {
  permanente: "Permanente",
  intermitente: "Intermitente",
  eventual: "Eventual",
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

export interface AtividadePericulosa {
  categoria: CategoriaPericulosidade;
  descricao?: string;
  forma_exposicao: "permanente" | "intermitente" | "eventual";
  area_classificada?: string;
}

export interface LaudoPericulosidade {
  id: string;
  empresa_id: string;
  funcionario_id: string | null;
  setor: string | null;
  funcao: string | null;
  titulo: string;
  data_avaliacao: string | null;
  data_emissao: string | null;
  atividades: AtividadePericulosa[];
  caracterizado: boolean;
  percentual_aplicavel: number;
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
