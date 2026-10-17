import { describe, expect, it, vi } from "vitest";

/**
 * A CAT saiu do sistema, a pedido do cliente.
 *
 * Primeiro saiu do menu "Gestão de ASO" — ela não é controle médico de
 * saúde, é a comunicação de um acidente à Previdência. Depois as telas
 * foram removidas de vez. Conferido antes de apagar: zero CAT
 * registrada no banco (`cat_comunicacoes`), então nada de cliente se
 * perdeu.
 *
 * As tabelas do banco continuam lá, intocadas: apagar tabela não se
 * desfaz, e elas não atrapalham ninguém.
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

describe("a CAT não sobrou em canto nenhum do sistema", () => {
  it("nenhum item de menu aponta para /cat", async () => {
    const menu = await import("./AppLayout");
    const todos = Object.values(menu)
      .filter((v): v is { path: string }[] => Array.isArray(v))
      .flat();
    const sobrou = todos.filter((i) => i?.path === "/cat" || i?.path?.startsWith("/cat/"));
    expect(sobrou.map((i) => i.path), "ficou um atalho para uma tela que não existe mais")
      .toEqual([]);
  });

  it("a CAT não é mais um módulo de permissão", async () => {
    /*
     * Módulo de permissão sem tela vira caixa marcável que não libera
     * nada — e quem configura o perfil acredita que liberou.
     */
    const { MODULOS } = await import("@/lib/permissions");
    expect((MODULOS as any[]).map((m) => m.key)).not.toContain("cat");
  });

  it("o LTCAT, que tem 'cat' no nome, continua inteiro", async () => {
    /* O nome parecido é o jeito mais fácil de levar junto o errado. */
    const { MODULOS } = await import("@/lib/permissions");
    expect((MODULOS as any[]).map((m) => m.key)).toContain("ltcat");
  });
});
