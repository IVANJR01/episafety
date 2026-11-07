/**
 * As medidas de prevenção que entram no inventário de riscos.
 *
 * O caso real, no PGR da G91: a coluna "MEDIDAS DE PREVENÇÃO EXISTENTE"
 * da planilha é mesclada e se abre em três subcolunas na linha de baixo
 * — "Procedimento Administrativo/ Equipamento", "EPI" e "Atenuação".
 *
 * A leitura juntava o cabeçalho de cima com o de baixo, e a coluna do
 * procedimento virava ".._procedimentoadministrativoequipamento". Como
 * a busca pela coluna de EPI aceita a palavra "equipamento", ela parava
 * nessa mesma coluna — antes de chegar na coluna "EPI" de verdade.
 *
 * Resultado: o MESMO texto entrava duas vezes em cada risco, a segunda
 * com "EPI: " na frente. No inventário do cliente as células ficaram com
 * um parágrafo repetido, do tamanho da tela, e o EPI dizia "Revezamento
 * do posicionamento das atividades" — que não é EPI nenhum.
 *
 * Aqui não há banco, nem IA, nem React: entram as três células, sai a
 * lista de medidas como ela deve ficar gravada.
 */

/**
 * "N.A", "N", "-", vazio: a planilha dizendo "não se aplica".
 *
 * O "N" sozinho aparece em quatro linhas da planilha da G91, na coluna
 * de EPI. É o técnico escrevendo "não" com pressa — nenhum EPI se chama
 * "N". Gravado como está, viraria um EPI de uma letra no inventário.
 */
export function celulaVazia(valor: unknown): boolean {
  const limpo = String(valor ?? "")
    .trim()
    .replace(/\.$/, "")
    .toUpperCase();
  return (
    limpo === "" ||
    limpo === "N" ||
    limpo === "N.A" ||
    limpo === "NA" ||
    limpo === "N/A" ||
    limpo === "-" ||
    limpo === "—"
  );
}

/** Mesmo texto, ignorando caixa, acento, espaço repetido e ponto final. */
function mesmoTexto(a: string, b: string): boolean {
  const limpar = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.;]+$/, "")
      .trim();
  return limpar(a) === limpar(b);
}

export interface CelulasDeMedida {
  /** A coluna "Procedimento Administrativo / EPC / organização do trabalho". */
  procedimento?: unknown;
  /** A coluna "EPI". */
  epi?: unknown;
  /** A coluna "Atenuação / Fator de Proteção". */
  atenuacao?: unknown;
}

/**
 * A lista de medidas existentes, sem repetição e sem "N.A".
 *
 * Devolve lista vazia quando a planilha não traz medida nenhuma: quem
 * chama decide o que escrever no lugar. Inventar aqui um texto genérico
 * esconderia do técnico um risco que está sem controle.
 */
export function medidasExistentes(celulas: CelulasDeMedida): string[] {
  const lista: string[] = [];

  const procedimento = String(celulas.procedimento ?? "").trim();
  const epi = String(celulas.epi ?? "").trim();
  const atenuacao = String(celulas.atenuacao ?? "").trim();

  if (!celulaVazia(procedimento)) lista.push(procedimento);

  /*
   * EPI igual ao procedimento é a coluna errada lida duas vezes, não
   * duas medidas. Gravar os dois é o que inchava a célula.
   */
  if (!celulaVazia(epi) && !mesmoTexto(epi, procedimento)) {
    lista.push(`EPI: ${epi}`);
  }

  if (!celulaVazia(atenuacao) && !mesmoTexto(atenuacao, procedimento) && !mesmoTexto(atenuacao, epi)) {
    lista.push(`Atenuação: ${atenuacao}`);
  }

  return lista;
}

/**
 * O EPI que fica gravado no campo próprio do risco.
 *
 * Vazio quando a célula é "N.A" ou quando repete o procedimento — era
 * assim que "Revezamento do posicionamento das atividades" aparecia
 * como EPI de 50 riscos.
 */
export function epiDoRisco(celulas: CelulasDeMedida): string | null {
  const epi = String(celulas.epi ?? "").trim();
  const procedimento = String(celulas.procedimento ?? "").trim();
  if (celulaVazia(epi)) return null;
  if (mesmoTexto(epi, procedimento)) return null;
  return epi;
}

/**
 * O cabeçalho de uma coluna quando a planilha usa duas linhas de título.
 *
 * Com o título de cima vazio — que é o caso das subcolunas de uma célula
 * mesclada — o cabeçalho é o de baixo, limpo. Colar um "_" na frente
 * fazia "epi" virar "_epi", que não casa exato com "epi", e a busca caía
 * na coluna vizinha que por acaso continha a palavra "equipamento".
 */
export function cabecalhoCombinado(principal: string, sub: string): string {
  const p = (principal || "").trim();
  const s = (sub || "").trim();
  if (!s) return p;
  if (!p) return s;
  if (p === s) return p;
  return `${p}_${s}`;
}
