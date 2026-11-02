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

describe("o PCMSO mora na Central de Documentação", () => {
  it("não é item do menu Saúde Ocupacional", () => {
    /*
     * O card da Central leva para /pcmso/dashboard, e o item do menu
     * levava para a MESMA tela: o mesmo destino em dois lugares.
     * PCMSO é documento; se elabora e se emite na Central, junto com
     * PGR, LTCAT, PPP e os laudos.
     */
    expect(menu.saudeItems.map((i) => i.path),
      "o PCMSO voltou para o menu de Saúde Ocupacional")
      .not.toContain("/pcmso/dashboard");
  });

  it("/pcmso/dashboard aparece no máximo uma vez no menu", () => {
    const vezes = todosOsItens().filter((i) => i.path.startsWith("/pcmso"));
    expect(vezes.length).toBeLessThanOrEqual(1);
  });

  it("Saúde Ocupacional continua com o que é operação", () => {
    /* Tirar o documento não pode levar exames, ASO e vencimentos junto. */
    const paths = menu.saudeItems.map((i) => i.path);
    expect(paths).toContain("/aso");
    expect(paths).toContain("/rh/asos");
    expect(paths).toContain("/arquivo-digital/vencimentos");
  });
});

describe("o painel de EPIs mora dentro de Gestão de EPIs", () => {
  /*
   * O item "Dashboard" ficava solto no primeiro nível do menu, acima de
   * tudo. Mas a tela dele é o painel do módulo de EPI: EPIs cadastrados,
   * entregas realizadas, valor em estoque, gasto por EPI. Painel de um
   * módulo não é item de primeiro nível — é a primeira página do módulo.
   */
  it("está no grupo de EPIs", () => {
    const item = menu.epiItems.find((i) => i.path === "/");
    expect(item, "o painel sumiu do grupo de Gestão de EPIs").toBeTruthy();
    expect(item?.label).toBe("Painel de EPIs");
  });

  it("é o primeiro do grupo", () => {
    /* O resumo vem antes do que ele resume. */
    expect(menu.epiItems[0].path).toBe("/");
  });

  it("não ficou solto no primeiro nível", () => {
    expect(menu.mainNavItems.map((i) => i.path),
      "o painel continua fora do módulo, no topo do menu")
      .not.toContain("/");
  });

  it("não aparece duas vezes na árvore do menu lateral", () => {
    /*
     * A barra de atalhos do celular (mobileBottomItems) é outra coisa:
     * são quatro botões fixos, não a árvore de módulos. Por isso ela fica
     * de fora desta conferência.
     */
    const arvore = Object.entries(menu)
      .filter(([nome, v]) => Array.isArray(v) && nome !== "mobileBottomItems")
      .flatMap(([, v]) => v as { path: string }[])
      .filter((i) => i && typeof i.path === "string");
    expect(arvore.filter((i) => i.path === "/").length).toBe(1);
  });

  it("o grupo de EPIs continua inteiro", () => {
    /* Pôr um item no grupo não pode empurrar os outros para fora. */
    const paths = menu.epiItems.map((i) => i.path);
    expect(paths).toContain("/epis");
    expect(paths).toContain("/epis/controle-contrato");
    expect(paths).toContain("/epis/solicitacoes-materiais");
    expect(paths).toContain("/entregas");
    expect(paths).toContain("/relatorios");
  });
});
