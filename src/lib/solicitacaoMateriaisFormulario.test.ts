import { describe, it, expect } from "vitest";
import {
  nomeDoSolicitante,
  solicitanteAindaAutomatico,
  preenchidosNosDetalhes,
  itemTemNotas,
  dataBrasileira,
} from "./solicitacaoMateriaisFormulario";

describe("quem está pedindo", () => {
  it("usa o nome do perfil, não o pedaço do e-mail", () => {
    /* Era "ivanjr.tstconsultoria" que saía impresso no PDF. */
    expect(nomeDoSolicitante("Ivan Júnior", "ivanjr.tstconsultoria@exemplo.com")).toBe("Ivan Júnior");
  });

  it("sem nome no perfil, cai no e-mail, para não sair em branco", () => {
    expect(nomeDoSolicitante("", "ana.silva@exemplo.com")).toBe("ana.silva");
    expect(nomeDoSolicitante(null, "ana.silva@exemplo.com")).toBe("ana.silva");
    expect(nomeDoSolicitante("   ", "ana.silva@exemplo.com")).toBe("ana.silva");
  });

  it("sem nada, vazio", () => {
    expect(nomeDoSolicitante(null, null)).toBe("");
  });
});

describe("não sobrescrever o que a pessoa escreveu", () => {
  const EMAIL = "ana.silva@exemplo.com";

  it("campo vazio ou com o e-mail ainda é automático", () => {
    expect(solicitanteAindaAutomatico("", EMAIL)).toBe(true);
    expect(solicitanteAindaAutomatico("ana.silva", EMAIL)).toBe(true);
  });

  it("nome digitado — pedindo por outra pessoa — fica como está", () => {
    expect(solicitanteAindaAutomatico("Carlos, encarregado da obra", EMAIL)).toBe(false);
  });
});

describe("o que está preenchido em Mais informações", () => {
  it("lista só o que tem conteúdo", () => {
    expect(preenchidosNosDetalhes({ setor: "Costura", observacoes: "Urgente para segunda" }))
      .toEqual(["setor", "observações"]);
  });

  it("espaço em branco não conta", () => {
    expect(preenchidosNosDetalhes({ local_obra: "   ", justificativa: "" })).toEqual([]);
  });

  it("o solicitante não entra: ele aparece sempre no cabeçalho", () => {
    expect(preenchidosNosDetalhes({ solicitante_nome: "Ana" })).toEqual([]);
  });
});

describe("notas do item", () => {
  it("abre quando tem justificativa ou observação", () => {
    expect(itemTemNotas({ justificativa_item: "Desgaste" })).toBe(true);
    expect(itemTemNotas({ observacoes: "Tamanho G" })).toBe(true);
  });

  it("fica recolhida quando não tem nada", () => {
    expect(itemTemNotas({})).toBe(false);
    expect(itemTemNotas({ justificativa_item: "  ", observacoes: "" })).toBe(false);
  });
});

describe("data", () => {
  it("mostra no formato brasileiro", () => {
    expect(dataBrasileira("2026-11-17")).toBe("17/11/2026");
  });

  it("valor torto não vira data inventada", () => {
    expect(dataBrasileira("")).toBe("");
    expect(dataBrasileira("17/11/2026")).toBe("");
  });
});
