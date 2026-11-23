import { describe, it, expect } from "vitest";
import { podeAcaoFina, hasPermission, chaveDeBloqueio } from "./permissions";

describe("ações finas (liberadas por padrão, bloqueáveis)", () => {
  it("quem já tinha a ação base continua podendo: ninguém perde acesso", () => {
    expect(podeAcaoFina(["entregas:view", "entregas:edit"], "entregas", "gerar_ficha")).toBe(true);
    expect(podeAcaoFina(["entregas"], "entregas", "desfazer_devolucao")).toBe(true);
  });
  it("o bloqueio tira só aquela ação", () => {
    const perms = ["entregas:view", "entregas:create", "entregas:edit", chaveDeBloqueio("entregas", "desfazer_devolucao")];
    expect(podeAcaoFina(perms, "entregas", "desfazer_devolucao")).toBe(false);
    expect(podeAcaoFina(perms, "entregas", "gerar_ficha")).toBe(true);
    expect(hasPermission(perms, "entregas", "edit")).toBe(true);
  });
  it("bloqueio vale também sobre a chave antiga de acesso total", () => {
    expect(podeAcaoFina(["entregas", "entregas:sem:gerar_ficha"], "entregas", "gerar_ficha")).toBe(false);
  });
  it("sem a ação base, não pode, mesmo sem bloqueio", () => {
    expect(podeAcaoFina(["entregas:view"], "entregas", "registrar_devolucao")).toBe(false);
    expect(podeAcaoFina(["entregas:view", "entregas:create"], "entregas", "registrar_devolucao")).toBe(true);
  });
  it("um bloqueio sozinho não dá acesso ao módulo", () => {
    expect(hasPermission(["entregas:sem:gerar_ficha"], "entregas", "view")).toBe(false);
  });
  it("ação que não existe não é liberada", () => {
    expect(podeAcaoFina(["entregas"], "entregas", "apagar_tudo")).toBe(false);
  });
});
