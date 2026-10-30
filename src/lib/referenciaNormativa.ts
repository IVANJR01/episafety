/**
 * A referência normativa de um apontamento, quebrada em partes.
 *
 * O campo guarda texto livre, e a IA escreve linhas inteiras:
 *
 *   NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes
 *   vivas inacessíveis e protegidas.
 *   IT-16/CE — Item 5.1.1 — Plano de emergência contra incêndio e pânico.
 *
 * Três dessas linhas ocupam mais espaço no cartão do que a própria
 * situação detectada e a ação corretiva — que é o que a pessoa precisa
 * ler. Quem percorre a lista procura a norma pelo código; a frase
 * explicativa só interessa quando ele para naquele item.
 *
 * Aqui o texto vira peças: a norma, o item e a descrição. A tela mostra
 * código e item, e guarda a descrição para quem pedir.
 *
 * O texto original nunca se perde: ele continua no banco e volta inteiro
 * em `textoCompleto`, porque é ele que vai para o relatório em PDF.
 */

export interface ReferenciaNormativa {
  /** "NR-18", "IT-16/CE", "NBR 5410". */
  norma: string;
  /** "18.6.10", ou vazio quando a linha não traz item. */
  item: string;
  /** A frase explicativa, ou vazio. */
  descricao: string;
  /** A linha como foi gravada. */
  textoCompleto: string;
}

/* O travessão que a IA usa, o hífen comum e o "–" meio-termo. */
const SEPARADOR = /\s+[—–-]\s+/;

/**
 * Quebra o texto do campo em uma referência por linha.
 *
 * Linha que não segue o formato não é descartada nem adivinhada: vira
 * uma referência só com `norma`, e a tela mostra o que está escrito. Em
 * documento de fiscalização, texto que some é pior que texto feio.
 */
export function referenciasNormativas(texto?: string | null): ReferenciaNormativa[] {
  return (texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha) => {
      const partes = linha.split(SEPARADOR);
      const norma = (partes[0] || "").trim();
      const segunda = (partes[1] || "").trim();

      /*
       * "Item 18.6.10" vira "18.6.10". A palavra "Item" repetida em cada
       * etiqueta não acrescenta nada — o número já diz o que é.
       */
      const casaItem = segunda.match(/^item\s+(.+)$/i);
      const item = casaItem ? casaItem[1].trim() : "";

      const descricao = (casaItem ? partes.slice(2) : partes.slice(1))
        .join(" — ").trim();

      return { norma, item, descricao, textoCompleto: linha };
    });
}

/** O rótulo curto da etiqueta: "NR-18 18.6.10", ou só a norma. */
export function rotuloCurto(r: ReferenciaNormativa): string {
  return r.item ? `${r.norma} ${r.item}` : r.norma;
}

/**
 * Quantas referências existem, sem montar a lista.
 *
 * A tela usa isto para decidir se vale mostrar o botão de abrir as
 * descrições.
 */
export function temDescricao(refs: ReferenciaNormativa[]): boolean {
  return (refs || []).some((r) => !!r.descricao);
}
