import { describe, expect, it } from "vitest";
import { formularioDeNovaInspecao, heranca, hojeISO } from "./novaInspecao";

/**
 * A data de uma nova inspeção é a de hoje.
 *
 * O formulário abria com a data do último lançamento: quem inspecionava
 * em 29/10 via 09/04 no campo e, sem reparar, gravava a inspeção de hoje
 * com a data de meses atrás. Num documento que serve de prova de
 * fiscalização, data errada é o pior tipo de erro — ninguém confere o
 * que já vem preenchido.
 */

const VAZIO = {
  data_inspecao: "", situacao_detectada: "", obra_id: "", local: "",
  gravidade: "LEVE",
};

describe("a data com que o formulário abre", () => {
  it("é a de hoje", () => {
    const hoje = new Date(2026, 9, 29, 14, 30); // 29/10/2026
    expect(formularioDeNovaInspecao(VAZIO, null, hoje).data_inspecao).toBe("2026-10-29");
  });

  it("não herda a data do lançamento anterior", () => {
    const hoje = new Date(2026, 9, 29);
    const anterior = { data_inspecao: "2026-04-09", obra_id: "o1", local: "SE 69 KV ASSU" } as any;
    expect(
      formularioDeNovaInspecao(VAZIO, anterior, hoje).data_inspecao,
      "abriu com a data de um lançamento antigo",
    ).toBe("2026-10-29");
  });

  it("é calculada na hora de abrir, não quando o app carregou", () => {
    /*
     * O sistema fica dias aberto no celular em campo. Com a data
     * calculada uma vez só, na segunda-feira ele ainda oferecia a
     * sexta-feira.
     */
    const sexta = formularioDeNovaInspecao(VAZIO, null, new Date(2026, 9, 23));
    const segunda = formularioDeNovaInspecao(VAZIO, null, new Date(2026, 9, 26));
    expect(sexta.data_inspecao).not.toBe(segunda.data_inspecao);
    expect(segunda.data_inspecao).toBe("2026-10-26");
  });

  it("não escorrega de dia por causa de fuso", () => {
    /*
     * toISOString() devolve UTC: às 21h no Brasil já é o dia seguinte
     * lá, e a inspeção nasceria datada de amanhã.
     */
    expect(hojeISO(new Date(2026, 9, 29, 21, 0))).toBe("2026-10-29");
    expect(hojeISO(new Date(2026, 9, 29, 0, 30))).toBe("2026-10-29");
  });
});

describe("o que o registro anterior empresta", () => {
  it("obra e local continuam, porque a visita rende vários apontamentos", () => {
    const h = heranca({ obra_id: "o1", local: "SE 69 KV ASSU" });
    expect(h).toEqual({ obra_id: "o1", local: "SE 69 KV ASSU" });
  });

  it("o formulário novo já vem com a obra do anterior", () => {
    const f = formularioDeNovaInspecao(
      VAZIO, { obra_id: "o1", local: "SE 69 KV ASSU" }, new Date(2026, 9, 29),
    );
    expect(f.obra_id).toBe("o1");
    expect(f.local).toBe("SE 69 KV ASSU");
  });

  it("sem registro anterior, não herda nada", () => {
    expect(heranca(null)).toBeNull();
    expect(heranca({ obra_id: "", local: "  " })).toBeNull();
  });
});
