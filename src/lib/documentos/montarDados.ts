/*
 * De/para: do banco do sistema para o formato dados.json do pacote.
 *
 * O pacote de documentos tem um formato próprio, com nomes de campo em
 * maiúsculas (RAZAO_SOCIAL, CNPJ...) e uma linha por risco. O banco daqui é
 * mais rico: guarda ids, enums e snapshots. Esta função é a tradução entre os
 * dois — e é o único lugar onde essa tradução acontece, de propósito: com
 * duas traduções o PGR em Word e a planilha começariam a divergir.
 *
 * Função pura: recebe as linhas já lidas e devolve o objeto. Assim ela é
 * testável sem banco, e o teste consegue provar cada regra de conversão.
 */
import type { DadosDocumento, InventarioLinha, PlanoLinha } from "./gerarDocx";

/* ------------------------------------------------------------------ */
/* O que entra                                                         */
/* ------------------------------------------------------------------ */

export interface EmpresaRow {
  nome?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cnae_principal?: string | null;
  cnae_secundario?: string[] | null;
  grau_risco?: number | null;
  endereco?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
}

export interface PgrRow {
  versao?: number | null;
  data_emissao?: string | null;
  data_vigencia_inicio?: string | null;
  data_vigencia_fim?: string | null;
  resp_tec_nome?: string | null;
  resp_tec_registro?: string | null;
}

/** Colunas reais de public.pgr_responsaveis. */
export interface ResponsavelRow {
  papel?: string | null;
  nome?: string | null;
  profissao?: string | null;
  registro_profissional?: string | null;
  uf_registro?: string | null;
  numero_art?: string | null;
}

export interface InventarioRow {
  descricao_ambiente?: string | null;
  setor?: string | null;
  /** Vem de sst_ges.codigo — é o número do GES. */
  ges_codigo?: string | null;
  funcoes_snapshot?: string[] | null;
  processo?: string | null;
  grupo?: string | null;
  tipo_agente?: string | null;
  perigo_descricao?: string | null;
  fonte_geradora?: string | null;
  lesoes?: string | null;
  limite_tolerancia?: string | null;
  intensidade?: string | null;
  medicao_valor?: number | null;
  medicao_unidade?: string | null;
  tipo_exposicao?: string | null;
  tempo_exposicao?: string | null;
  tecnica_utilizada?: string | null;
  controles_existentes?: string[] | null;
  epi?: string | null;
  atenuacao?: string | null;
  probabilidade?: number | null;
  severidade?: number | null;
}

export interface AcaoRow {
  what?: string | null;
  descricao?: string | null;
  why?: string | null;
  objetivo?: string | null;
  justificativa?: string | null;
  how?: string | null;
  hierarquia_medida?: string | null;
  where_local?: string | null;
  quanto_texto?: string | null;
  custo_estimado?: number | null;
  prioridade?: number | null;
  meses_execucao?: number[] | null;
  responsavel_nome?: string | null;
  status?: string | null;
  motivo_cancelamento?: string | null;
  forma_acompanhamento?: string | null;
  indicador?: string | null;
  /** Setor e GES vêm do item do inventário ao qual a ação está ligada. */
  setor?: string | null;
  ges_codigo?: string | null;
}

export interface FontesDoDocumento {
  empresa: EmpresaRow;
  pgr: PgrRow;
  responsaveis?: ResponsavelRow[];
  inventario?: InventarioRow[];
  acoes?: AcaoRow[];
  /** Texto do controle de revisões; vem da revisão aberta, quando há uma. */
  descricaoRevisao?: string | null;
}

/* ------------------------------------------------------------------ */
/* Conversões                                                          */
/* ------------------------------------------------------------------ */

/** Vazio e nulo viram "", para o gerador mostrar {{CAMPO}} em vez de inventar. */
const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s;
};

/** 2026-03-15 -> 15/03/2026. Data inválida não vira texto torto: vira "". */
export function dataBr(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

const EXTENSO = ["", "Um", "Dois", "Três", "Quatro"];
/** 2 -> "02 (Dois)", como se escreve o grau de risco da NR-04. */
export function grauRisco(v?: number | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) return "";
  return `${String(n).padStart(2, "0")} (${EXTENSO[n]})`;
}

