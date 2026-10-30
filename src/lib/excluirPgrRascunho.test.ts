import { describe, expect, it } from "vitest";
import { podeExcluirPgr } from "./excluirPgrRascunho";

/**
 * Uma importação feita na empresa errada deixou quatro rascunhos na
 * tela e nenhum jeito de tirá-los: o histórico de versões só oferecia
 * "Ver".
 */

describe("o que pode ser excluído", () => {
  it("rascunho pode", () => {
    expect(podeExcluirPgr({ status: "rascunho" })).toBe(true);
    expect(podeExcluirPgr({ status: "RASCUNHO" })).toBe(true);
  });

  it("documento emitido NÃO pode", () => {
    /*
     * Ele pode ter ido à fiscalização, sido assinado e fundamentado
     * ação, ASO e treinamento. Para tirar de circulação existe
     * arquivar, que não apaga nada.
     */
    expect(podeExcluirPgr({ status: "vigente" }), "apagou documento emitido").toBe(false);
    expect(podeExcluirPgr({ status: "arquivado" })).toBe(false);
    expect(podeExcluirPgr({ status: "substituido" })).toBe(false);
  });

  it("sem status, não apaga", () => {
    /* Na dúvida, o documento fica. */
    expect(podeExcluirPgr({ status: null })).toBe(false);
    expect(podeExcluirPgr(null)).toBe(false);
    expect(podeExcluirPgr(undefined)).toBe(false);
  });
});
