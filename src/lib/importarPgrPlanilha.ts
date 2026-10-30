/**
 * Leitura da planilha de Inventário de Riscos.
 *
 * Testada contra a planilha real de um cliente — "Inventário de Risco e
 * Plano de Ação", com 20 colunas (A a T) e este formato:
 *
 *   linha 1   ATUALIZAÇÃO: 02/01/2025 | INVENTÁRIO DE RISCOS OCUPACIONAIS
 *   linha 2   IDENTIFICAÇÃO DE PERIGOS e CLASSIFICAÇÃO DE RISCOS POR GES
 *   linha 4   DESCRIÇÃO DO AMBIENTE | SETOR | GES | FUNÇÃO | PROCESSO |
 *             Agente | Tipo de Agente | Perigo/Fonte | Lesões | Limite |
 *             Intens. | Tipo/Tempo | Técnica | MEDIDAS | — | — |
 *             PROBABILIDADE | SEVERIDADE | TOTAL | CLASSIFICAÇÃO
 *   linha 5   (sub-cabeçalho: EPC | EPI | Atenuação, embaixo de MEDIDAS)
 *   linha 6+  dados, com célula mesclada: setor, GES, função e ambiente
 *             só aparecem na primeira linha do grupo.
 *
 * O que a leitura anterior fazia com essa planilha:
 *
 *   - tomava a LINHA 1 como cabeçalho, porque o título "INVENTÁRIO DE
 *     RISCOS OCUPACIONAIS" contém a palavra "risco" e a linha tem duas
 *     células preenchidas. Daí para baixo, tudo saía errado;
 *   - mesmo apontada para a linha certa, lia o SETOR da coluna
 *     "DESCRIÇÃO DO AMBIENTE", porque procurava por "ambiente" na mesma
 *     lista de termos do setor e a coluna A vem primeiro;
 *   - lia a PROBABILIDADE da coluna "PROCESSO" e a SEVERIDADE da
 *     "DESCRIÇÃO DO AMBIENTE", porque os termos de busca incluíam as
 *     letras soltas "p" e "s", que casam com quase qualquer cabeçalho.
 *     Resultado: probabilidade e severidade caíam no padrão 2 e 2, e a
 *     classificação do risco no sistema era inventada, não importada —
 *     num documento em que ela define a prioridade das ações.
 */

/** Nome de coluna reduzido ao que importa para comparar. */
export function chaveDoCabecalho(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Onde está a linha de cabeçalho.
 *
 * Uma linha só é cabeçalho quando traz VÁRIAS colunas reconhecíveis.
 * Título de planilha tem uma ou duas células e casa por acaso com
 * "risco"; por isso a contagem, e não a presença de um termo.
 */
export function acharCabecalho(linhas: unknown[][], limite = 25): number {
  const TERMOS = [
    "setor", "ges", "ghe", "funcao", "cargo", "ambiente", "processo",
    "agente", "perigo", "fonte", "lesoes", "medidas", "epi",
    "probabilidade", "severidade", "classificacao", "risco",
  ];
  let melhor = -1;
  let melhorPontos = 0;

  for (let i = 0; i < Math.min(linhas.length, limite); i++) {
    const celulas = (linhas[i] || []).map(chaveDoCabecalho).filter(Boolean);
    if (celulas.length < 4) continue;   // título mesclado não é cabeçalho
    const pontos = TERMOS.filter((t) => celulas.some((c) => c.includes(t))).length;
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = i; }
  }
  /* Menos de três colunas reconhecidas não é cabeçalho de inventário. */
  return melhorPontos >= 3 ? melhor : -1;
}

export interface ColunasDoInventario {
  ambiente: number; setor: number; ges: number; funcao: number; processo: number;
  agente: number; tipoAgente: number; perigo: number; lesoes: number;
  limite: number; intensidade: number; exposicao: number; tecnica: number;
  medidas: number; epi: number; atenuacao: number;
  probabilidade: number; severidade: number; total: number; classificacao: number;
}

/**
 * Acha a coluna pelo nome, do mais específico para o mais genérico.
 *
 * Um termo só casa se o cabeçalho COMEÇAR com ele ou for igual a ele —
 * nada de "contém". Era assim que "p" pegava "PROCESSO" e "s" pegava
 * "descrição do ambiente".
 */
function coluna(cabecalhos: string[], termos: string[], usados: Set<number>): number {
  for (const termo of termos) {
    const i = cabecalhos.findIndex(
      (c, idx) => !usados.has(idx) && c && (c === termo || c.startsWith(termo)),
    );
    if (i >= 0) { usados.add(i); return i; }
  }
  return -1;
}

