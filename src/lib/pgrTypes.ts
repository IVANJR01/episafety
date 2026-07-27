import type { EnderecoEstruturado } from "@/types/sst";

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

  // Escopo e identificação (Fase 1). Snapshot congelado na emissão: alteração
  // posterior no cadastro da empresa não reescreve um PGR já emitido.
  tipo_pgr?: PgrTipo;
  estabelecimento_id?: string | null;
  cnpj_snapshot?: string | null;
  cno?: string | null;
  cnae_principal?: string | null;
  cnae_secundario?: string[] | null;
  grau_risco?: number | null;
  endereco_snapshot?: EnderecoEstruturado | null;
  qtd_trabalhadores?: number | null;
  jornada_turnos?: string | null;
  contratante_nome?: string | null;
  contratante_cnpj?: string | null;
  contrato_numero?: string | null;
  local_prestacao?: string | null;
  periodo_ref_inicio?: string | null;
  periodo_ref_fim?: string | null;
  data_levantamento?: string | null;
  proxima_revisao?: string | null;
  sgsst_certificado?: boolean;
  sgsst_norma?: string | null;
  sgsst_certificadora?: string | null;
  sgsst_validade?: string | null;
}

export type PgrTipo = "estabelecimento" | "obra" | "frente_contrato";

export const PGR_TIPO_LABEL: Record<PgrTipo, string> = {
  estabelecimento: "Estabelecimento",
  obra: "Obra / Canteiro",
  frente_contrato: "Frente / Contrato",
};

export type PgrResponsavelPapel =
  | "elaborador"
  | "responsavel_tecnico"
  | "revisor_tecnico"
  | "aprovador"
  | "responsavel_organizacao";

export const PGR_PAPEL_LABEL: Record<PgrResponsavelPapel, string> = {
  elaborador: "Elaborador",
  responsavel_tecnico: "Responsável Técnico",
  revisor_tecnico: "Revisor Técnico",
  aprovador: "Aprovador",
  responsavel_organizacao: "Responsável pela Organização",
};

