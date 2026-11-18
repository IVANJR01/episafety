/**
 * O que fazer com cada resposta do servidor ao subir a fila offline.
 *
 * A fila tentava de novo QUALQUER falha, para sempre. Um caso real que
 * isso quebra: a entrega sobe, o servidor grava, e a resposta se perde
 * porque o sinal caiu de novo no meio — coisa comum em canteiro de obra.
 * Na próxima tentativa o servidor recusa com 23505 (registro repetido),
 * porque a entrega JÁ está lá com aquele id. A fila tratava como falha,
 * mantinha, tentava de novo... e o aviso vermelho "operações falharam"
 * aparecia toda vez que o aplicativo abria, para uma entrega que nunca
 * esteve perdida.
 *
 * Sem banco: entra a operação e o erro, sai a decisão.
 */

export type DecisaoDaFila = "concluida" | "tentar_de_novo";

export function decisaoDaFila(
  op: { type: "insert" | "update" | "delete"; payload?: { id?: unknown } | null },
  erro: { code?: string | null } | null | undefined,
): DecisaoDaFila {
  if (!erro) return "concluida";
  /*
   * Inserção com id próprio recusada por repetição: aquele id já está no
   * servidor. O id é gerado no aparelho na hora do registro, então é
   * esta mesma entrega — não outra com o mesmo número.
   */
  if (op.type === "insert" && erro.code === "23505" && typeof op.payload?.id === "string" && op.payload.id) {
    return "concluida";
  }
  return "tentar_de_novo";
}
