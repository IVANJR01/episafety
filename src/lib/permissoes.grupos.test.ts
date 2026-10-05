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
