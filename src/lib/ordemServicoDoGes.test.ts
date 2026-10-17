import { describe, expect, it } from "vitest";
import {
  riscosDoInventarioParaOs, episDoInventario, medidasDoInventario,
  setorDoInventario, rotuloDoGes, funcoesSemRepetir, idOuPadrao,
  funcaoDoCargo, chaveDoCargo, selecaoPeloFuncionario,
} from "./ordemServicoDoGes";

/**
 * A Ordem de Serviço montada a partir do GES.
 *
 * A tela promete "riscos, EPIs e medidas são reaproveitados" e mostrava
 * "Riscos identificados (0)": lia `ghe_riscos`, que tem zero linhas em
 * todo o banco, enquanto os riscos reais estão no inventário do PGR.
 *
 * A OS em branco não é detalhe: a NR-01 exige que ela informe ao
 * trabalhador os riscos da função (1.4.1 "b" e 1.4.2).
 */

const ITENS = [
  {
    grupo: "ergonomico", tipo_agente: "Postura Inadequada",
    perigo_descricao: "Mobiliário; Computador", fonte_geradora: null,
    tipo_exposicao: "continua", lesoes: "Dores lombares, fadiga muscular",
    controles_existentes: ["Ajuste ergonômico de mesas/cadeiras"], setor: "ESCRITÓRIO",
  },
  {
    /* O mesmo agente, outro setor — no inventário é outra linha. */
    grupo: "ergonomico", tipo_agente: "Postura Inadequada",
    perigo_descricao: "Mobiliário; Computador", setor: "MARKETING",
  },
  {
    grupo: "fisico", tipo_agente: "Ruído contínuo", fonte_geradora: "Máquina de costura",
    epi: ["Protetor auricular tipo plug"], medidas_existentes: "Manutenção preventiva",
    lesoes: "PAIR", setor: "COSTURA",
  },
];

describe("riscos que entram na OS", () => {
  it("vêm do inventário do PGR, e não de uma tabela vazia", () => {
    expect(riscosDoInventarioParaOs(ITENS).length,
      "a OS continuou com zero riscos").toBeGreaterThan(0);
  });

  it("o mesmo agente em dois setores é um risco só", () => {
    const r = riscosDoInventarioParaOs(ITENS);
    expect(r.filter((x) => x.descricao === "Postura Inadequada").length).toBe(1);
  });

  it("sem fonte geradora, usa o perigo descrito em vez de deixar vazio", () => {
    /* Quase todo o inventário desta empresa está sem fonte geradora. */
    const r = riscosDoInventarioParaOs([ITENS[0]])[0];
    expect(r.fonte).toBe("Mobiliário; Computador");
  });

  it("item sem agente e sem perigo não vira risco", () => {
    expect(riscosDoInventarioParaOs([{ grupo: "fisico" }]).length).toBe(0);
  });

  it("leva lesões e exposição, que é o que a OS tem de informar", () => {
    const r = riscosDoInventarioParaOs([ITENS[0]])[0];
    expect(r.lesoes).toContain("Dores lombares");
    expect(r.exposicao).toBe("continua");
  });
});

describe("EPIs e medidas", () => {
  it("os EPIs do inventário entram na OS", () => {
    expect(episDoInventario(ITENS)).toEqual(["Protetor auricular tipo plug"]);
  });

  it("inventário sem EPI não inventa nenhum", () => {
    /* Nesta empresa só um item de trinta tem EPI preenchido. */
    expect(episDoInventario([ITENS[0]])).toEqual([]);
  });

  it("medidas saem uma por linha, das duas colunas que o banco usa", () => {
    const m = medidasDoInventario(ITENS);
    expect(m).toContain("Ajuste ergonômico");
    expect(m).toContain("Manutenção preventiva");
    expect(m.split("\n").length).toBe(2);
  });

  it("medida repetida não sai duas vezes", () => {
    const m = medidasDoInventario([ITENS[0], { ...ITENS[0] }]);
    expect(m.split("\n").length).toBe(1);
  });
});

describe("como o GES aparece na tela", () => {
  it("nome que só repete o código não vira '01 — 01'", () => {
    /* É o GES 01 desta empresa: código "01" e nome "01". */
    expect(rotuloDoGes({ codigo: "01", nome: "01" }, "PCP")).toBe("01 — PCP");
  });

  it("nome de verdade manda", () => {
    expect(rotuloDoGes({ codigo: "07", nome: "COSTURA" })).toBe("07 — COSTURA");
  });

  it("sem nome e sem setor, fica só o código", () => {
    /* O código já identifica o grupo; inventar um nome não ajudaria. */
    expect(rotuloDoGes({ codigo: "05", nome: "05" })).toBe("05");
    expect(rotuloDoGes({ codigo: "05" })).toBe("05");
  });

  it("o setor sai do inventário quando o GES não tem um", () => {
    expect(setorDoInventario(ITENS)).toBe("ESCRITÓRIO");
    expect(setorDoInventario([{ grupo: "fisico" }])).toBe("");
  });
});

describe("lista de funções do GES", () => {
  const FUNCOES = [
    { id: "a", nome_funcao: "Ajudante de Confecção" },
    { id: "b", nome_funcao: "Ajudante de Confecção" },
    { id: "c", nome_funcao: "Analista de PCP" },
    { id: "d", nome_funcao: "Analista de PCP " },
    { id: "e", nome_funcao: "Cronometrista" },
  ];

  it("nome repetido aparece uma vez só", () => {
    /*
     * O GES 01 tem dez vínculos e oito nomes: a lista mostrava "Ajudante
     * de Confecção" duas vezes e não havia como saber qual escolher.
     */
    expect(funcoesSemRepetir(FUNCOES).map((f) => f.nome_funcao))
      .toEqual(["Ajudante de Confecção", "Analista de PCP", "Cronometrista"]);
  });

  it("espaço sobrando não faz a função parecer outra", () => {
    expect(funcoesSemRepetir(FUNCOES).length).toBe(3);
  });

  it("função sem nome não entra na lista", () => {
    expect(funcoesSemRepetir([{ id: "x", nome_funcao: "  " }]).length).toBe(0);
  });
});

