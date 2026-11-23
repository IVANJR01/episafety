import { describe, expect, it } from "vitest";
import { GRUPOS_MODULOS, MODULOS } from "./permissions";

/*
 * O agrupamento é só apresentação, mas um módulo esquecido nele some da tela
 * de permissões — e permissão que ninguém vê é permissão que ninguém revisa.
 * Por isso a cobertura é conferida, não confiada.
 */
describe("grupos de módulos", () => {
  const agrupados = GRUPOS_MODULOS.flatMap((g) => g.modulos);

  it("cobre todos os módulos existentes", () => {
    const faltando = MODULOS.map((m) => m.key).filter((k) => !agrupados.includes(k));
    expect(faltando, `módulo fora de qualquer grupo: ${faltando.join(", ")}`).toEqual([]);
  });

  it("não cita módulo que não existe", () => {
    const chaves = MODULOS.map((m) => m.key) as string[];
    const sobrando = agrupados.filter((k) => !chaves.includes(k));
    expect(sobrando, `grupo cita módulo inexistente: ${sobrando.join(", ")}`).toEqual([]);
  });

  it("não repete o mesmo módulo em dois grupos", () => {
    const repetidos = agrupados.filter((k, i) => agrupados.indexOf(k) !== i);
    expect(repetidos, `módulo em mais de um grupo: ${repetidos.join(", ")}`).toEqual([]);
  });
});

import { NOME_NA_PERMISSAO, normalizarPermissoes, hasPermission } from "./permissions";

describe("nomes na tela de permissões", () => {
  it("todo módulo tem nome claro", () => {
    const sem = MODULOS.map((m) => m.key).filter((k) => !NOME_NA_PERMISSAO[k]);
    expect(sem).toEqual([]);
  });
});

describe("conversão das caixinhas antigas de PGR/LTCAT/PPP/Portal RH", () => {
  it("Visualizar e Editar viram as colunas", () => {
    expect(normalizarPermissoes(["pgr:visualizar", "pgr:editar"]).sort()).toEqual(["pgr:create", "pgr:edit", "pgr:view"]);
  });
  it("revisar/assinar/exportar continuam só dando leitura, como na prática davam", () => {
    const r = normalizarPermissoes(["ltcat:assinar", "ltcat:exportar"]);
    expect(r).toEqual(["ltcat:view"]);
    expect(hasPermission(r, "ltcat", "edit")).toBe(false);
  });
  it("Portal RH vira acesso de leitura", () => {
    expect(normalizarPermissoes(["portal_rh:aso:baixar", "portal_rh:visualizar"])).toEqual(["portal_rh:view"]);
  });
  it("não mexe no resto: eSocial, estoque, bloqueios, chave antiga de acesso total", () => {
    const p = ["esocial:s2240:preparar", "epis:gestao_estoque", "entregas:sem:gerar_ficha", "pgr", "dds:view"];
    expect(normalizarPermissoes(p).sort()).toEqual([...p].sort());
  });
  it("quem tinha acesso continua tendo o mesmo acesso de leitura", () => {
    for (const antiga of ["pgr:visualizar", "pgr:revisar", "ppp:assinar", "portal_rh:aso:visualizar"]) {
      const mod = antiga.split(":")[0];
      expect(hasPermission(normalizarPermissoes([antiga]), mod, "view")).toBe(true);
    }
  });
});

describe("todo item do menu pode ser liberado na tela de permissões", () => {
  it("nenhuma chave de menu fica de fora", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const menu = fs.readFileSync(path.resolve(__dirname, "../components/AppLayout.tsx"), "utf8");
    const chaves = [...new Set([...menu.matchAll(/moduleKey: "([^"]+)"/g)].map((m) => m[1]))];
    const naTela = MODULOS.map((m) => m.key) as string[];
    expect(chaves.filter((k) => !naTela.includes(k))).toEqual([]);
  });
});
