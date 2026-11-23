import { describe, it, expect } from "vitest";
import {
  previsaoDeEstoque, usoRealPorEpi, trocasRapidas, porDiaDaSemana, porHoraDoDia, filtrar,
  diasEntre, dataIso, type MovimentoEpi,
} from "./analiseEpi";

const HOJE = "2026-11-23";
const mov = (p: Partial<MovimentoEpi>): MovimentoEpi => ({
  funcionario_id: "f1", epi_id: "luva", quantidade: 1, data: "2026-11-01",
  created_at: "2026-11-01T10:00:00+00:00", tipo: "entrega", ...p,
});

describe("previsaoDeEstoque", () => {
  const epis = [
    { id: "luva", nome: "Luva", estoque: 30 },
    { id: "oculos", nome: "Óculos", estoque: 50 },
    { id: "bota", nome: "Bota", estoque: 0 },
    { id: "capacete", nome: "Capacete", estoque: 10 },
  ];
  // 90 luvas em 90 dias = 1/dia → 30 dias de estoque
  const movs = [
    ...Array.from({ length: 9 }, (_, i) => mov({ epi_id: "luva", quantidade: 10, data: `2026-10-${String(i + 1).padStart(2, "0")}` })),
    mov({ epi_id: "oculos", quantidade: 9, data: "2026-11-10" }),
    mov({ epi_id: "bota", quantidade: 2, data: "2026-11-10" }),
    mov({ epi_id: "luva", quantidade: 500, data: "2026-11-10", tipo: "devolucao" }),
    mov({ epi_id: "capacete", quantidade: 100, data: "2025-01-01" }),
  ];
  const r = previsaoDeEstoque(epis, movs, HOJE, 90);
  const de = (id: string) => r.find((x) => x.epi.id === id)!;

  it("dias = estoque ÷ consumo por dia", () => {
    expect(de("luva").dias).toBe(30);
    expect(de("luva").situacao).toBe("atencao");
    expect(de("oculos").dias).toBe(500);
    expect(de("oculos").situacao).toBe("ok");
  });
  it("devolução não conta como consumo", () => {
    expect(de("luva").consumo).toBe(90);
  });
  it("consumo de fora da janela não conta", () => {
    expect(de("capacete").situacao).toBe("sem_consumo");
    expect(de("capacete").dias).toBeNull();
  });
  it("estoque zerado vem primeiro", () => {
    expect(r[0].epi.id).toBe("bota");
    expect(de("bota").situacao).toBe("zerado");
  });
  it("estoque negativo conta como zero, não como dias negativos", () => {
    const [x] = previsaoDeEstoque([{ id: "luva", nome: "L", estoque: -237 }], movs, HOJE, 90);
    expect(x.dias).toBe(0);
    expect(x.situacao).toBe("zerado");
  });
  it("até 15 dias é crítico", () => {
    const [x] = previsaoDeEstoque([{ id: "luva", nome: "L", estoque: 15 }], movs, HOJE, 90);
    expect(x.situacao).toBe("critico");
  });
});

describe("uso real e trocas rápidas", () => {
  // 4 colegas trocam luva a cada 30 dias; f9 troca a cada 5
  const colegas = ["a", "b", "c", "d"].flatMap((f) =>
    ["2026-07-01", "2026-07-31", "2026-08-30"].map((data) => mov({ funcionario_id: f, data })));
  const rapido = ["2026-08-01", "2026-08-06", "2026-08-11"].map((data) => mov({ funcionario_id: "f9", data }));
  const movs = [...colegas, ...rapido];

  it("mede o intervalo entre entregas do mesmo EPI à mesma pessoa", () => {
    const [u] = usoRealPorEpi(movs);
    expect(u.amostras).toBe(10);
    expect(u.mediaDias).toBe(25); // (8 x 30 + 2 x 5) / 10
  });
  it("duas linhas no mesmo dia contam como uma entrega", () => {
    const u = usoRealPorEpi([mov({ data: "2026-01-01" }), mov({ data: "2026-01-01" }), mov({ data: "2026-01-31" })]);
    expect(u[0]).toMatchObject({ mediaDias: 30, amostras: 1 });
  });
  it("aponta quem troca muito mais rápido que os colegas", () => {
    const t = trocasRapidas(movs);
    expect(t.map((x) => x.funcionario_id)).toEqual(["f9"]);
    expect(t[0].mediaDias).toBe(5);
  });
  it("uma troca rápida só, isolada, não vira alarme", () => {
    const umaVez = ["2026-08-01", "2026-08-03"].map((data) => mov({ funcionario_id: "f8", data }));
    expect(trocasRapidas([...colegas, ...umaVez])).toEqual([]);
  });
  it("EPI com poucos dados não gera alarme", () => {
    const poucos = [...["2026-07-01", "2026-07-31"].map((data) => mov({ funcionario_id: "a", data })),
      ...["2026-08-01", "2026-08-02", "2026-08-03"].map((data) => mov({ funcionario_id: "f9", data }))];
    expect(trocasRapidas(poucos)).toEqual([]);
  });
  it("devolução não é troca", () => {
    const u = usoRealPorEpi([mov({ data: "2026-01-01" }), mov({ data: "2026-01-03", tipo: "devolucao" }), mov({ data: "2026-01-31" })]);
    expect(u[0].mediaDias).toBe(30);
  });
});

describe("dia da semana e hora", () => {
  it("conta unidades por dia da semana", () => {
    const r = porDiaDaSemana([mov({ data: "2026-11-23", quantidade: 3 }), mov({ data: "2026-11-23", tipo: "devolucao" })]);
    expect(r.find((x) => x.dia === "Seg")!.quantidade).toBe(3); // 23/11/2026 é segunda
    expect(r.reduce((s, x) => s + x.quantidade, 0)).toBe(3);
  });
  it("hora no fuso de Brasília, nos dois formatos de data", () => {
    const r = porHoraDoDia([
      mov({ created_at: "2026-11-18T13:25:08.72+00:00" }),
      mov({ created_at: "2026-11-18 10:05:00+00" }),
    ]);
    expect(r.find((x) => x.hora === "10h")!.quantidade).toBe(1);
    expect(r.find((x) => x.hora === "07h")!.quantidade).toBe(1);
  });
});

describe("filtros", () => {
  it("por período e por grupo de trabalhadores", () => {
    const movs = [mov({ data: "2026-10-01" }), mov({ data: "2026-11-20" }), mov({ data: "2026-11-21", funcionario_id: "f2" })];
    expect(filtrar(movs, { desde: "2026-11-01" })).toHaveLength(2);
    expect(filtrar(movs, { desde: "2026-11-01", funcionarios: new Set(["f2"]) })).toHaveLength(1);
    expect(filtrar(movs, {})).toHaveLength(3);
  });
  it("data do banco vira ISO que o Safari entende", () => {
    expect(dataIso("2026-11-18 10:05:00+00")).toBe("2026-11-18T10:05:00+00:00");
    expect(dataIso("2026-11-18T10:05:00.1+00:00")).toBe("2026-11-18T10:05:00.1+00:00");
  });
  it("diasEntre", () => {
    expect(diasEntre("2026-02-27", "2026-03-01")).toBe(2);
  });
});
