/**
 * A ordem das linhas do inventário de riscos.
 *
 * O pedido é simples de dizer — "GES 01 primeiro, depois 02" — e tem uma
 * armadilha. A tabela mescla as células de Ambiente, Setor e Processo ao longo
 * das linhas de um mesmo setor, e mesclar só funciona em linhas VIZINHAS.
 * Ordenar direto pelo código do GES separa as linhas de um setor que tenha
 * mais de um grupo, e o parágrafo inteiro do ambiente volta a ser reimpresso
 * em cada grupo — defeito que já existiu nesta tela.
 *
 * A saída é ordenar os SETORES pelo menor GES que cada um tem, e só então
 * ordenar por GES dentro do setor. O 01 vem primeiro, o 02 depois, e as linhas
 * de cada setor continuam grudadas.
 */

const texto = (v?: string | null) => (v ?? "").toString().trim();

/** Código do GES como número. Sem código, vai para o fim. */
function numeroDoGes(codigo?: string | null): number {
  const bruto = texto(codigo);
  if (!bruto) return Number.POSITIVE_INFINITY;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export interface LeituraDaLinha<T> {
  /** O que define o bloco mesclado — setor, ambiente e processo juntos. */
  chaveSetor: (linha: T) => string;
  /** Código do GES da linha ("01", "02"…). */
  codigoGes: (linha: T) => string | null | undefined;
  /** Desempate final dentro do mesmo GES (grupo de risco, perigo, id). */
  desempate: (linha: T) => string;
}

export function ordenarInventario<T>(linhas: T[], ler: LeituraDaLinha<T>): T[] {
  const lista = [...(linhas || [])];

  // Menor GES de cada setor: é ele que decide a posição do setor na tabela.
  const menorGes = new Map<string, number>();
  for (const linha of lista) {
    const chave = ler.chaveSetor(linha);
    const n = numeroDoGes(ler.codigoGes(linha));
    const atual = menorGes.get(chave);
    if (atual === undefined || n < atual) menorGes.set(chave, n);
  }

  return lista.sort((a, b) => {
    const ca = ler.chaveSetor(a); const cb = ler.chaveSetor(b);
    if (ca !== cb) {
      const ma = menorGes.get(ca) ?? Number.POSITIVE_INFINITY;
      const mb = menorGes.get(cb) ?? Number.POSITIVE_INFINITY;
      if (ma !== mb) return ma - mb;
      // Mesmo menor GES em setores diferentes: por nome, para a ordem não
      // mudar de uma montagem para outra.
      return ca.localeCompare(cb);
    }
    const ga = numeroDoGes(ler.codigoGes(a)); const gb = numeroDoGes(ler.codigoGes(b));
    if (ga !== gb) return ga - gb;
    return ler.desempate(a).localeCompare(ler.desempate(b));
  });
}