/*
 * Grupo do perigo -> coluna AGENTE da planilha.
 *
 * A planilha tem cinco agentes (Físico, Químico, Biológico, Ergonômico,
 * Acidente) e o banco tem sete. O psicossocial entra como Ergonômico porque é
 * assim que a NR-01 o trata (item 1.5.3.1.4, fatores de risco psicossociais
 * relacionados ao trabalho, dentro dos fatores ergonômicos) — e é assim que
 * está no inventário de exemplo do pacote, com agente "Ergonômico" e perigo
 * "Psicossocial". O grupo "outro" não tem para onde ir e sai em branco, que é
 * melhor do que ser enquadrado num agente errado.
 */
export const AGENTE_POR_GRUPO: Record<string, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
  psicossocial: "Ergonômico",
  acidente: "Acidente",
  outro: "",
};

/** Tipo de exposição do banco -> rótulo da planilha. */
export const EXPOSICAO_LABEL: Record<string, string> = {
  continua: "Permanente",
  intermitente: "Intermitente",
  eventual: "Eventual",
  nao_aplicavel: "",
};

/*
 * Status da ação -> status da planilha.
 *
 * A planilha tem cinco status; o sistema tem oito. "Bloqueada" e "Cancelada"
 * não têm equivalente, e inventar um seria mentir num documento legal: uma
 * ação bloqueada não é "em andamento" nem "atrasada". Elas saem com o status
 * em branco, e o estado real é escrito por extenso na coluna de
 * acompanhamento — a informação não se perde, só não é falsificada.
 */
export const STATUS_PLANILHA: Record<string, string> = {
  pendente: "PROGRAMADO",
  programada: "PROGRAMADO",
  em_andamento: "EM ANDAMENTO",
  atrasada: "ATRASADO",
  reprogramada: "REPROGRAMADO",
  concluida: "REALIZADO",
  bloqueada: "",
  cancelada: "",
};

/** Prioridade 1 a 5 -> ALTA / MÉDIA / BAIXA. 4 ou mais é crítica no sistema. */
export function prioridadeLabel(v?: number | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (n >= 4) return "ALTA";
  if (n === 3) return "MÉDIA";
  if (n >= 1) return "BAIXA";
  return "";
}

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
/** [3, 4] -> ["MAR", "ABR"]. Mês fora de 1..12 é descartado. */
export function mesesLabel(v?: number[] | null): string[] {
  return (v || []).filter((m) => m >= 1 && m <= 12).map((m) => MESES[m - 1]);
}

