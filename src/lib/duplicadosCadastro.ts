/**
 * Cadastros repetidos na estrutura (ambientes, setores, processos, funções, GES).
 *
 * O que originou isto, num PGR real: CORTE, COSTURA e LOJA cadastrados duas
 * vezes; ESCRITORIO e ESCRITÓRIO; SEPARAÇÃO e "SEPARAÇÃO (Cópia)"; e
 * ALMOXARIDADO ao lado de ALMOXARIFADDO. São linhas diferentes no banco, mas o
 * mesmo lugar — e um documento técnico que descreve o mesmo setor duas vezes,
 * com textos diferentes, não se sustenta numa fiscalização.
 *
 * A separação em dois tipos de grupo é o ponto deste arquivo:
 *
 *  - IGUAIS: o mesmo nome depois de tirar acento, caixa, pontuação e o sufixo
 *    "(Cópia)". Não há dúvida nenhuma sobre serem a mesma coisa.
 *  - PARECIDOS: nomes próximos o bastante para merecerem um olhar, como os
 *    dois erros de digitação do almoxarifado. Aqui o sistema NÃO decide — ele
 *    mostra e pergunta. Adivinhar qual nome é o certo é trabalho de quem
 *    conhece a empresa.
 *
 * Nada aqui apaga coisa alguma: estas funções só agrupam. Quem une é a função
 * `sst_unir_cadastro` no banco, chamada depois da escolha de uma pessoa.
 */

export interface ItemCadastro {
  id: string;
  nome?: string | null;
  descricao?: string | null;
  created_at?: string | null;
  [campo: string]: unknown;
}

export type TipoGrupo = "iguais" | "parecidos";

export interface GrupoDuplicado<T extends ItemCadastro = ItemCadastro> {
  tipo: TipoGrupo;
  /** O que o grupo tem em comum, para mostrar na tela. */
  rotulo: string;
  itens: T[];
}

const SUFIXO_COPIA = /\s*\((c[oó]pia|copy)\s*\d*\)\s*$/i;

/** Texto comparável: sem acento, sem pontuação, sem caixa, sem "(Cópia)". */
export function chaveDoNome(nome: string | null | undefined): string {
  return String(nome ?? "")
    .replace(SUFIXO_COPIA, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distância de edição (Levenshtein). Quantas letras separam um nome do outro. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** 1 = idênticos, 0 = nada a ver. */
export function semelhanca(a: string, b: string): number {
  const maior = Math.max(a.length, b.length);
  if (maior === 0) return 1;
  return 1 - distancia(a, b) / maior;
}

/*
 * Onde fica o corte do "parecido".
 *
 * Medido nos nomes reais de uma empresa, que é o único jeito de calibrar isto:
 *
 *   ALMOXARIDADO / ALMOXARIFADDO ... 0,85  — tem de aparecer (dois erros de
 *                                            digitação do mesmo almoxarifado)
 *   COSTURA / COZINHA ............... 0,71  — NÃO pode aparecer (dois setores)
 *   COSTURA / CORTE ................. 0,57  — NÃO pode aparecer
 *
 * 0,80 passa entre os dois casos com folga dos dois lados. Nomes curtos ficam
 * de fora: com quatro letras, uma letra de diferença já dá 0,75 e "LOJA" viraria
 * parecido com "LOJÃO" — e também com "SOJA", se existisse.
 */
export const CORTE_PARECIDO = 0.8;
const MINIMO_LETRAS = 5;

/** Os nomes repetidos, sem margem de dúvida. */
export function agruparIguais<T extends ItemCadastro>(itens: T[]): GrupoDuplicado<T>[] {
  const porChave = new Map<string, T[]>();
  for (const item of itens) {
    const chave = chaveDoNome(item.nome);
    /* Sem nome não há como comparar: fica de fora em vez de virar um grupo
       "vazio" onde cadastros sem relação nenhuma se juntariam. */
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave)!.push(item);
  }
  return [...porChave.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([, lista]) => ({
      tipo: "iguais" as const,
      rotulo: String(lista[0].nome ?? ""),
      itens: lista,
    }));
}

/**
 * Os nomes PARECIDOS, para alguém olhar.
 *
 * Só entram cadastros que não estejam já num grupo de iguais — senão a mesma
 * linha apareceria duas vezes na tela, em dois grupos, e uniria duas vezes.
 */
export function agruparParecidos<T extends ItemCadastro>(itens: T[]): GrupoDuplicado<T>[] {
  const jaAgrupados = new Set(
    agruparIguais(itens).flatMap((g) => g.itens.map((i) => i.id)),
  );
  const restantes = itens.filter((i) => !jaAgrupados.has(i.id) && chaveDoNome(i.nome));

  const grupoDe = new Map<string, number>();
  const grupos: T[][] = [];

  for (let i = 0; i < restantes.length; i++) {
    for (let j = i + 1; j < restantes.length; j++) {
      const a = chaveDoNome(restantes[i].nome);
      const b = chaveDoNome(restantes[j].nome);
      if (a.length < MINIMO_LETRAS || b.length < MINIMO_LETRAS) continue;
      if (semelhanca(a, b) < CORTE_PARECIDO) continue;

      /* Três nomes parecidos entre si formam UM grupo, não três pares. */
      const ga = grupoDe.get(restantes[i].id);
      const gb = grupoDe.get(restantes[j].id);
      if (ga == null && gb == null) {
        grupos.push([restantes[i], restantes[j]]);
        grupoDe.set(restantes[i].id, grupos.length - 1);
        grupoDe.set(restantes[j].id, grupos.length - 1);
      } else if (ga != null && gb == null) {
        grupos[ga].push(restantes[j]);
        grupoDe.set(restantes[j].id, ga);
      } else if (ga == null && gb != null) {
        grupos[gb].push(restantes[i]);
        grupoDe.set(restantes[i].id, gb);
      }
    }
  }

  return grupos.map((lista) => ({
    tipo: "parecidos" as const,
    rotulo: lista.map((i) => String(i.nome ?? "")).join("  ·  "),
    itens: lista,
  }));
}

/** Iguais primeiro — são os que se pode unir sem pensar muito. */
export function duplicadosDoCadastro<T extends ItemCadastro>(itens: T[]): GrupoDuplicado<T>[] {
  return [...agruparIguais(itens), ...agruparParecidos(itens)];
}

/*
 * Campos que não dizem nada sobre o cadastro estar completo: são do sistema,
 * não do preenchimento de quem cadastrou.
 */
const CAMPOS_DO_SISTEMA = new Set([
  "id", "empresa_id", "created_at", "updated_at", "estabelecimento_id",
]);

/** Quantos campos este cadastro tem preenchidos. */
export function camposPreenchidos(item: ItemCadastro): number {
  return Object.entries(item).filter(([campo, valor]) => {
    if (CAMPOS_DO_SISTEMA.has(campo)) return false;
    if (valor == null) return false;
    if (Array.isArray(valor)) return valor.length > 0;
    return String(valor).trim() !== "";
  }).length;
}

/**
 * Qual cadastro o sistema SUGERE manter: o mais completo; empatando, o mais
 * antigo, que é o que os outros módulos provavelmente já apontam.
 *
 * É sugestão. Quem decide é quem está na tela.
 */
export function sugerirPrincipal<T extends ItemCadastro>(itens: T[]): T | undefined {
  return [...itens].sort((a, b) => {
    const diferenca = camposPreenchidos(b) - camposPreenchidos(a);
    if (diferenca !== 0) return diferenca;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  })[0];
}
