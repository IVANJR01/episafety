/**
 * De que coluna da planilha sai cada campo do inventário.
 *
 * Esta era a parte mais frágil da importação e a única sem teste: um
 * punhado de listas de palavras, escondidas dentro de um componente de
 * 1.800 linhas, decidindo o destino de cada coluna do PGR. Quando uma
 * delas errava, o erro não aparecia em lugar nenhum — ia direto para o
 * inventário que vai à fiscalização.
 *
 * Dois erros reais saíram daqui, os dois no PGR da G91:
 *
 * - a coluna "EPI" foi confundida com a coluna do procedimento
 *   administrativo, porque o título dela contém a palavra "Equipamento";
 * - o cabeçalho ocupa DUAS linhas na planilha, e a de cima é mesclada:
 *   depois que a leitura preenche as células mescladas, as três
 *   subcolunas passam a ter o mesmo título em cima e só se distinguem
 *   pelo título de baixo.
 *
 * Aqui não há banco, nem IA, nem React: entram as duas linhas de
 * cabeçalho, sai o número da coluna de cada campo.
 */

/** Tira acento, caixa, espaço e pontuação: "Tipo/Tempo" vira "tipotempo". */
export function normalizarChave(str: unknown): string {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Junta o título de cima com o de baixo numa chave só.
 *
 * Quando os dois são iguais — o que acontece em toda coluna cujo título
 * é mesclado verticalmente — vale um. Colar "setor_setor" tirava da
 * coluna a chance de casar exato com "setor".
 */
export function combinarCabecalhos(linhaDeCima: unknown[], linhaDeBaixo: unknown[]): string[] {
  return linhaDeCima.map((cima, col) => {
    const p = normalizarChave(cima);
    const s = normalizarChave(linhaDeBaixo?.[col]);
    if (!s || p === s) return p;
    if (!p) return s;
    return `${p}_${s}`;
  });
}

/**
 * A linha de baixo é subcabeçalho, ou já é dado?
 *
 * Só as palavras que aparecem em subtítulo de verdade contam.
 */
export function pareceSubCabecalho(linha: unknown[]): boolean {
  const texto = (linha || []).map(normalizarChave).join(" ");
  return (
    texto.includes("epc") ||
    texto.includes("epi") ||
    texto.includes("atenuacao") ||
    texto.includes("procedimento")
  );
}

interface Busca {
  /** Termos principais, testados por igualdade, prefixo e depois "contém". */
  termos: string[];
  /** Termos de último recurso, só por "contém". */
  reserva?: string[];
  /** Se a chave contiver qualquer um destes, a coluna é recusada. */
  recusa?: string[];
  /**
   * Sufixo que, sozinho, identifica a coluna num cabeçalho de duas
   * linhas. Vale mais que "contém" — é o que separa a subcoluna "EPI"
   * das irmãs dela, que repetem o mesmo título de cima.
   */
  subtitulo?: string[];
}

/**
 * A ordem importa: o primeiro critério que encontrar alguma coluna manda.
 *
 * Por isso o subtítulo vem antes de "contém": a coluna cujo subtítulo é
 * exatamente "epi" ganha da vizinha que só tem "equipamento" no meio do
 * título.
 */
function procurar(chaves: string[], busca: Busca): number {
  const recusado = (h: string) => (busca.recusa || []).some((e) => h.includes(e));

  let idx = chaves.findIndex((h) => busca.termos.some((t) => h === t));
  if (idx >= 0) return idx;

  if (busca.subtitulo) {
    idx = chaves.findIndex((h) =>
      busca.subtitulo!.some((t) => h.endsWith(`_${t}`) || h === t),
    );
    if (idx >= 0) return idx;
  }

  idx = chaves.findIndex((h) => busca.termos.some((t) => h.startsWith(t)) && !recusado(h));
  if (idx >= 0) return idx;

  idx = chaves.findIndex((h) => busca.termos.some((t) => h.includes(t)) && !recusado(h));
  if (idx >= 0) return idx;

  if (busca.reserva?.length) {
    idx = chaves.findIndex((h) => busca.reserva!.some((t) => h.includes(t)) && !recusado(h));
    if (idx >= 0) return idx;
  }

  return -1;
}

/** Cada campo do inventário e como achar a coluna dele. */
const CAMPOS: Record<string, Busca> = {
  setor: {
    termos: ["setor", "setores", "nomedosetor", "setorarea"],
    reserva: ["area", "departamento", "secao", "posto", "unidade", "localdetrabalho", "postodetrabalho", "local"],
    /* Setor e Ambiente são colunas diferentes e vizinhas; nunca trocar. */
    recusa: ["ambiente", "descricaodoambiente"],
  },
  ambiente: { termos: ["descricaodoambiente", "ambiente"], reserva: ["localizacao", "instalacao"] },
  ges: { termos: ["ges", "ghe", "codigoges", "codigoghe"], reserva: ["grupodeexposicao", "grupo", "homogeneo"] },
  funcao: { termos: ["funcao", "funcoes", "cargo", "cargos"], reserva: ["ocupacao", "trabalhadores", "atividade"] },
  agente: { termos: ["agente", "grupoderisco", "categoria", "natureza"], reserva: ["tipoagente", "tipo"] },
  tipoAgente: { termos: ["tipodeagente", "tipoagente"] },
  perigo: {
    termos: ["perigo", "descricaodoperigo", "fator", "fatorederisco", "fatorrisco"],
    reserva: ["evento", "causa", "situacaoperigosa", "risco"],
  },
  fonte: { termos: ["fonte", "fontegeradora", "circunstancia", "origem"] },
  lesoes: { termos: ["lesoes", "possiveislesoes", "danos", "agravos", "efeito", "consequencia"] },
  medidas: {
    termos: ["medidas", "controles", "prevencao", "epc", "procedimento"],
    subtitulo: ["procedimentoadministrativoequipamentodeprotecaocoletivoorganizacaodotrabalho"],
  },
  /*
   * "equipamento" aparece no título da coluna do PROCEDIMENTO
   * ("Procedimento Administrativo/ Equipamento de Proteção Coletivo"),
   * que vem ANTES da coluna EPI. Sem o subtítulo exato, a busca parava
   * nela e o mesmo texto entrava como medida e como EPI.
   */
  epi: { termos: ["epi"], reserva: ["protecaoindividual"], subtitulo: ["epi"] },
  atenuacao: { termos: ["atenuacao", "fatordeprotecao"], subtitulo: ["atenuacaofatordeprotecao"] },
  probabilidade: { termos: ["probabilidade", "prob"] },
  severidade: { termos: ["severidade", "sev", "gravidade"] },
  processo: { termos: ["processo"], recusa: ["agente", "perigo"] },
  limite: { termos: ["limitedeexposicao", "limite"] },
  intensidade: { termos: ["intens", "concentracao"] },
  exposicao: {
    termos: ["tipotempodeexposicao", "tempodeexposicao", "tipodeexposicao"],
    recusa: ["limite"],
  },
  tecnica: { termos: ["tecnicautilizada", "tecnica"] },
  classificacao: { termos: ["classificacaodorisco", "classificacao"] },
};

export type CampoDaPlanilha = keyof typeof CAMPOS;

/** O número da coluna de cada campo; -1 quando a planilha não traz. */
export function mapearColunas(chaves: string[]): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const [campo, busca] of Object.entries(CAMPOS)) {
    saida[campo] = procurar(chaves, busca);
  }
  return saida;
}

/**
 * Campos que, se a planilha trouxer e a leitura não achar, estragam o
 * inventário em silêncio.
 *
 * Probabilidade e severidade são os piores: sem eles todo risco cai no
 * padrão 2x2 e o inventário inteiro vira "Tolerável", com zero ações.
 */
export const CAMPOS_CRITICOS = [
  "setor",
  "perigo",
  "probabilidade",
  "severidade",
  "classificacao",
] as const;

/** Os campos críticos que a leitura NÃO conseguiu localizar. */
export function camposCriticosPerdidos(colunas: Record<string, number>): string[] {
  return CAMPOS_CRITICOS.filter((c) => (colunas[c] ?? -1) < 0);
}
