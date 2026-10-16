import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * O PCMSO não acrescenta risco nenhum ao que está no PGR.
 *
 * O PGR é a fonte: ele inventaria os perigos e os avalia. O PCMSO diz quais
 * exames médicos acompanham aquelas exposições. Um PCMSO que lista exposição
 * que o inventário não reconhece contradiz o documento que deveria refletir —
 * e é o médico que assina embaixo.
 *
 * O carregador fazia o contrário em três lugares:
 *
 *   1. injetava riscos "preventivos" por palavra no nome do cargo, quando o
 *      inventário não trazia nenhum daquele grupo ("costureira" ganhava
 *      "Cortes / Perfurações — Máquinas de costura");
 *   2. empresa sem função cadastrada recebia uma lista fixa de cargos e
 *      riscos, copiada de um documento modelo de outra empresa;
 *   3. casava o cargo com o inventário por "contém", então "AJUDANTE"
 *      herdava os riscos de "AJUDANTE DE CONFECÇÃO".
 *
 * Os três somavam riscos. Este arquivo existe para que não voltem.
 */

const TABELAS: Record<string, unknown[]> = {};

vi.mock("@/lib/emissorDocumentos", () => ({
  carregarEmissor: () => Promise.resolve({ nome: "SAFETY", cnpj: null, endereco: null }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const resultado = () => Promise.resolve({ data: TABELAS[tabela] ?? [], error: null });
    const e: any = {
      select: () => e, eq: () => e, in: () => e, neq: () => e, or: () => e,
      is: () => e, not: () => e, gte: () => e, lte: () => e, filter: () => e,
      order: () => e, limit: () => e,
      single: () => Promise.resolve({ data: (TABELAS[tabela] ?? [])[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: (TABELAS[tabela] ?? [])[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => resultado().then(ok),
    };
    return e;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

const { carregarPcmsoPdfContexto } = await import("./pcmsoPdfContextoLoader");

const SETOR_COSTURA = "1cd2f99b-7eb9-4e7b-b9c9-246658ba2bc8";
const SETOR_CORTE = "2145df46-a138-45d6-93fa-3a8a7a02040c";

/** Todos os agentes que saíram nas fichas, de todos os grupos. */
function agentesDasFichas(ctx: { fichasExame: Record<string, unknown>[] }): string[] {
  const grupos = [
    "riscosFisicos", "riscosQuimicos", "riscosBiologicos",
    "riscosErgonomicos", "riscosAcidentes",
  ];
  return ctx.fichasExame
    .flatMap((f) => grupos.flatMap((g) => (f[g] as { agente: string }[]) || []))
    .map((r) => r.agente)
    .filter((a) => a !== "Ausência de Fator de Risco");
}

beforeEach(() => {
  for (const k of Object.keys(TABELAS)) delete TABELAS[k];
  TABELAS["pcmso_documentos"] = [{
    id: "p1", empresa_id: "e1", versao: 1, status: "vigente",
    data_emissao: "2026-06-30", pgr_base_id: "pgr1",
  }];
  TABELAS["empresa_config"] = [{ id: "e1", nome: "EMPRESA TESTE", grau_risco: 1 }];
  TABELAS["sst_setores"] = [
    { id: SETOR_COSTURA, nome: "COSTURA" },
    { id: SETOR_CORTE, nome: "CORTE" },
  ];
});

describe("o PCMSO espelha o PGR", () => {
  it("cargo de costura SEM risco no inventário não ganha risco inventado", async () => {
    /*
     * "costureira" casava com a regra que injetava "Cortes / Perfurações —
     * Máquinas de costura". O inventário aqui está vazio: a ficha tem de sair
     * dizendo que não há fator de risco, e não inventando um.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "COSTUREIRA", setor_id: SETOR_COSTURA, cbo: "7632-10" },
    ];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    expect(agentesDasFichas(ctx as never), "o PCMSO inventou risco que o PGR não tem")
      .toEqual([]);
  });

  it("escritório e limpeza também não ganham riscos de brinde", async () => {
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "AUXILIAR DE ESCRITÓRIO", setor_id: null },
      { id: "f2", nome: "AUXILIAR DE LIMPEZA", setor_id: null },
      { id: "f3", nome: "COZINHEIRA", setor_id: null },
    ];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    expect(agentesDasFichas(ctx as never)).toEqual([]);
  });

  it("empresa sem função cadastrada não recebe a empresa de outra pessoa", async () => {
    /* Era uma confecção inteira, fixa no código: AJUDANTE, COSTUREIRA, CORTADOR. */
    TABELAS["sst_funcoes"] = [];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const funcoes = (ctx.fichasExame as { funcoes: string[] }[]).flatMap((f) => f.funcoes);
    expect(funcoes, "apareceram cargos que ninguém cadastrou").toEqual([]);
    expect(agentesDasFichas(ctx as never)).toEqual([]);
  });

  it("todo risco impresso existe no inventário do PGR", async () => {
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "COSTUREIRA", setor_id: SETOR_COSTURA },
    ];
    TABELAS["pgr_inventario_itens"] = [{
      id: "i1", grupo: "ergonomico", tipo_agente: "Movimentos repetitivos",
      perigo_descricao: "Costura contínua", fonte_geradora: "Máquina de costura",
      lesoes: "LER/DORT", funcoes_snapshot: ["COSTUREIRA"],
      probabilidade: 4, severidade: 3, setor: "COSTURA",
    }];

    const ctx = await carregarPcmsoPdfContexto("p1");
    expect(agentesDasFichas(ctx as never)).toEqual(["Movimentos repetitivos"]);
  });

  it("não inventa a descrição das atividades de quem não cadastrou", async () => {
    /*
     * Havia um texto por palavra no nome do cargo: a costureira sem cadastro
     * recebia "Operar máquinas de costura, acabamento de peças, movimentação
     * manual de tecidos" — a rotina de outra empresa, e é a descrição das
     * atividades que fundamenta o enquadramento de risco.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "COSTUREIRA", setor_id: SETOR_COSTURA, descricao_atividades: null },
    ];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const costureira = (ctx.cargos as { nome: string; atividades: string }[])
      .find((c) => c.nome === "COSTUREIRA");
    expect(costureira?.atividades || "", "inventou a rotina do cargo").toBe("");
  });

  it("a descrição cadastrada continua saindo", async () => {
    TABELAS["sst_funcoes"] = [{
      id: "f1", nome: "COSTUREIRA", setor_id: SETOR_COSTURA,
      descricao_atividades: "Costura das peças do pedido, conferência e acabamento.",
    }];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const costureira = (ctx.cargos as { nome: string; atividades: string }[])
      .find((c) => c.nome === "COSTUREIRA");
    expect(costureira?.atividades).toContain("Costura das peças do pedido");
  });

  it("exame complementar sai do risco, não do nome do cargo", async () => {
    /*
     * "cozinh" ganhava Glicemia e Hemograma; "corte" ganhava Audiometria,
     * mesmo sem ruído nenhum no inventário. Prescrever exame pelo texto do
     * cargo não é critério médico.
     */
    /*
     * "AUXILIAR DE CORTE" contém a palavra que a regra antiga procurava —
     * "CORTADOR" não continha, e por isso escapava dela. O teste precisa do
     * cargo que a regra pegava, senão passa sem provar nada.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "AUXILIAR DE CORTE", setor_id: SETOR_COSTURA },
      { id: "f2", nome: "COZINHEIRA", setor_id: null },
      { id: "f3", nome: "AUXILIAR DE LIMPEZA", setor_id: null },
    ];
    TABELAS["pgr_inventario_itens"] = [];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const exames = (ctx.cargos as { examesComplementares: unknown[] }[])
      .flatMap((c) => c.examesComplementares);
    expect(exames, "prescreveu exame por palavra no nome do cargo").toEqual([]);
  });

  it("com ruído no inventário, a audiometria aparece — NR-07, Anexo II", async () => {
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "OPERADOR DE PRENSA", setor_id: SETOR_COSTURA },
    ];
    TABELAS["pgr_inventario_itens"] = [{
      id: "i1", grupo: "fisico", tipo_agente: "Ruído contínuo",
      fonte_geradora: "Prensa", lesoes: "PAIR",
      funcoes_snapshot: ["OPERADOR DE PRENSA"],
      probabilidade: 4, severidade: 3, setor: "COSTURA",
    }];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const exames = (ctx.cargos as { examesComplementares: { nome: string }[] }[])
      .flatMap((c) => c.examesComplementares);
    expect(exames.map((e) => e.nome), "o ruído do PGR não gerou audiometria")
      .toContain("Audiometria Tonal e Vocal");
  });

  it("exame clínico: anual com exposição, bienal sem — NR-07, 7.5.8, II", async () => {
    /*
     * "a) para empregados expostos a riscos ocupacionais identificados e
     * classificados no PGR (...) a cada ano"; "b) para os demais empregados,
     * o exame clínico deve ser realizado a cada dois anos."
     *
     * A ficha dizia "Anual" para todo setor, inclusive os que saem com
     * "Ausência de Fator de Risco" nos cinco grupos — contradizendo a seção
     * 08 do próprio documento, que transcreve a regra bienal.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "COSTUREIRA", setor_id: SETOR_COSTURA },
      { id: "f2", nome: "AUXILIAR DE ESCRITÓRIO", setor_id: SETOR_CORTE },
    ];
    TABELAS["pgr_inventario_itens"] = [{
      id: "i1", grupo: "ergonomico", tipo_agente: "Movimentos repetitivos",
      fonte_geradora: "Máquina de costura", lesoes: "LER/DORT",
      funcoes_snapshot: ["COSTUREIRA"], setor: "COSTURA",
      probabilidade: 3, severidade: 3,
    }];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const clinico = (setor: string) =>
      (ctx.fichasExame as { setor: string; exames: { codigo: string; periodico: string }[] }[])
        .find((f) => f.setor === setor)?.exames.find((e) => e.codigo === "0295")?.periodico;

    expect(clinico("COSTURA"), "setor com exposição deveria ser anual").toBe("Anual");
    expect(clinico("CORTE"), "setor sem exposição continua pedindo exame anual")
      .toBe("Bienal");
  });

  it("a mesma função em dois setores não mistura os riscos", async () => {
    /*
     * O caso real: "Ajudante de Confecção" está cadastrado sete vezes nesta
     * empresa, uma por setor. Agrupados pelo nome, os sete viravam um cargo
     * que recolhia os riscos dos sete setores e caía numa ficha só — a ficha
     * do CORTE saía com seis riscos ergonômicos e quatro de acidentes,
     * enquanto o PGR dá ao CORTE um unico risco de acidente.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "AJUDANTE DE CONFECÇÃO", setor_id: SETOR_CORTE },
      { id: "f2", nome: "AJUDANTE DE CONFECÇÃO", setor_id: SETOR_COSTURA },
    ];
    TABELAS["pgr_inventario_itens"] = [
      {
        id: "i1", grupo: "acidente", tipo_agente: "Cortes / Partes móveis",
        fonte_geradora: "Máquinas de corte", lesoes: "Cortes, amputações",
        funcoes_snapshot: ["Ajudante de Confecção"], setor: "CORTE",
        probabilidade: 4, severidade: 3,
      },
      {
        id: "i2", grupo: "ergonomico", tipo_agente: "Movimentos repetitivos",
        fonte_geradora: "Máquina de costura", lesoes: "LER/DORT",
        funcoes_snapshot: ["Ajudante de Confecção"], setor: "COSTURA",
        probabilidade: 3, severidade: 3,
      },
      {
        id: "i3", grupo: "ergonomico", tipo_agente: "Postura inadequada",
        fonte_geradora: "Mobiliário", lesoes: "Lombalgia",
        funcoes_snapshot: ["Ajudante de Confecção"], setor: "COSTURA",
        probabilidade: 2, severidade: 2,
      },
    ];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const ficha = (s: string) =>
      (ctx.fichasExame as { setor: string }[]).find((f) => f.setor === s) as never as
        Record<string, { agente: string }[]>;

    const agentes = (setor: string, grupo: string) =>
      (ficha(setor)[grupo] || []).map((r) => r.agente)
        .filter((a) => a !== "Ausência de Fator de Risco");

    expect(agentes("CORTE", "riscosAcidentes"), "o corte perdeu o risco dele")
      .toEqual(["Cortes / Partes móveis"]);
    expect(agentes("CORTE", "riscosErgonomicos"), "o CORTE recebeu os riscos da COSTURA")
      .toEqual([]);
    expect(agentes("COSTURA", "riscosErgonomicos").sort())
      .toEqual(["Movimentos repetitivos", "Postura inadequada"]);
    expect(agentes("COSTURA", "riscosAcidentes"), "a COSTURA recebeu o risco do CORTE")
      .toEqual([]);
  });

  it("um cargo não herda os riscos de outro de nome parecido", async () => {
    /*
     * A comparação era por "contém": "AJUDANTE" casava com o item cujo
     * snapshot dizia "AJUDANTE DE CONFECÇÃO", e o PCMSO dava ao ajudante uma
     * exposição que o PGR não dá a ele.
     */
    TABELAS["sst_funcoes"] = [
      { id: "f1", nome: "AJUDANTE", setor_id: SETOR_COSTURA },
      { id: "f2", nome: "AJUDANTE DE CONFECÇÃO", setor_id: SETOR_COSTURA },
    ];
    TABELAS["pgr_inventario_itens"] = [{
      id: "i1", grupo: "acidente", tipo_agente: "Cortes / Partes móveis",
      fonte_geradora: "Máquina de corte", lesoes: "Cortes",
      funcoes_snapshot: ["AJUDANTE DE CONFECÇÃO"],
      probabilidade: 4, severidade: 4, setor: "COSTURA",
    }];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const cargos = ctx.cargos as { nome: string; riscosAcidentes: unknown[] }[];
    const ajudante = cargos.find((c) => c.nome === "AJUDANTE");
    const confeccao = cargos.find((c) => c.nome === "AJUDANTE DE CONFECÇÃO");

    expect(confeccao?.riscosAcidentes, "o cargo do inventário ficou sem o risco dele")
      .toHaveLength(1);
    expect(ajudante?.riscosAcidentes, "o AJUDANTE herdou o risco do AJUDANTE DE CONFECÇÃO")
      .toEqual([]);
  });
});
