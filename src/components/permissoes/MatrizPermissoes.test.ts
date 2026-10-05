import { describe, expect, it } from "vitest";
import { quantasNoModulo, temPermissao } from "./MatrizPermissoes";

describe("leitura das permissões de um módulo", () => {
  it("entende a chave por ação", () => {
    const perms = ["epis:view", "epis:edit"];
    expect(temPermissao(perms, "epis", "view")).toBe(true);
    expect(temPermissao(perms, "epis", "delete")).toBe(false);
    expect(quantasNoModulo(perms, "epis")).toBe(2);
  });

  it("entende a chave antiga, sem ação, como acesso total", () => {
    const perms = ["epis"];
    expect(temPermissao(perms, "epis", "delete")).toBe(true);
    expect(quantasNoModulo(perms, "epis")).toBe(4);
  });

  it("não confunde módulos com nome parecido", () => {
    // "cadastro_empresas" começa com "cadastro_e", e um `startsWith` mal feito
    // liberaria um módulo pelo outro.
    const perms = ["cadastro_empresas:view"];
    expect(temPermissao(perms, "cadastro_empresas", "view")).toBe(true);
    expect(temPermissao(perms, "cadastro_e", "view")).toBe(false);
    expect(quantasNoModulo(perms, "cadastro_funcionarios")).toBe(0);
  });

  it("módulo sem nenhuma permissão conta zero", () => {
    expect(quantasNoModulo([], "pgr")).toBe(0);
    expect(temPermissao([], "pgr", "view")).toBe(false);
  });
});
