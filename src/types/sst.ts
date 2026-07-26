// TYPES — NÚCLEO MESTRE DE DOCUMENTAÇÃO SST

export type TipoAmbiente = "interno" | "externo" | "misto" | "confinado";
export type CaracteristicaAtividade = "rotineira" | "nao_rotineira" | "emergencia";
export type CategoriaPerigo = "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente" | "psicossocial" | "periculosidade" | "insalubridade";
export type NivelOrigemRisco = "ges" | "ambiente" | "setor" | "processo" | "funcao" | "individual";
export type TipoExposicaoRisco = "habitual_permanente" | "intermitente" | "eventual";
export type EficaciaEpiConclusao = "nao_avaliada" | "insuficiente" | "parcialmente_eficaz" | "eficaz" | "nao_aplicavel";

export interface SstEstabelecimento {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: "proprio" | "terceiro" | "obra" | "administrativo";
  cnpj?: string | null;
  cno?: string | null;
  cnae_principal?: string | null;
  grau_risco?: number | null;
  endereco?: Record<string, any> | null;
  responsavel_legal?: Record<string, any> | null;
  qtd_trabalhadores?: number;
  created_at?: string;
  updated_at?: string;
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

export interface SstGesVinculo {
  id: string;
  empresa_id: string;
  ges_id: string;
  ambiente_id?: string | null;
  setor_id?: string | null;
  processo_id?: string | null;
  funcao_id?: string | null;
  funcionario_id?: string | null;
  created_at?: string;
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
