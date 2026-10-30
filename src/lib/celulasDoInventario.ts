/**
 * O conteúdo de cada célula da planilha de inventário, limpo.
 *
 * Conferido contra a planilha real de um cliente — "Inventário de Risco
 * e Plano de Ação", 20 colunas, 66 riscos. O que estas funções resolvem
 * aparece lá em quase toda linha:
 *
 *   - "N.A" preenche as colunas que não se aplicam. Gravado como texto,
 *     ele vira conteúdo do documento: "Limite de Exposição: N.A";
 *   - o Excel grava a nota de risco como "1.0" e o código do GES como
 *     "3.1". Um é inteiro disfarçado, o outro é subgrupo de verdade;
 *   - "Psicossocial" não é ergonômico: tem grupo próprio na NR-01, e
 *     caía em "outro" quando a lista de grupos não o previa.
 */

/** Nome reduzido ao que importa para comparar. */
export function chaveDaCelula(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * O texto de uma célula, ou null quando ela diz "não se aplica".
 *
 * "N.A", "-" e o travessão são o jeito de a planilha dizer que o campo
 * não vale para aquele risco. Gravá-los faz o documento afirmar "N.A"
 * onde deveria estar em branco.
 */
export function textoDaCelula(valor: unknown): string | null {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const k = chaveDaCelula(s);
  if (k === "na" || k === "nao" || s === "-" || s === "—") return null;
  return s;
}

/**
 * Probabilidade e severidade, de 1 a 5.
 *
 * O Excel guarda 1 como "1.0". Texto solto na coluna não pode virar
 * nota: a nota decide a classificação, e a classificação decide a
 * prioridade das ações.
 */
export function notaDeRisco(valor: unknown): number | null {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const inteiro = Math.round(n);
  return inteiro >= 1 && inteiro <= 5 ? inteiro : null;
}

/** O código do GES: "1.0" vira "01"; "3.1" é subgrupo e fica "3.1". */
export function codigoDoGes(valor: unknown): string {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  if (Number.isFinite(n) && Number.isInteger(n)) return String(n).padStart(2, "0");
  return s;
}

/** O grupo de risco do sistema, a partir do que a planilha escreve. */
export function grupoDoRisco(texto: string): string {
  const s = chaveDaCelula(texto);
  if (s.includes("fisic")) return "fisico";
  if (s.includes("quimic")) return "quimico";
  if (s.includes("biolog")) return "biologico";
  if (s.includes("ergonom")) return "ergonomico";
  if (s.includes("psicossoc")) return "psicossocial";
  if (s.includes("acident") || s.includes("mecanic")) return "acidente";
  return "outro";
}

/** As classes de risco que o sistema guarda. */
export type ClasseDeRisco =
  | "trivial" | "toleravel" | "moderado" | "substancial" | "intoleravel";

/**
 * A classificação escrita na planilha, na forma que o sistema guarda.
 *
 * A planilha traz a palavra do técnico — "TOLERÁVEL", "MODERADO" —, e o
 * banco guarda o apelido sem acento e em minúsculas: "toleravel",
 * "moderado". Gravar a palavra crua deixaria dois valores para a mesma
 * classe, e os filtros e contagens por classe parariam de fechar.
 *
 * Palavra que não é uma das cinco devolve null — e aí quem chama decide
 * calcular pela matriz, em vez de gravar algo que ninguém reconhece.
 */
export function classeDaPlanilha(texto: unknown): ClasseDeRisco | null {
  const s = chaveDaCelula(texto);
  if (!s) return null;
  if (s.startsWith("trivial")) return "trivial";
  if (s.startsWith("toleravel")) return "toleravel";
  if (s.startsWith("moderado")) return "moderado";
  if (s.startsWith("substancial")) return "substancial";
  if (s.startsWith("intoleravel")) return "intoleravel";
  /* "crítico" e "sério" aparecem em planilhas de outras consultorias. */
  if (s.includes("critico") || s.includes("serio")) return "intoleravel";
  return null;
}

/**
 * Colunas que o BANCO calcula e que o insert não pode mandar.
 *
 * `nivel_risco` é coluna gerada (severidade * probabilidade). Mandando
 * valor, o Postgres recusa a gravação inteira — "cannot insert a
 * non-DEFAULT value into column nivel_risco" — e a importação morre
 * depois de ter lido o arquivo todo certo.
 *
 * A tela usa o nível para mostrar e para ordenar; por isso ele é tirado
 * aqui, na hora de gravar, e não lá atrás na leitura.
 */
export const COLUNAS_GERADAS_PELO_BANCO = ["nivel_risco"] as const;

/** O item pronto para gravar, sem as colunas que o banco calcula. */
export function semColunasGeradas<T extends Record<string, unknown>>(item: T): Partial<T> {
  const copia: Record<string, unknown> = { ...item };
  for (const coluna of COLUNAS_GERADAS_PELO_BANCO) delete copia[coluna];
  return copia as Partial<T>;
}
