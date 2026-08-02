// TYPES — NÚCLEO MESTRE DE DOCUMENTAÇÃO SST

export type TipoAmbiente = "interno" | "externo" | "misto" | "confinado";
export type CaracteristicaAtividade = "rotineira" | "nao_rotineira" | "emergencia";
export type CategoriaPerigo = "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" | "psicossocial" | "periculosidade" | "insalubridade";
export type NivelOrigemRisco = "ges" | "ambiente" | "setor" | "processo" | "funcao" | "individual";
export type TipoExposicaoRisco = "habitual_permanente" | "intermitente" | "eventual";
export type EficaciaEpiConclusao = "nao_avaliada" | "insuficiente" | "parcialmente_eficaz" | "eficaz" | "nao_aplicavel";

export type TipoEstabelecimento = "proprio" | "terceiro" | "obra" | "administrativo";

/** Endereço decomposto — mesmas chaves em empresa_config (colunas) e em
 *  sst_estabelecimentos.endereco / pgr_documentos.endereco_snapshot (jsonb). */
export interface EnderecoEstruturado {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface ResponsavelLegal {
  nome?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
}

export interface SstEstabelecimento {
  id: string;
  empresa_id: string;
  nome: string;
  /** Para tipo='proprio' o id é o MESMO de empresa_config (espelhamento). */
  tipo: TipoEstabelecimento;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  /** Cadastro Nacional de Obras — aplicável a tipo='obra'. */
  cno?: string | null;
  cnae_principal?: string | null;
  cnae_secundario?: string[] | null;
  /** Grau de risco da NR-04: 1 a 4. */
  grau_risco?: number | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: EnderecoEstruturado | null;
  responsavel_legal?: ResponsavelLegal | null;
  qtd_trabalhadores?: number;
  created_at?: string;
  updated_at?: string;
}

/** Monta o endereço em uma linha, com fallback para o texto legado. */
export function formatarEndereco(
  end?: EnderecoEstruturado | null,
  legado?: string | null,
): string {
  if (!end) return legado || "";
  const linha1 = [end.logradouro, end.numero].filter(Boolean).join(", ");
  const partes = [
    [linha1, end.complemento].filter(Boolean).join(" - "),
    end.bairro,
    [end.cidade, end.uf].filter(Boolean).join("/"),
    end.cep,
  ].filter((p) => p && String(p).trim());
  return partes.length > 0 ? partes.join(" · ") : legado || "";
}

export interface SstAmbiente {
  id: string;
  empresa_id: string;
  estabelecimento_id?: string | null;
  nome: string;
  descricao?: string | null;
  tipo_ambiente?: TipoAmbiente;
  pe_direito?: string | null;
  piso?: string | null;
  paredes?: string | null;
  cobertura?: string | null;
  ventilacao?: string | null;
  iluminacao?: string | null;
  climatizacao?: string | null;
  maquinas_instalacoes?: string | null;
  fotos_urls?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SstSetor {
  id: string;
  empresa_id: string;
  ambiente_id?: string | null;
  nome: string;
  descricao?: string | null;
  responsavel_setor?: string | null;
  jornada_turnos?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SstProcesso {
  id: string;
  empresa_id: string;
  setor_id: string;
  nome: string;
  descricao_etapas?: string | null;
  maquinas_equipamentos?: string | null;
  produtos_quimicos?: string | null;
  frequencia?: string | null;
  caracteristica_atividade?: CaracteristicaAtividade;
  created_at?: string;
  updated_at?: string;
}

export interface SstFuncao {
  id: string;
  empresa_id: string;
  setor_id?: string | null;
  processo_id?: string | null;
  nome: string;
  cbo?: string | null;
  descricao_atividades?: string | null;
  atividades_criticas?: string | null;
  requisitos_capacitacao?: string | null;
  exige_nr10?: boolean;
  exige_nr33?: boolean;
  exige_nr35?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SstGes {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  criterio_agrupamento?: string | null;
  validade_inicio: string;
  validade_fim?: string | null;
  responsavel_inspecao?: string | null;
  data_inspecao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SstPerigoCatalogo {
  id: string;
  categoria: CategoriaPerigo;
  nome_agente: string;
  cas_number?: string | null;
  codigo_esocial_tabela24?: string | null;
  possiveis_lesoes?: string | null;
  meio_propagacao?: string | null;
  aplica_pgr?: boolean;
  aplica_pcmso?: boolean;
  aplica_ltcat?: boolean;
  aplica_nr15?: boolean;
  aplica_nr16?: boolean;
  aplica_ppp?: boolean;
  created_at?: string;
}

export interface SstExposicao {
  id: string;
  empresa_id: string;
  nivel_origem: NivelOrigemRisco;
  ges_id?: string | null;
  ambiente_id?: string | null;
  setor_id?: string | null;
  processo_id?: string | null;
  funcao_id?: string | null;
  funcionario_id?: string | null;
  perigo_id?: string | null;
  fonte_geradora: string;
  tipo_exposicao?: TipoExposicaoRisco;
  jornada_exposicao_minutos?: number | null;
  severidade?: number | null;
  probabilidade?: number | null;
  classificacao_risco?: string | null;
  medidas_existentes?: string | null;
  epc_existente?: string | null;
  epc_eficaz?: boolean | null;
  epi_ca_list?: any[];
  epi_eficacia_conclusao?: EficaciaEpiConclusao;
  justificativa_eficacia?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── ATIVIDADES ────────────────────────────────────────────────────────────────

export interface SstAtividade {
  id: string;
  empresa_id: string;
  funcao_id?: string | null;
  processo_id?: string | null;
  setor_id?: string | null;
  ambiente_id?: string | null;
  ges_id?: string | null;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  caracteristica?: CaracteristicaAtividade;
  frequencia?: string | null;
  duracao?: string | null;
  habitualidade?: string | null;
  local_execucao?: string | null;
  maquinas?: string | null;
  ferramentas?: string | null;
  equipamentos?: string | null;
  produtos_utilizados?: string | null;
  postura_esforco?: string | null;
  trabalhadores_envolvidos?: number | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── COLETA DE CAMPO ───────────────────────────────────────────────────────────

export type StatusColetaCampo = "rascunho" | "aguardando_revisao" | "validado" | "descartado";

export const STATUS_COLETA_LABEL: Record<StatusColetaCampo, string> = {
  rascunho: "Rascunho",
  aguardando_revisao: "Aguardando revisão",
  validado: "Validado",
  descartado: "Descartado",
};

export const STATUS_COLETA_COR: Record<StatusColetaCampo, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-300",
  aguardando_revisao: "bg-amber-100 text-amber-800 border-amber-300",
  validado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  descartado: "bg-red-100 text-red-800 border-red-300",
};

export interface SstColetaCampo {
  id: string;
  empresa_id: string;
  pgr_id?: string | null;
  estabelecimento_id?: string | null;
  ambiente_id?: string | null;
  processo_id?: string | null;
  setor_id?: string | null;
  ges_id?: string | null;
  funcao_id?: string | null;
  atividade_id?: string | null;
  contexto_livre?: string | null;
  categoria?: CategoriaPerigo | "outro" | null;
  perigo_observado: string;
  fonte_circunstancia?: string | null;
  situacao_encontrada?: string | null;
  possiveis_lesoes?: string | null;
  exposicao?: string | null;
  qtd_expostos?: number | null;
  grupo_expostos?: string | null;
  medidas_existentes?: string | null;
  observacoes?: string | null;
  coletado_em: string;
  coletado_por?: string | null;
  coletado_por_nome?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: StatusColetaCampo;
  revisado_por?: string | null;
  revisado_em?: string | null;
  revisao_observacao?: string | null;
  inventario_item_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SstColetaEvidencia {
  id: string;
  empresa_id: string;
  coleta_id: string;
  tipo: "foto" | "documento" | "audio" | "outro";
  url: string;
  nome_arquivo?: string | null;
  descricao?: string | null;
  created_at?: string;
}
