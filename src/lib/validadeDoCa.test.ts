import { describe, it, expect } from "vitest";
import {
  situacaoDoCa,
  entregaEpiParaUso,
  episComCaVencido,
  recusaPorCaVencido,
  DIAS_DE_AVISO,
} from "./validadeDoCa";

/**
 * Entregar EPI com CA vencido equivale, na fiscalização, a não ter
 * entregado nada. Era o único dos três pilares da página que o sistema
 * não fazia. Estas regras são as que impedem a entrega — se alguma delas
 * errar, o sistema volta a deixar sair equipamento sem cobertura legal,
 * ou trava o almoxarifado sem motivo.
 */

const HOJE = "2026-11-03";

describe("a situação do CA", () => {
  it("CA com data futura está válido", () => {
    const s = situacaoDoCa("2027-05-10", HOJE);
    expect(s.nivel).toBe("valido");
    expect(s.diasRestantes).toBeGreaterThan(DIAS_DE_AVISO);
  });

  it("CA que vence HOJE ainda vale hoje", () => {
    /*
     * O certificado vale até o fim do dia do vencimento. Comparar com a
     * hora corrente faria um CA que vence hoje aparecer vencido às 00h01
     * e travar a entrega do dia inteiro sem razão.
     */
    const s = situacaoDoCa(HOJE, HOJE);
    expect(s.nivel).not.toBe("vencido");
    expect(s.diasRestantes).toBe(0);
    expect(s.mensagem).toBe("CA vence hoje");
  });

  it("vence amanhã: avisa, não bloqueia", () => {
    const s = situacaoDoCa("2026-11-04", HOJE);
    expect(s.nivel).toBe("vence_em_breve");
    expect(s.mensagem).toBe("CA vence amanhã");
  });

  it("venceu ontem: está vencido", () => {
    const s = situacaoDoCa("2026-11-02", HOJE);
    expect(s.nivel).toBe("vencido");
    expect(s.diasRestantes).toBe(-1);
    expect(s.mensagem).toBe("CA vencido ontem");
  });

  it("diz há quanto tempo venceu", () => {
    expect(situacaoDoCa("2026-10-04", HOJE).mensagem).toBe("CA vencido há 30 dias");
  });

  it("avisa dentro da janela, e não antes dela", () => {
    expect(situacaoDoCa("2026-12-03", HOJE).nivel, "30 dias deveria avisar")
      .toBe("vence_em_breve");
    expect(situacaoDoCa("2026-12-04", HOJE).nivel, "31 dias ainda não avisa")
      .toBe("valido");
  });

  it("sem data cadastrada não vira nem válido nem vencido", () => {
    /*
     * O sistema não sabe. Dizer "válido" seria mentir e dizer "vencido"
     * travaria o almoxarifado por falta de cadastro.
     */
    for (const vazio of [null, undefined, "", "   ", "data-ruim"]) {
      expect(situacaoDoCa(vazio as string | null, HOJE).nivel).toBe("sem_data");
    }
  });

  it("aceita data com hora junto", () => {
    expect(situacaoDoCa("2026-11-02T10:00:00Z", HOJE).nivel).toBe("vencido");
  });

  it("vira o ano sem se perder", () => {
    expect(situacaoDoCa("2027-01-01", "2026-12-31").nivel).toBe("vence_em_breve");
    expect(situacaoDoCa("2026-12-31", "2027-01-01").nivel).toBe("vencido");
  });
});

describe("quando o CA vencido impede", () => {
  const vencido = { nome: "LUVA DE MALHA DE AÇO", validade: "2026-01-10" };
  const valido = { nome: "CAPACETE", validade: "2027-01-10" };
  const semData = { nome: "BOTINA", validade: null };

  it("entrega e substituição são impedidas", () => {
    for (const tipo of ["entrega", "substituicao"]) {
      expect(episComCaVencido([{ epi: vencido }], tipo, HOJE).map((e) => e.nome))
        .toEqual(["LUVA DE MALHA DE AÇO"]);
    }
  });

  it("perda e dano NÃO são impedidos", () => {
    /*
     * Registrar perda ou dano é o contrário de entregar: o equipamento já
     * estava com o colaborador. Bloquear esconderia o fato em vez de
     * evitá-lo, e o EPI sumiria do controle.
     */
    for (const tipo of ["perda", "dano", "devolucao"]) {
      expect(episComCaVencido([{ epi: vencido }], tipo, HOJE),
        `${tipo} não deveria ser bloqueado`).toEqual([]);
    }
  });

  it("EPI sem validade cadastrada não bloqueia", () => {
    expect(episComCaVencido([{ epi: semData }], "entrega", HOJE)).toEqual([]);
  });

  it("CA válido não bloqueia", () => {
    expect(episComCaVencido([{ epi: valido }], "entrega", HOJE)).toEqual([]);
  });

  it("numa lista com vários, aponta só os vencidos", () => {
    const vencido2 = { nome: "PROTETOR AURICULAR", validade: "2025-12-01" };
    const achados = episComCaVencido(
      [{ epi: valido }, { epi: vencido }, { epi: semData }, { epi: vencido2 }],
      "entrega",
      HOJE,
    );
    expect(achados.map((e) => e.nome))
      .toEqual(["LUVA DE MALHA DE AÇO", "PROTETOR AURICULAR"]);
  });
});

describe("o recado da recusa", () => {
  it("sem EPI vencido, não há recusa", () => {
    expect(recusaPorCaVencido([])).toBeNull();
  });

  it("diz o nome do EPI e o que fazer", () => {
    /* Recusa sem saída faz o almoxarife largar o sistema e voltar ao papel. */
    const r = recusaPorCaVencido([{ nome: "LUVA DE MALHA DE AÇO" }])!;
    expect(r.titulo).toContain("CA vencido");
    expect(r.descricao).toContain("LUVA DE MALHA DE AÇO");
    expect(r.descricao).toMatch(/atualize a validade/i);
    expect(r.descricao).toMatch(/NR-06/);
  });

  it("com mais de um, diz quantos e lista todos", () => {
    const r = recusaPorCaVencido([{ nome: "LUVA" }, { nome: "BOTINA" }])!;
    expect(r.titulo).toContain("2 EPIs");
    expect(r.descricao).toContain("LUVA");
    expect(r.descricao).toContain("BOTINA");
  });
});

describe("que tipo de registro entrega EPI para uso", () => {
  it("entrega e substituição, sim", () => {
    expect(entregaEpiParaUso("entrega")).toBe(true);
    expect(entregaEpiParaUso("substituicao")).toBe(true);
  });

  it("perda, dano e devolução, não", () => {
    expect(entregaEpiParaUso("perda")).toBe(false);
    expect(entregaEpiParaUso("dano")).toBe(false);
    expect(entregaEpiParaUso("devolucao")).toBe(false);
  });
});
