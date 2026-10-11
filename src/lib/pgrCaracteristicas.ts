/*
 * O que ainda precisa ser dito depois da descrição.
 *
 * Os cadastros de ambiente e de função guardam os campos estruturados (piso,
 * ventilação, pé-direito...) e também um texto livre — e na prática quem
 * preenche escreve os dois dizendo a mesma coisa. No PGR real, cada ambiente
 * saía assim:
 *
 *   Tipo: interno · Pé-direito: 3 m · Piso: Cerâmico · Ventilação: Natural...
 *   Pé-direito: 3 m · Piso cerâmico · Ventilação natural e/ou forçada...
 *
 * Duas vezes o mesmo conteúdo, em catorze ambientes. Aqui o campo só é
 * impresso quando o valor dele NÃO aparece na descrição — nada se perde, e o
 * que sobra é o que a descrição não cobriu.
 */

/** Texto comparável: sem acento, sem pontuação, sem caixa. */
export function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function caracteristicasNaoRepetidas(
  campos: Array<[string, unknown]>,
  descricao?: string | null,
): string[] {
  const desc = normalizar(String(descricao ?? ""));
  return campos
    .filter(([, valor]) => valor != null && String(valor).trim() !== "")
    .filter(([, valor]) => {
      const v = normalizar(String(valor));
      /*
       * Valor de uma letra ou número solto não é comparável: "3" apareceria
       * em qualquer descrição que cite 3 metros, 3 turnos ou 30 pessoas, e o
       * campo sumiria por coincidência.
       */
      if (v.length < 3) return true;
      return !desc.includes(v);
    })
    .map(([rotulo, valor]) => `${rotulo}: ${valor}`);
}

/*
 * Ambientes repetidos no cadastro.
 *
 * NOTA: desde que as seções de estrutura saíram do PDF, nenhum documento
 * chama esta função — a repetição de ambiente deixou de aparecer impressa
 * porque a seção que a mostrava não existe mais. Ela fica porque o problema
 * continua no CADASTRO (um PGR real tinha CORTE, COSTURA e LOJA em
 * duplicata, ALMOXARIDADO/ALMOXARIFADDO e entradas "(Cópia)") e é sobre ela
 * que a tela de limpeza de duplicados será construída. Está coberta por
 * testes; não é código morto esquecido.
 *
 * Um PGR real saiu com CORTE duas vezes, COSTURA duas vezes, LOJA duas vezes,
 * ESCRITORIO e ESCRITÓRIO, SEPARAÇÃO e "SEPARAÇÃO (Cópia)". São linhas
 * distintas no cadastro, mas o mesmo ambiente — e um documento técnico que
 * descreve o mesmo lugar duas vezes, com textos diferentes, não se sustenta
 * numa fiscalização.
 *
 * A junção é conservadora de propósito: só entra o que é o MESMO nome depois
 * de tirar acento, caixa, o sufixo "(Cópia)" e a pontuação. "ALMOXARIDADO" e
 * "ALMOXARIFADDO" são dois erros de digitação diferentes e continuam
 * separados — adivinhar qual é qual é trabalho de quem conhece a empresa, não
 * do gerador de documento.
 *
 * De cada grupo fica a entrada com a descrição mais completa: é a que tem
 * mais informação, e nenhuma informação é descartada sem que a outra a
 * contenha.
 */
const SUFIXO_COPIA = /\s*\((c[oó]pia|copy)\s*\d*\)\s*$/i;

export function chaveDoAmbiente(nome: string | null | undefined): string {
  return normalizar(String(nome ?? "").replace(SUFIXO_COPIA, ""));
}

export function ambientesSemRepeticao<T extends { nome?: string | null; descricao?: string | null }>(
  ambientes: T[],
): T[] {
  const porChave = new Map<string, T>();
  const semNome: T[] = [];

  for (const amb of ambientes) {
    const chave = chaveDoAmbiente(amb.nome);
    /* Ambiente sem nome não tem como ser comparado: sai como veio. */
    if (!chave) {
      semNome.push(amb);
      continue;
    }
    const atual = porChave.get(chave);
    if (!atual) {
      porChave.set(chave, amb);
      continue;
    }
    const tamanho = (x: T) => String(x.descricao ?? "").trim().length;
    if (tamanho(amb) > tamanho(atual)) porChave.set(chave, amb);
  }

  /* A ordem de entrada é preservada: o documento não deve reordenar sozinho. */
  const escolhidos = new Set<T>([...porChave.values(), ...semNome]);
  return ambientes.filter((a) => escolhidos.has(a));
}
