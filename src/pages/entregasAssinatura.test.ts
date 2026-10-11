import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/*
 * A entrega não se grava sem assinatura pela porta da frente.
 *
 * Havia um botão "Pular (Assinar Depois)" no diálogo de assinatura: ele
 * mantinha a entrega já gravada e seguia em frente sem assinatura. Foi de lá
 * que vieram todas as pendências do histórico do cliente — seis entregas, de
 * dois dias, sem nada que as cobrasse depois.
 *
 * As duas saídas que sobraram não deixam registro pela metade: assinar, ou
 * cancelar (que apaga a entrega). Este teste existe porque o botão é fácil de
 * reintroduzir "para desbloquear o usuário", e o custo aparece semanas depois,
 * na ficha sem assinatura.
 */
const ENTREGAS = fs.readFileSync(
  path.resolve(__dirname, "Entregas.tsx"),
  "utf8",
);

describe("fluxo de assinatura da entrega", () => {
  it("não oferece pular a assinatura", () => {
    // Comentário não é interface: o bloco que explica a remoção cita o nome
    // do botão, e é código comentado que some antes da verificação.
    const codigo = ENTREGAS
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/Assinar Depois/i);
    expect(codigo).not.toMatch(/\bPular\b/i);
  });

  it("mantém a saída que apaga o registro em vez de deixá-lo pendente", () => {
    expect(ENTREGAS).toContain("Cancelar Entrega");
    expect(ENTREGAS).toContain("handleCancelSignatureFlow");
  });

  it("fechar o diálogo cancela, em vez de gravar sem assinatura", () => {
    // `onOpenChange` do diálogo de assinatura chama o mesmo cancelamento.
    const trecho = ENTREGAS.slice(ENTREGAS.indexOf("open={signOpen}"));
    expect(trecho.slice(0, 400)).toContain("handleCancelSignatureFlow");
  });
});
