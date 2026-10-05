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
