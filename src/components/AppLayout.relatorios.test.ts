import { describe, expect, it, vi } from "vitest";

/**
 * Os relatórios de EPI moram dentro de Gestão de EPIs.
 *
 * "Central de Relatórios" era um item de primeiro nível apontando para
 * /relatorios — a MESMA rota de "Relatórios de EPIs", que já está dentro
 * de Gestão de EPIs. O mesmo destino aparecia duas vezes no menu, e o
 * nome de fora prometia uma central de todos os relatórios enquanto a
 * tela filtra e analisa entregas de EPI.
 */

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({}) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({}) }));

const menu = await import("./AppLayout");

/** Todo item de menu exportado, de todos os grupos. */
function todosOsItens(): { path: string; label: string }[] {
  return Object.values(menu)
    .filter((v): v is { path: string; label: string }[] => Array.isArray(v))
    .flat()
    .filter((i) => i && typeof i.path === "string");
}

describe("relatórios no menu", () => {
  it("/relatorios aparece uma vez só", () => {
    const vezes = todosOsItens().filter((i) => i.path === "/relatorios");
    expect(vezes.map((i) => i.label), "o mesmo destino em dois lugares do menu")
      .toEqual(["Relatórios de EPIs"]);
  });

  it("está dentro de Gestão de EPIs", () => {
    expect(menu.epiItems.map((i) => i.path)).toContain("/relatorios");
  });

  it("não há mais 'Central de Relatórios'", () => {
    /* O nome prometia os relatórios do sistema inteiro. */
    expect(todosOsItens().map((i) => i.label).join(" | "))
      .not.toContain("Central de Relatórios");
  });

  it("os outros itens de EPI continuam no lugar", () => {
    /* Mexer no grupo não pode levar o resto junto. */
    const paths = menu.epiItems.map((i) => i.path);
    expect(paths).toContain("/epis");
    expect(paths).toContain("/entregas");
  });
});

describe("o módulo Comercial saiu do sistema", () => {
  /*
   * A pedido do cliente: "um tempo atrás eu estava querendo criar algo
   * comercial, porém não deu certo". Conferido antes de apagar: zero
   * orçamento, zero serviço no catálogo e um único cliente chamado
   * "TESTE 01".
   */
  it("nenhum item de menu aponta para /comercial", () => {
    const sobrou = todosOsItens().filter((i) => i.path.startsWith("/comercial"));
    expect(sobrou.map((i) => i.path), "ficou um atalho para tela que não existe mais")
      .toEqual([]);
  });

  it("não é mais um módulo de permissão", async () => {
    /*
     * Módulo sem tela vira caixa marcável que não libera nada, e quem
     * configura o perfil acredita que liberou.
     */
    const { MODULOS } = await import("@/lib/permissions");
    expect((MODULOS as any[]).map((m) => m.key)).not.toContain("comercial");
  });

  it("os outros grupos do menu continuam de pé", () => {
    /* Mexer no menu é o jeito mais fácil de derrubar o que está ao lado. */
    const paths = todosOsItens().map((i) => i.path);
    expect(paths).toContain("/epis");
    expect(paths).toContain("/inspecoes-se");
    expect(paths).toContain("/aso");
  });
});