export interface PgrResponsavel {
  id: string;
  pgr_id: string;
  empresa_id: string;
  papel: PgrResponsavelPapel;
  user_id: string | null;
  nome: string;
  cpf: string | null;
  profissao: string | null;
  registro_profissional: string | null;
  uf_registro: string | null;
  numero_art: string | null;
  email: string | null;
  telefone: string | null;
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

/** Estado explícito da avaliação — substitui o sentinela "N.A". */
export type PgrAvaliacaoEstado =
  | "avaliado"
  | "nao_avaliado"
  | "pendente"
  | "nao_aplicavel"
  | "sem_exposicao_identificada"
  | "informacao_nao_disponivel";

export const PGR_AVALIACAO_ESTADO_LABEL: Record<PgrAvaliacaoEstado, string> = {
  avaliado: "Avaliado",
  nao_avaliado: "Não avaliado",
  pendente: "Pendente",
  nao_aplicavel: "Não aplicável",
  sem_exposicao_identificada: "Sem exposição identificada",
  informacao_nao_disponivel: "Informação não disponível",
};

/** Origem da informação do levantamento preliminar (NR-01 1.5.4.3.1). */
export type PgrOrigemLevantamento =
  | "inspecao" | "entrevista" | "participacao_trabalhadores" | "cipa" | "aep"
  | "laudo" | "medicao" | "acidente" | "doenca" | "fispq_fds"
  | "inventario_anterior" | "requisito_legal" | "outro";

export const PGR_ORIGEM_LABEL: Record<PgrOrigemLevantamento, string> = {
  inspecao: "Inspeção",
  entrevista: "Entrevista",
  participacao_trabalhadores: "Participação dos trabalhadores",
  cipa: "CIPA",
  aep: "AEP / AET",
  laudo: "Laudo",
  medicao: "Medição",
  acidente: "Acidente",
  doenca: "Doença relacionada ao trabalho",
  fispq_fds: "FISPQ / FDS",
  inventario_anterior: "Inventário anterior",
  requisito_legal: "Requisito legal",
  outro: "Outro",
};

export type PgrTratamentoPerigo =
  | "tratado_diretamente" | "avaliacao_aprofundada" | "nao_identificado";

/** Hierarquia de medidas de controle (NR-01 1.5.4.4.3), da mais à menos eficaz. */
export type PgrHierarquiaControle =
  | "eliminacao" | "substituicao" | "engenharia_epc" | "administrativa"
  | "treinamento_procedimento" | "epi" | "monitoramento_saude"
  | "preparacao_emergencia";

export const PGR_HIERARQUIA_ORDENADA: PgrHierarquiaControle[] = [
  "eliminacao", "substituicao", "engenharia_epc", "administrativa",
  "treinamento_procedimento", "epi", "monitoramento_saude", "preparacao_emergencia",
];

export const PGR_HIERARQUIA_LABEL: Record<PgrHierarquiaControle, string> = {
  eliminacao: "Eliminação",
  substituicao: "Substituição",
  engenharia_epc: "Proteção coletiva / EPC",
  administrativa: "Medida administrativa",
  treinamento_procedimento: "Treinamento / procedimento",
  epi: "EPI",
  monitoramento_saude: "Monitoramento de saúde",
  preparacao_emergencia: "Preparação para emergência",
};

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

export interface PgrLevantamentoPreliminar {
  id: string;
  pgr_id: string;
  empresa_id: string;
  estabelecimento_id: string | null;
  ambiente_id: string | null;
  setor_id: string | null;
  ges_id: string | null;
  perigo_descricao: string;
  grupo: string | null;
  fonte_circunstancia: string | null;
  origem: PgrOrigemLevantamento;
  origem_detalhe: string | null;
  data_levantamento: string;
  responsavel_nome: string | null;
  responsavel_id: string | null;
  evidencia_descricao: string | null;
  evidencia_url: string | null;
  tratamento: PgrTratamentoPerigo;
  /** Obrigatória (>=5 chars) quando tratamento = 'nao_identificado'. */
  justificativa: string | null;
  perigo_emergente: boolean;
  mudanca_planejada: string | null;
  interacao_contratante: boolean;
  inventario_item_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PgrAvaliacaoMedicao {
  id: string;
  pgr_id: string;
  empresa_id: string;
  inventario_item_id: string;
  tipo_avaliacao: "qualitativa" | "quantitativa" | "semiquantitativa" | "ergonomica";
  data_avaliacao: string | null;
  responsavel_nome: string | null;
  responsavel_registro: string | null;
  ponto_amostragem: string | null;
  tecnica: string | null;
  instrumento: string | null;
  instrumento_certificado: string | null;
  instrumento_calibracao_validade: string | null;
  resultado: number | null;
  /** Obrigatória quando resultado != null — resultado sem unidade não é auditável. */
  unidade: string | null;
  incerteza: number | null;
  limite_valor: string | null;
  limite_fonte: string | null;
  excedente: boolean | null;
  jornada_considerada: string | null;
  parecer_tecnico: string | null;
  laudo_url: string | null;
  validade_ate: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PgrRiscoControle {
  id: string;
  pgr_id: string;
  empresa_id: string;
  inventario_item_id: string;
  hierarquia: PgrHierarquiaControle;
  descricao: string;
  implementado: boolean;
  data_implantacao: string | null;
  eficacia: "nao_avaliada" | "ineficaz" | "parcialmente_eficaz" | "eficaz" | null;
  observacao: string | null;
  epi_ca: string | null;
  epi_validade: string | null;
  epi_periodicidade_troca: string | null;
  epi_fator_protecao: string | null;
  epi_treinamento_realizado: boolean | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * EPI nunca é controle suficiente por si só (NR-01 1.5.4.4.3): a hierarquia
 * exige tentar eliminação, substituição e proteção coletiva antes. Retorna true
 * quando o item só tem medidas de EPI/administrativas, situação que a revisão
 * técnica deve sinalizar.
 */
export function apenasControlesInferiores(controles: PgrRiscoControle[]): boolean {
  if (controles.length === 0) return false;
  const superiores: PgrHierarquiaControle[] = ["eliminacao", "substituicao", "engenharia_epc"];
  return !controles.some((c) => c.implementado && superiores.includes(c.hierarquia));
}