/**
 * Qual coluna é cada coisa.
 *
 * A ordem das chamadas importa: a coluna mais específica se serve
 * primeiro, e não fica disponível para a seguinte. É o que impede
 * "DESCRIÇÃO DO AMBIENTE" de ser tomada como SETOR.
 */
export function resolverColunas(cabecalhoBruto: unknown[]): ColunasDoInventario {
  const c = cabecalhoBruto.map(chaveDoCabecalho);
  const usados = new Set<number>();
  const achar = (termos: string[]) => coluna(c, termos, usados);

  return {
    ambiente: achar(["descricaodoambiente", "descricaoambiente", "ambiente"]),
    setor: achar(["setor", "area", "departamento"]),
    ges: achar(["ges", "ghe", "grupohomogeneo", "grupodeexposicao"]),
    funcao: achar(["funcao", "cargo", "ocupacao"]),
    processo: achar(["processo", "atividade"]),
    agente: achar(["agente"]),
    tipoAgente: achar(["tipodeagente", "tipoagente"]),
    perigo: achar(["perigofonteexposicao", "perigo", "fontedeexposicao", "fontegeradora", "fonte"]),
    lesoes: achar(["possiveislesoes", "lesoes", "agravos", "danos"]),
    limite: achar(["limitedeexposicao", "limite"]),
    intensidade: achar(["intens", "concentracao"]),
    exposicao: achar(["tipotempodeexposicao", "tempodeexposicao", "tipodeexposicao", "exposicao"]),
    tecnica: achar(["tecnicautilizada", "tecnica"]),
    medidas: achar(["medidasdeprevencaoexistente", "medidas", "controles", "prevencao", "epc"]),
    epi: achar(["epi"]),
    atenuacao: achar(["atenuacao", "fatordeprotecao"]),
    probabilidade: achar(["probabilidade", "prob"]),
    severidade: achar(["severidade", "sev", "gravidade"]),
    total: achar(["total", "nivelderisco"]),
    classificacao: achar(["classificacaodorisco", "classificacao"]),
  };
}

export interface ItemDoInventarioImportado {
  setor: string;
  ges_codigo: string;
  funcoes: string[];
  descricao_ambiente: string | null;
  processo: string | null;
  grupo: string;
  tipo_agente: string;
  perigo_descricao: string;
  fonte_geradora: string | null;
  lesoes: string | null;
  limite_tolerancia: string | null;
  intensidade: string | null;
  tipo_exposicao: string | null;
  tecnica_utilizada: string | null;
  controles_existentes: string[];
  epi: string | null;
  atenuacao: string | null;
  probabilidade: number | null;
  severidade: number | null;
  classificacao: string | null;
}

/** "N.A", "-", vazio: o cadastro não tem o dado, e isso não é um valor. */
function texto(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const k = chaveDoCabecalho(s);
  if (k === "na" || k === "nao" || s === "-" || s === "—") return null;
  return s;
}

/**
 * Probabilidade e severidade, como a planilha grava.
 *
 * O Excel guarda 1 como "1.0". Arredondar para inteiro e aceitar só de 1
 * a 5 impede que um texto solto na coluna vire nota de risco.
 */
export function nota(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const inteiro = Math.round(n);
  return inteiro >= 1 && inteiro <= 5 ? inteiro : null;
}

/** O grupo de risco do sistema, a partir do que a planilha escreve. */
export function grupoDoAgente(texto: string): string {
  const s = chaveDoCabecalho(texto);
  if (s.includes("fisic")) return "fisico";
  if (s.includes("quimic")) return "quimico";
  if (s.includes("biolog")) return "biologico";
  if (s.includes("ergonom")) return "ergonomico";
  if (s.includes("acident") || s.includes("mecanic")) return "acidente";
  if (s.includes("psicossoc")) return "psicossocial";
  return "outro";
}

/** O código do GES como a planilha traz: "1.0" vira "01"; "3.1" fica "3.1". */
export function codigoGes(v: unknown): string {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  if (Number.isFinite(n) && Number.isInteger(n)) return String(n).padStart(2, "0");
  return s;
}

/** Funções separadas por vírgula, barra ou quebra de linha. */
export function funcoesDaCelula(v: unknown): string[] {
  return String(v ?? "")
    .split(/[\n;/]+|,(?![^(]*\))/)
    .map((f) => f.trim())
    .filter(Boolean);
}

