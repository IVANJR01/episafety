import { describe, expect, it, vi } from "vitest";

/**
 * A CAT não é item do menu "Gestão de ASO".
 *
 * Ela não é controle médico de saúde: é a comunicação de um acidente à
 * Previdência, e estava pendurada no grupo de saúde ocupacional. Saiu a
 * pedido do cliente.
 *
 * A tela continua existindo em /cat e os registros estão intactos — o
 * que saiu foi o atalho deste grupo. Por isso o teste olha o grupo, e
 * não a existência da rota.
 */

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({}) }));

const { asoItems } = await import("./AppLayout");

describe("menu Gestão de ASO", () => {
  it("não tem a CAT", () => {
    expect(asoItems.map((i) => i.path), "a CAT voltou para o grupo de saúde ocupacional")
      .not.toContain("/cat");
    expect(asoItems.map((i) => i.label).join(" ")).not.toContain("CAT");
  });

  it("continua com os Exames Ocupacionais", () => {
    /* Tirar a CAT não pode levar o grupo inteiro junto. */
    expect(asoItems.map((i) => i.path)).toContain("/aso");
  });
});
