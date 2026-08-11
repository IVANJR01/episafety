import { describe, it, expect } from "vitest";
import { indexarVinculos, candidatosDeGes, type EstruturaVinculos } from "./pgrGesVinculo";

/**
 * O cenário é o real que motivou o módulo: setor PCP com o grupo 01, e uma
 * linha do inventário que ficou com a função "Ajudante de Confecção" mas sem
 * grupo nenhum — imprimindo N.A na coluna GES do PGR.
 */
const base: EstruturaVinculos = {
  ges: [
    { id: "g01", codigo: "01", status: "ativo" },
    { id: "g02", codigo: "02", status: "ativo" },
    { id: "gArq", codigo: "09", status: "inativo" },
  ],
  gheSetores: [
    { ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: true },
    { ghe_id: "g02", nome: "COSTURA", setor_id: "s-cost", ativo: true },
    { ghe_id: "gArq", nome: "PCP", setor_id: "s-pcp", ativo: true },
  ],
  gheFuncoes: [
    { ghe_id: "g01", nome_funcao: "Ajudante de Confecção", funcao_id: "f-ajud", status: "ativo" },
    { ghe_id: "g01", nome_funcao: "Analista de PCP", funcao_id: "f-anal", status: "ativo" },
    { ghe_id: "g02", nome_funcao: "Costureira", funcao_id: "f-cost", status: "ativo" },
  ],
  setores: [{ id: "s-pcp", nome: "PCP" }, { id: "s-cost", nome: "COSTURA" }],
  funcoes: [
    { id: "f-ajud", nome: "Ajudante de Confecção" },
    { id: "f-anal", nome: "Analista de PCP" },
    { id: "f-cost", nome: "Costureira" },
  ],
};

const ix = indexarVinculos(base);

describe("candidatosDeGes", () => {
  it("acha o grupo pelo setor e pela função juntos", () => {
    expect(candidatosDeGes(ix, { setor: "PCP", funcoes: ["Ajudante de Confecção"] })).toEqual(["g01"]);
  });

  it("acha pela função quando a linha não tem setor", () => {
    expect(candidatosDeGes(ix, { setor: "", funcoes: ["Ajudante de Confecção"] })).toEqual(["g01"]);
  });

  it("acha pelo setor quando a linha não tem função", () => {
    expect(candidatosDeGes(ix, { setor: "COSTURA", funcoes: [] })).toEqual(["g02"]);
  });

  it("ignora acento, caixa e espaço sobrando", () => {
    expect(candidatosDeGes(ix, { setor: " pcp ", funcoes: ["ajudante de confeccao"] })).toEqual(["g01"]);
  });

  it("não devolve grupo inativo, mesmo com o setor batendo", () => {
    // gArq também é do setor PCP, mas está arquivado: vincular a ele seria
    // ressuscitar um grupo que a empresa desativou.
    expect(candidatosDeGes(ix, { setor: "PCP", funcoes: [] })).toEqual(["g01"]);
  });

  it("devolve vazio quando nada bate — a tela tem de perguntar", () => {
    expect(candidatosDeGes(ix, { setor: "ALMOXARIFADO", funcoes: ["Empilhadeirista"] })).toEqual([]);
  });

  it("devolve os dois quando o setor tem mais de um grupo e a função não desempata", () => {
    const doisNoSetor = indexarVinculos({
      ...base,
      gheSetores: [
        { ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: true },
        { ghe_id: "g02", nome: "PCP", setor_id: "s-pcp", ativo: true },
      ],
    });
    expect(candidatosDeGes(doisNoSetor, { setor: "PCP", funcoes: [] }).sort()).toEqual(["g01", "g02"]);
  });

  it("a função desempata quando o setor sozinho seria ambíguo", () => {
    const doisNoSetor = indexarVinculos({
      ...base,
      gheSetores: [
        { ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: true },
        { ghe_id: "g02", nome: "PCP", setor_id: "s-pcp", ativo: true },
      ],
    });
    expect(candidatosDeGes(doisNoSetor, { setor: "PCP", funcoes: ["Costureira"] })).toEqual(["g02"]);
  });

  it("casa pelo id quando o vínculo antigo não guardou o nome", () => {
    const soId = indexarVinculos({
      ...base,
      gheSetores: [{ ghe_id: "g01", nome: null, setor_id: "s-pcp", ativo: true }],
      gheFuncoes: [{ ghe_id: "g01", nome_funcao: null, funcao_id: "f-ajud", status: "ativo" }],
    });
    expect(candidatosDeGes(soId, { setor: "PCP", funcoes: ["Ajudante de Confecção"] })).toEqual(["g01"]);
  });

  it("ignora vínculo de setor desativado", () => {
    const desativado = indexarVinculos({
      ...base,
      gheSetores: [{ ghe_id: "g01", nome: "PCP", setor_id: "s-pcp", ativo: false }],
    });
    expect(candidatosDeGes(desativado, { setor: "PCP", funcoes: [] })).toEqual([]);
  });

  it("ignora função desativada no grupo", () => {
    const semFuncao = indexarVinculos({
      ...base,
      gheFuncoes: [{ ghe_id: "g01", nome_funcao: "Ajudante de Confecção", funcao_id: "f-ajud", status: "inativo" }],
    });
    expect(candidatosDeGes(semFuncao, { setor: "", funcoes: ["Ajudante de Confecção"] })).toEqual([]);
  });

  it("não casa por campo vazio — linha sem setor nem função fica órfã", () => {
    // Sem esta guarda, o vínculo com nome vazio viraria chave "" e qualquer
    // linha em branco seria ligada ao primeiro grupo que tivesse um campo nulo.
    const comVazio = indexarVinculos({
      ...base,
      gheSetores: [{ ghe_id: "g01", nome: "", setor_id: null, ativo: true }],
      gheFuncoes: [{ ghe_id: "g01", nome_funcao: "", funcao_id: null, status: "ativo" }],
    });
    expect(candidatosDeGes(comVazio, { setor: "", funcoes: [] })).toEqual([]);
    expect(candidatosDeGes(comVazio, { setor: null, funcoes: [null, undefined, ""] })).toEqual([]);
  });
});
