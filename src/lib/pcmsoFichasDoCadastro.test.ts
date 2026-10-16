import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * As fichas de exame saem dos setores CADASTRADOS da empresa.
 *
 * Dois defeitos, nesta ordem, os dois impressos no documento do cliente:
 *
 *   v1_3 — uma lista de palavras-chave decidia o setor pelo nome do cargo e
 *          jogava no administrativo tudo que não casasse: 13 GES viraram 6
 *          fichas, com o CORTADOR e a máquina de costura no escritório.
 *   v1_4 — ao passar a usar o cadastro, o campo que chegava era o `setor_id`,
 *          e o documento imprimiu "01 — SETOR: 04F209F2-F0FF-4264-...".
 *
 * Este teste roda o carregador de verdade, com o banco de mentira, e confere
 * as fichas que saem.
 */

const TABELAS: Record<string, unknown[]> = {};

vi.mock("@/lib/emissorDocumentos", () => ({
  carregarEmissor: () => Promise.resolve({ nome: "SAFETY", cnpj: null, endereco: null }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (tabela: string) => {
    const resultado = () => Promise.resolve({ data: TABELAS[tabela] ?? [], error: null });
    const encadeavel: any = {
      select: () => encadeavel,
      eq: () => encadeavel,
      in: () => encadeavel,
      neq: () => encadeavel,
      or: () => encadeavel,
      is: () => encadeavel,
      not: () => encadeavel,
      gte: () => encadeavel,
      lte: () => encadeavel,
      filter: () => encadeavel,
      order: () => encadeavel,
      limit: () => encadeavel,
      single: () => Promise.resolve({ data: (TABELAS[tabela] ?? [])[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: (TABELAS[tabela] ?? [])[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => resultado().then(ok),
    };
    return encadeavel;
  };
  return { supabase: { from: (t: string) => consulta(t) } };
});

const { carregarPcmsoPdfContexto } = await import("./pcmsoPdfContextoLoader");

const SETOR_CORTE = "04f209f2-f0ff-4264-ac84-4e80aa1c57a2";
const SETOR_COSTURA = "1cd2f99b-7eb9-4e7b-b9c9-246658ba2bc8";
/*
 * ATELIER é o caso que separa as duas regras: nenhuma palavra-chave reconhece
 * "ATELIER" nem "MODELISTA/ESTILISTA", então o palpite mandaria o cargo para
 * ADMINISTRAÇÃO E GESTÃO. Só o cadastro dá a resposta certa — e sem este caso
 * o teste passaria mesmo com a regra antiga, por coincidência do exemplo.
 */
const SETOR_ATELIER = "2145df46-a138-45d6-93fa-3a8a7a02040c";

beforeEach(() => {
  for (const k of Object.keys(TABELAS)) delete TABELAS[k];
  TABELAS["pcmso_documentos"] = [{
    id: "p1", empresa_id: "e1", versao: 1, status: "vigente",
    data_emissao: "2026-06-30", data_vigencia_inicio: "2026-06-30",
    data_vigencia_fim: "2027-06-30", medico_nome: "Roger", medico_crm: "6353",
    medico_uf: "CE", pgr_base_id: null,
  }];
  TABELAS["empresa_config"] = [{
    id: "e1", nome: "LEONARDO A. DE ARAUJO LTDA", cnpj: "51.213.683/0001-04",
    cidade: "ALTO SANTO", uf: "CE", grau_risco: 1,
  }];
  TABELAS["sst_setores"] = [
    { id: SETOR_CORTE, nome: "CORTE" },
    { id: SETOR_COSTURA, nome: "COSTURA" },
    { id: SETOR_ATELIER, nome: "ATELIER" },
  ];
  TABELAS["sst_funcoes"] = [
    { id: "f1", nome: "CORTADOR", setor_id: SETOR_CORTE, cbo: "7632-05" },
    { id: "f2", nome: "COSTUREIRA", setor_id: SETOR_COSTURA, cbo: "7632-10" },
    { id: "f3", nome: "MODELISTA/ESTILISTA", setor_id: SETOR_ATELIER, cbo: "7628-05" },
  ];
});

describe("fichas de exame por setor cadastrado", () => {
  it("o CORTADOR fica no CORTE, e não no administrativo", async () => {
    const ctx = await carregarPcmsoPdfContexto("p1");
    const setores = ctx.fichasExame.map((f) => f.setor);

    expect(setores, "o setor cadastrado não virou ficha").toContain("CORTE");
    expect(
      ctx.fichasExame.find((f) => f.setor === "CORTE")?.funcoes,
      "o cortador não está na ficha do corte",
    ).toContain("CORTADOR");
    expect(
      ctx.fichasExame.find((f) => f.setor === "ADMINISTRAÇÃO E GESTÃO")?.funcoes ?? [],
      "o cortador voltou para o administrativo",
    ).not.toContain("CORTADOR");
  });

  it("nenhuma ficha é nomeada com um identificador interno", async () => {
    /* Foi exatamente isto que saiu impresso nas onze fichas do v1_4. */
    const ctx = await carregarPcmsoPdfContexto("p1");
    const comId = ctx.fichasExame.filter((f) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.setor),
    );
    expect(comId.map((f) => f.setor), "ficha nomeada com o id do setor").toEqual([]);
  });

  it("uma ficha por setor cadastrado", async () => {
    const ctx = await carregarPcmsoPdfContexto("p1");
    expect(ctx.fichasExame.map((f) => f.setor).sort())
      .toEqual(["ATELIER", "CORTE", "COSTURA"]);
  });

  it("setor que nenhuma palavra-chave reconhece vira ficha do mesmo jeito", async () => {
    /*
     * ATELIER não está em lista nenhuma do código. Só existe porque está
     * cadastrado — é o caso que prova que manda o cadastro, e não o palpite.
     */
    const ctx = await carregarPcmsoPdfContexto("p1");
    const atelier = ctx.fichasExame.find((f) => f.setor === "ATELIER");
    expect(atelier, "o setor cadastrado não virou ficha").toBeTruthy();
    expect(atelier!.funcoes).toContain("MODELISTA/ESTILISTA");
    expect(
      ctx.fichasExame.find((f) => f.setor === "ADMINISTRAÇÃO E GESTÃO"),
      "o palpite criou um setor administrativo que não existe no cadastro",
    ).toBeUndefined();
  });

  it("a ficha leva o número do GES, e as fichas saem na ordem dos GES", async () => {
    /*
     * O setor CORTE é o GES 08 no PGR e saía como ficha 01 no PCMSO, porque a
     * numeração seguia a ordem interna do gerador. Quem põe os dois
     * documentos lado a lado não achava o grupo.
     */
    TABELAS["sst_ges"] = [
      { id: "g08", codigo: "08", nome: "CORTE" },
      { id: "g07", codigo: "07", nome: "COSTURA" },
      { id: "g06", codigo: "06", nome: "ATELIER" },
    ];
    TABELAS["ghe_ges"] = TABELAS["sst_ges"];
    TABELAS["ghe_setores"] = [
      { ghe_id: "g08", setor_id: SETOR_CORTE },
      { ghe_id: "g07", setor_id: SETOR_COSTURA },
      { ghe_id: "g06", setor_id: SETOR_ATELIER },
    ];

    const ctx = await carregarPcmsoPdfContexto("p1");
    const fichas = ctx.fichasExame as { numero: string; setor: string }[];

    expect(fichas.map((f) => f.setor), "as fichas não seguem a ordem dos GES")
      .toEqual(["ATELIER", "COSTURA", "CORTE"]);
    expect(fichas.map((f) => f.numero), "a ficha não leva o número do GES")
      .toEqual(["06", "07", "08"]);
  });

  it("função sem setor cadastrado ainda entra em alguma ficha", async () => {
    TABELAS["sst_funcoes"] = [
      ...(TABELAS["sst_funcoes"] as unknown[]),
      { id: "f3", nome: "AUXILIAR ADMINISTRATIVO", setor_id: null, cbo: "4110-10" },
    ];
    const ctx = await carregarPcmsoPdfContexto("p1");
    const todas = ctx.fichasExame.flatMap((f) => f.funcoes);
    expect(todas, "a função sem setor sumiu do documento")
      .toContain("AUXILIAR ADMINISTRATIVO");
  });
});
