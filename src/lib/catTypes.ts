// Tipos do módulo CAT — Comunicação de Acidente de Trabalho
export type CatStatus =
  | "rascunho"
  | "pronto_para_envio"
  | "concluida"
  | "enviada_esocial"
  | "rejeitada_esocial"
  | "cancelada";

export type CatTipo = "inicial" | "reabertura" | "comunicacao_obito";
export type CatTipoAcidente = "tipico" | "trajeto" | "doenca_ocupacional";
export type CatEmitenteTipo =
  | "empregador"
  | "sindicato"
  | "medico"
  | "autoridade"
  | "segurado"
  | "dependente";

export const STATUS_LABEL: Record<CatStatus, string> = {
  rascunho: "Rascunho",
  pronto_para_envio: "Pronto p/ envio",
  concluida: "Concluída",
  enviada_esocial: "Enviada eSocial",
  rejeitada_esocial: "Rejeitada eSocial",
  cancelada: "Cancelada",
};

export const STATUS_COLOR: Record<CatStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pronto_para_envio: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  concluida: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  enviada_esocial: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejeitada_esocial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  cancelada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const TIPO_LABEL: Record<CatTipo, string> = {
  inicial: "Inicial",
  reabertura: "Reabertura",
  comunicacao_obito: "Comunicação de Óbito",
};

export const TIPO_ACIDENTE_LABEL: Record<CatTipoAcidente, string> = {
  tipico: "Típico",
  trajeto: "Trajeto",
  doenca_ocupacional: "Doença Ocupacional",
};

export const EMITENTE_LABEL: Record<CatEmitenteTipo, string> = {
  empregador: "Empregador",
  sindicato: "Sindicato",
  medico: "Médico assistente",
  autoridade: "Autoridade pública",
  segurado: "Segurado / familiar",
  dependente: "Dependente",
};

export const CATEGORIAS_ANEXO = [
  { value: "boletim_ocorrencia", label: "Boletim de Ocorrência" },
  { value: "atestado_medico", label: "Atestado Médico" },
  { value: "aso_relacionado", label: "ASO Relacionado" },
  { value: "foto_local", label: "Foto do Local" },
  { value: "laudo", label: "Laudo" },
  { value: "outros", label: "Outros" },
] as const;

export interface CatRow {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  contrato_id: string | null;
  numero_cat: string | null;
  tipo_cat: CatTipo;
  cat_origem_id: string | null;
  status: CatStatus;
  funcionario_id: string;
  cbo: string | null;
  remuneracao_mensal: number | null;
  jornada_semanal_horas: number | null;
  data_acidente: string;
  hora_acidente: string | null;
  tipo_acidente: CatTipoAcidente;
  houve_afastamento: boolean;
  ultimo_dia_trabalhado: string | null;
  local_acidente: string | null;
  endereco_local: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  pais: string | null;
  obito: boolean;
  data_obito: string | null;
  situacao_geradora_id: string | null;
  agente_causador_id: string | null;
  parte_atingida_id: string | null;
  lateralidade: string | null;
  natureza_lesao_id: string | null;
  cid_codigo: string | null;
  cid_descricao: string | null;
  data_atendimento: string | null;
  hora_atendimento: string | null;
  hospital: string | null;
  medico_id: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
  medico_uf: string | null;
  houve_internacao: boolean | null;
  descricao_lesao: string | null;
  aso_id: string | null;
  exame_id: string | null;
  emitente_tipo: CatEmitenteTipo;
  emitente_nome: string | null;
  emitente_cpf: string | null;
  emitente_cargo: string | null;
  motivo_cancelamento: string | null;
  cancelada_em: string | null;
  concluida_em: string | null;
  pdf_drive_file_id: string | null;
  pdf_gerado_em: string | null;
  esocial_status: string | null;
  esocial_recibo: string | null;
  esocial_protocolo: string | null;
  esocial_enviado_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

/** Devolve descrição do prazo legal de comunicação. */
export function prazoLegal(cat: Pick<CatRow, "data_acidente" | "obito" | "status">) {
  if (cat.status === "concluida" || cat.status === "enviada_esocial" || cat.status === "cancelada") {
    return { critico: false, vencido: false, label: "" };
  }
  const acidente = new Date(cat.data_acidente + "T00:00:00");
  const agora = new Date();
  const horas = (agora.getTime() - acidente.getTime()) / 36e5;
  if (cat.obito) {
    return {
      critico: true,
      vencido: horas > 0,
      label: "Acidente fatal — comunicação IMEDIATA exigida pelo eSocial",
    };
  }
  if (horas > 24) {
    return { critico: true, vencido: true, label: `Prazo de 24h vencido (${Math.floor(horas)}h)` };
  }
  if (horas > 18) {
    return {
      critico: true,
      vencido: false,
      label: `Faltam ${Math.max(0, Math.ceil(24 - horas))}h para o prazo legal`,
    };
  }
  return { critico: false, vencido: false, label: "Dentro do prazo legal de 24h" };
}
