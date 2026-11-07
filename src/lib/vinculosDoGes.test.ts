import { describe, it, expect } from "vitest";
import {
  vinculosDeSetorFaltantes,
  vinculosDeFuncaoFaltantes,
  setoresSemGes,
} from "./vinculosDoGes";

/**
 * O caso real que originou isto, no banco do cliente: a empresa G91
 * NORDESTE - MATRIZ tinha 25 GES, 22 setores e ZERO ligações entre os
 * dois. A tela "Estrutura ocupacional" mostrava "0 GES · Sem GES" em
 * todos os 22 setores, e o técnico concluiu, com razão, que a importação
 * não tinha trazido o GES.
 *
 * A ligação existia no inventário de riscos. É dele que ela sai.
 */

const EMPRESA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const GES_COSTURA = "11111111-1111-4111-8111-111111111111";
const GES_CORTE = "22222222-2222-4222-8222-222222222222";
const SETOR_COSTURA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SETOR_CORTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("ligar GES ao setor pelo inventário", () => {
  it("tira a ligação de cada risco", () => {
    const v = vinculosDeSetorFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "COSTURA" },
      { empresa_id: EMPRESA, ghe_id: GES_CORTE, setor_id: SETOR_CORTE, setor: "CORTE" },
    ]);
    expect(v).toEqual([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, nome: "COSTURA" },
      { empresa_id: EMPRESA, ghe_id: GES_CORTE, setor_id: SETOR_CORTE, nome: "CORTE" },
    ]);
  });

  it("o mesmo par repetido em vários riscos vira uma ligação só", () => {
    /*
     * Um GES tem dezenas de perigos no mesmo setor — ruído, postura,
     * químico. Gravar um vínculo por risco encheria a tabela de cópias.
     */
    const itens = Array.from({ length: 30 }, () => ({
      empresa_id: EMPRESA,
      ghe_id: GES_COSTURA,
      setor_id: SETOR_COSTURA,
      setor: "COSTURA",
    }));
    expect(vinculosDeSetorFaltantes(itens)).toHaveLength(1);
  });

  it("não regrava o que a estrutura já tem", () => {
    const v = vinculosDeSetorFaltantes(
      [
        { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "COSTURA" },
        { empresa_id: EMPRESA, ghe_id: GES_CORTE, setor_id: SETOR_CORTE, setor: "CORTE" },
      ],
      [{ empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, nome: "COSTURA" }],
    );
    expect(v).toEqual([
      { empresa_id: EMPRESA, ghe_id: GES_CORTE, setor_id: SETOR_CORTE, nome: "CORTE" },
    ]);
  });

  it("risco sem GES ou sem setor não vira ligação", () => {
    /* Metade de um par não liga nada, e gravar assim só suja a tabela. */
    const v = vinculosDeSetorFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: null },
      { empresa_id: EMPRESA, ghe_id: null, setor_id: SETOR_COSTURA },
      { empresa_id: EMPRESA, ghe_id: "", setor_id: "" },
      { empresa_id: EMPRESA, ghe_id: "   ", setor_id: SETOR_CORTE },
      {},
    ]);
    expect(v).toEqual([]);
  });

  it("um GES que atende dois setores gera as duas ligações", () => {
    /*
     * Acontece de verdade: o mesmo grupo de expostos trabalha em dois
     * setores. Perder uma das duas deixa um setor órfão na tela.
     */
    const v = vinculosDeSetorFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "COSTURA" },
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_CORTE, setor: "CORTE" },
    ]);
    expect(v).toHaveLength(2);
  });

  it("inventário vazio não inventa ligação", () => {
    expect(vinculosDeSetorFaltantes([])).toEqual([]);
  });
});

describe("ligar GES à função", () => {
  const FUNCAO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("tira a ligação quando o risco traz a função", () => {
    expect(vinculosDeFuncaoFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: FUNCAO, funcao_nome: "Costureira" },
    ])).toEqual([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: FUNCAO, nome_funcao: "Costureira" },
    ]);
  });

  it("risco sem função não vira ligação", () => {
    expect(vinculosDeFuncaoFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: null },
    ])).toEqual([]);
  });

  it("não regrava o que já existe", () => {
    expect(vinculosDeFuncaoFaltantes(
      [{ empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: FUNCAO, funcao_nome: "Costureira" }],
      [{ empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: FUNCAO, nome_funcao: "Costureira" }],
    )).toEqual([]);
  });
});

describe("o que sobrou sem GES", () => {
  it("aponta os setores que continuam órfãos", () => {
    /*
     * Depois de importar, a tela precisa dizer a verdade. "Importado com
     * sucesso" em cima de uma estrutura pela metade foi o que fez o
     * técnico parar de confiar na importação.
     */
    const sobraram = setoresSemGes(
      [{ id: SETOR_COSTURA }, { id: SETOR_CORTE }, { id: "ddd" }],
      [{ empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, nome: "COSTURA" }],
    );
    expect(sobraram).toEqual([SETOR_CORTE, "ddd"]);
  });

  it("estrutura toda ligada não reporta sobra", () => {
    expect(setoresSemGes(
      [{ id: SETOR_COSTURA }],
      [{ empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, nome: "COSTURA" }],
    )).toEqual([]);
  });

  it("sem ligação nenhuma, todos os setores estão órfãos", () => {
    /* É exatamente o estado em que a G91 estava: 22 de 22. */
    const setores = Array.from({ length: 22 }, (_, i) => ({ id: `s${i}` }));
    expect(setoresSemGes(setores, [])).toHaveLength(22);
  });
});

describe("a linha sai completa, como o banco exige", () => {
  /*
   * ghe_setores exige empresa_id, ghe_id e nome; ghe_funcoes exige
   * empresa_id, ghe_id e nome_funcao. Faltando qualquer um, o Postgres
   * recusa a linha inteira — foi o que manteve os 22 setores "Sem GES"
   * mesmo com os 66 riscos importados e o erro indo só para o console.
   */
  it("o vínculo de setor leva empresa e nome", () => {
    const [v] = vinculosDeSetorFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "COSTURA" },
    ]);
    expect(Object.keys(v).sort()).toEqual(["empresa_id", "ghe_id", "nome", "setor_id"]);
    expect(v.empresa_id, "sem empresa o banco recusa a linha").toBe(EMPRESA);
    expect(v.nome, "sem nome o banco recusa a linha").toBe("COSTURA");
  });

  it("o vínculo de função leva empresa e nome da função", () => {
    const [v] = vinculosDeFuncaoFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, funcao_id: "f1", funcao_nome: "Costureira" },
    ]);
    expect(Object.keys(v).sort()).toEqual(["empresa_id", "funcao_id", "ghe_id", "nome_funcao"]);
  });

  it("sem empresa, não monta a linha em vez de montar uma que será recusada", () => {
    expect(vinculosDeSetorFaltantes([
      { ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "COSTURA" },
    ])).toEqual([]);
  });

  it("setor sem nome no inventário ainda gera linha válida", () => {
    /* Nome é obrigatório no banco; vazio viraria recusa silenciosa. */
    const [v] = vinculosDeSetorFaltantes([
      { empresa_id: EMPRESA, ghe_id: GES_COSTURA, setor_id: SETOR_COSTURA, setor: "   " },
    ]);
    expect(v.nome.length).toBeGreaterThan(0);
  });
});