/** Nome da empresa vira sufixo de arquivo: "Tecelagem São José" -> "Tecelagem_Sao_Jose". */
export function sufixoArquivo(nome?: string | null): string {
  const s = txt(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "Empresa";
}

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

/*
 * Endereço: o cadastro tem o texto livre `endereco` e também os campos
 * separados. O texto livre ganha, por ser o que a pessoa escreveu; os campos
 * separados só entram quando ele está vazio.
 */
export function enderecoCompleto(e: EmpresaRow): string {
  if (txt(e.endereco)) return txt(e.endereco);
  const partes = [txt(e.logradouro), txt(e.numero), txt(e.complemento)].filter(Boolean);
  return partes.length ? partes.join(", ") : "";
}

/** "CREA 12345" + "/CE" quando a UF do registro está cadastrada. */
export function registroProfissional(r?: ResponsavelRow): string {
  const reg = txt(r?.registro_profissional);
  if (!reg) return "";
  const uf = txt(r?.uf_registro);
  return uf && !reg.toUpperCase().includes(uf.toUpperCase()) ? `${reg}/${uf}` : reg;
}

function papel(responsaveis: ResponsavelRow[] | undefined, ...papeis: string[]) {
  return (responsaveis || []).find((r) => papeis.includes(txt(r.papel)));
}

function linhaInventario(i: InventarioRow): InventarioLinha {
  /* A intensidade pode estar no texto livre ou no valor medido com unidade. */
  const intensidade =
    txt(i.intensidade) ||
    (i.medicao_valor !== null && i.medicao_valor !== undefined
      ? `${i.medicao_valor}${txt(i.medicao_unidade) ? " " + txt(i.medicao_unidade) : ""}`
      : "");

  return {
    ambiente: txt(i.descricao_ambiente),
    setor: txt(i.setor),
    /* A chave chama-se `ghe` por ser o nome no dados.json do pacote; o valor é
       o código do GES, e é "GES" que sai impresso no documento. */
    ghe: txt(i.ges_codigo),
    funcao: (i.funcoes_snapshot || []).filter(Boolean).join(", "),
    processo: txt(i.processo),
    agente: AGENTE_POR_GRUPO[txt(i.grupo)] ?? "",
    perigo: txt(i.perigo_descricao),
    fonte: txt(i.fonte_geradora),
    lesoes: txt(i.lesoes),
    limite: txt(i.limite_tolerancia),
    intensidade,
    /* O tempo de exposição descrito, quando existe, diz mais que o tipo. */
    exposicao: txt(i.tempo_exposicao) || EXPOSICAO_LABEL[txt(i.tipo_exposicao)] || "",
    tecnica: txt(i.tecnica_utilizada),
    medidas: (i.controles_existentes || []).filter(Boolean).join("\n"),
    epi: txt(i.epi),
    atenuacao: txt(i.atenuacao),
    probabilidade: i.probabilidade ?? undefined,
    severidade: i.severidade ?? undefined,
  };
}

function linhaPlano(a: AcaoRow): PlanoLinha {
  const statusBruto = txt(a.status);
  const statusPlanilha = STATUS_PLANILHA[statusBruto] ?? "";
  /* Acompanhamento: a forma, o indicador e — quando o status não coube na
     planilha — o estado real da ação, por extenso. */
  const acompanhamento = [
    txt(a.forma_acompanhamento),
    txt(a.indicador),
    statusBruto && !statusPlanilha
      ? `Ação ${statusBruto === "bloqueada" ? "bloqueada" : "cancelada"}${
          txt(a.motivo_cancelamento) ? ": " + txt(a.motivo_cancelamento) : ""
        }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    setor: txt(a.setor),
    ghe: txt(a.ges_codigo),
    oque: txt(a.what) || txt(a.descricao),
    porque: txt(a.why) || txt(a.objetivo) || txt(a.justificativa),
    como: txt(a.how) || txt(a.hierarquia_medida),
    onde: txt(a.where_local),
    quanto:
      txt(a.quanto_texto) ||
      (a.custo_estimado !== null && a.custo_estimado !== undefined
        ? a.custo_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : ""),
    prioridade: prioridadeLabel(a.prioridade),
    meses: mesesLabel(a.meses_execucao),
    responsavel: txt(a.responsavel_nome),
    status: statusPlanilha,
    afericao: acompanhamento,
  };
}

export function montarDadosDocumento(f: FontesDoDocumento): DadosDocumento {
  const { empresa, pgr } = f;
  const tecnico = papel(f.responsaveis, "responsavel_tecnico", "elaborador");
  const representante = papel(f.responsaveis, "responsavel_organizacao", "aprovador");

  const cidade = txt(empresa.cidade);
  const uf = txt(empresa.uf);
  const emissao = dataBr(pgr.data_emissao);

  return {
    empresa: {
      ARQUIVO: sufixoArquivo(empresa.nome),
      RAZAO_SOCIAL: txt(empresa.nome),
      NOME_FANTASIA: txt(empresa.nome_fantasia),
      CNPJ: txt(empresa.cnpj),
      CNAE_PRINCIPAL: txt(empresa.cnae_principal),
      CNAE_SECUNDARIO: (empresa.cnae_secundario || []).filter(Boolean).join("; "),
      GRAU_RISCO: grauRisco(empresa.grau_risco),
      ENDERECO: enderecoCompleto(empresa),
      BAIRRO: txt(empresa.bairro),
      CIDADE: cidade,
      UF: uf,
      CIDADE_UF: cidade && uf ? `${cidade} – ${uf}` : cidade || "",
      CEP: txt(empresa.cep),
      TELEFONE: txt(empresa.telefone),
      RESPONSAVEL_NOME: txt(tecnico?.nome) || txt(pgr.resp_tec_nome),
      RESPONSAVEL_FORMACAO: txt(tecnico?.profissao),
      RESPONSAVEL_REGISTRO: registroProfissional(tecnico) || txt(pgr.resp_tec_registro),
      VIGENCIA_INICIO: dataBr(pgr.data_vigencia_inicio),
      VIGENCIA_FIM: dataBr(pgr.data_vigencia_fim),
      REVISAO: pgr.versao !== null && pgr.versao !== undefined ? String(pgr.versao).padStart(2, "0") : "",
      DATA_EMISSAO: emissao,
      DESCRICAO_REVISAO: txt(f.descricaoRevisao),
      ANO: emissao ? emissao.slice(-4) : "",
      REPRESENTANTE_EMPRESA: txt(representante?.nome),
    },
    inventario: (f.inventario || []).map(linhaInventario),
    plano: (f.acoes || []).map(linhaPlano),
  };
}