export interface LeituraDoInventario {
  /** Índice da linha de cabeçalho; -1 quando não foi achada. */
  linhaCabecalho: number;
  colunas: ColunasDoInventario | null;
  itens: ItemDoInventarioImportado[];
}

/**
 * Lê a planilha inteira.
 *
 * Célula mesclada chega vazia nas linhas de baixo: setor, GES, função e
 * ambiente são herdados da última linha que os trouxe. Sem isso, a maior
 * parte do inventário fica sem setor — e um risco sem setor não entra em
 * GES nenhum.
 */
export function lerInventarioDaPlanilha(linhas: unknown[][]): LeituraDoInventario {
  const linhaCabecalho = acharCabecalho(linhas);
  if (linhaCabecalho < 0) return { linhaCabecalho, colunas: null, itens: [] };

  const colunas = resolverColunas(linhas[linhaCabecalho]);

  /*
   * A linha seguinte pode ser sub-cabeçalho (EPC | EPI | Atenuação
   * embaixo de MEDIDAS). Ela não é dado, e as colunas dela entram na
   * resolução — por isso o cabeçalho é a junção das duas.
   */
  const seguinte = (linhas[linhaCabecalho + 1] || []).map(chaveDoCabecalho);
  const ehSubCabecalho = seguinte.some((c) => c === "epi" || c === "epc" || c.includes("atenuacao"));
  let inicio = linhaCabecalho + 1;
  let cols = colunas;
  if (ehSubCabecalho) {
    const juntos = (linhas[linhaCabecalho] || []).map((c, i) => {
      const base = String(c ?? "").trim();
      const sub = String((linhas[linhaCabecalho + 1] || [])[i] ?? "").trim();
      return sub ? (base ? `${base} ${sub}` : sub) : base;
    });
    cols = resolverColunas(juntos);
    inicio = linhaCabecalho + 2;
  }

  const herdado = { setor: "", ges: "", funcao: "", ambiente: "", processo: "", agente: "" };
  const itens: ItemDoInventarioImportado[] = [];

  for (let r = inicio; r < linhas.length; r++) {
    const linha = linhas[r] || [];
    if (linha.every((c) => String(c ?? "").trim() === "")) continue;

    const val = (i: number) => (i >= 0 ? String(linha[i] ?? "").trim() : "");

    const setor = val(cols.setor) || herdado.setor;
    const ges = codigoGes(val(cols.ges)) || herdado.ges;
    const funcao = val(cols.funcao) || herdado.funcao;
    const ambiente = val(cols.ambiente) || herdado.ambiente;
    const processo = val(cols.processo) || herdado.processo;

    const tipoAgente = val(cols.tipoAgente);
    /*
     * "Agente" é mesclado como os outros: o grupo do risco continua
     * valendo nas linhas de baixo do mesmo bloco. Deduzir do tipo de
     * agente colocaria "Postura Inadequada" em "outro", quando a
     * planilha diz Ergonômico duas linhas acima.
     */
    const agente = val(cols.agente) || herdado.agente;
    const perigo = val(cols.perigo);
    const lesoes = val(cols.lesoes);

    /* Linha sem risco nenhum é separador ou sobra de formatação. */
    if (!tipoAgente && !agente && !perigo && !lesoes) continue;

    if (setor) herdado.setor = setor;
    if (ges) herdado.ges = ges;
    if (funcao) herdado.funcao = funcao;
    if (ambiente) herdado.ambiente = ambiente;
    if (processo) herdado.processo = processo;
    if (agente) herdado.agente = agente;

    const medidas = texto(val(cols.medidas));
    const epi = texto(val(cols.epi));

    itens.push({
      setor,
      ges_codigo: ges,
      funcoes: funcoesDaCelula(funcao),
      descricao_ambiente: texto(ambiente),
      processo: texto(processo),
      grupo: grupoDoAgente(agente || tipoAgente),
      tipo_agente: tipoAgente || agente,
      perigo_descricao: perigo || tipoAgente || agente,
      fonte_geradora: texto(perigo),
      lesoes: texto(lesoes),
      limite_tolerancia: texto(val(cols.limite)),
      intensidade: texto(val(cols.intensidade)),
      tipo_exposicao: texto(val(cols.exposicao)),
      tecnica_utilizada: texto(val(cols.tecnica)),
      controles_existentes: medidas ? [medidas] : [],
      epi,
      atenuacao: texto(val(cols.atenuacao)),
      probabilidade: nota(val(cols.probabilidade)),
      severidade: nota(val(cols.severidade)),
      classificacao: texto(val(cols.classificacao)),
    });
  }

  return { linhaCabecalho, colunas: cols, itens };
}