describe("id que chega torto na consulta", () => {
  it("evento de clique não vira id", () => {
    /*
     * `onClick={carregarDoGhe}` entregava o evento no lugar do id do GES,
     * e o usuário via "invalid input syntax for type uuid:
     * '[object Object]'" vindo do banco.
     */
    const evento = { type: "click", target: {} };
    expect(idOuPadrao(evento, "ges-1")).toBe("ges-1");
  });

  it("id de verdade passa", () => {
    expect(idOuPadrao("ges-2", "ges-1")).toBe("ges-2");
  });

  it("vazio, nulo e espaço caem no padrão", () => {
    expect(idOuPadrao("", "ges-1")).toBe("ges-1");
    expect(idOuPadrao(null, "ges-1")).toBe("ges-1");
    expect(idOuPadrao("   ", "ges-1")).toBe("ges-1");
  });

  it("sem padrão, devolve vazio — e quem chama decide avisar", () => {
    expect(idOuPadrao(undefined, null)).toBe("");
    expect(idOuPadrao({}, undefined)).toBe("");
  });
});

describe("a função do GES que casa com o cargo do funcionário", () => {
  const FUNCOES_GES = [
    { id: "a", nome_funcao: "COSTUREIRO(A)" },
    { id: "b", nome_funcao: "AUXILIAR DE PRODUÇÃO" },
    { id: "c", nome_funcao: "Vendedora" },
  ];

  it("acha o cargo apesar da grafia diferente", () => {
    /* O cadastro escreve "Costureiro(a)"; o GES, "COSTUREIRO(A)". */
    expect(funcaoDoCargo("Costureiro(a)", FUNCOES_GES)?.id).toBe("a");
  });

  it("acento não atrapalha", () => {
    expect(funcaoDoCargo("AUXILIAR DE PRODUCAO", FUNCOES_GES)?.id).toBe("b");
    expect(funcaoDoCargo("Auxiliar de Produção", FUNCOES_GES)?.id).toBe("b");
  });

  it("cargo que o GES não tem não casa com outro qualquer", () => {
    /* Pegar "a primeira parecida" poria o trabalhador na OS errada. */
    expect(funcaoDoCargo("MECÂNICO", FUNCOES_GES)).toBeNull();
  });

  it("sem cargo cadastrado, não escolhe função", () => {
    expect(funcaoDoCargo("", FUNCOES_GES)).toBeNull();
    expect(funcaoDoCargo(null, FUNCOES_GES)).toBeNull();
  });

  it("chaveDoCargo normaliza caixa, acento e pontuação", () => {
    expect(chaveDoCargo("Costureiro(a)")).toBe("costureiro a");
    expect(chaveDoCargo("COSTUREIRO(A)")).toBe("costureiro a");
  });
});

describe("escolher o funcionário preenche GES e função", () => {
  const FUNCOES_GES = [
    { id: "a", nome_funcao: "COSTUREIRO(A)" },
    { id: "b", nome_funcao: "AUXILIAR DE PRODUÇÃO" },
  ];
  const AMANDA = { nome: "AMANDA MARTINS ALVES", cargo: "Costureiro(a)", ghe_id: "ges-07" };

  it("traz o GES e a função do cadastro", () => {
    /*
     * O cadastro da AMANDA diz GHS/GES 07 — COSTURA e cargo
     * "Costureiro(a)". A OS pedia os dois de novo, e errar aí emite
     * documento com os riscos de outro grupo.
     */
    const r = selecaoPeloFuncionario(AMANDA, FUNCOES_GES);
    expect(r.gheId).toBe("ges-07");
    expect(r.funcaoId).toBe("a");
    expect(r.aviso).toBeNull();
  });

  it("funcionário sem GES no cadastro: avisa e não escolhe nada", () => {
    const r = selecaoPeloFuncionario({ nome: "FULANO", cargo: "Costureiro(a)", ghe_id: null }, FUNCOES_GES);
    expect(r.gheId).toBe("");
    expect(r.aviso?.titulo).toContain("sem GES");
  });

  it("cargo que não consta no GES não vira 'a função mais parecida'", () => {
    /* Isso poria o trabalhador numa OS com os riscos de outra função. */
    const r = selecaoPeloFuncionario({ ...AMANDA, cargo: "MECÂNICO" }, FUNCOES_GES);
    expect(r.gheId).toBe("ges-07");
    expect(r.funcaoId, "escolheu uma função que não é a do cargo").toBe("");
    expect(r.aviso?.titulo).toContain("não consta");
  });

  it("funcionário com GES e sem cargo entra pelo GES, calado", () => {
    const r = selecaoPeloFuncionario({ ...AMANDA, cargo: null }, FUNCOES_GES);
    expect(r.gheId).toBe("ges-07");
    expect(r.funcaoId).toBe("");
    expect(r.aviso).toBeNull();
  });

  it("sem funcionário, não mexe em nada", () => {
    const r = selecaoPeloFuncionario(null, FUNCOES_GES);
    expect(r).toEqual({ gheId: "", funcaoId: "", aviso: null });
  });
});
