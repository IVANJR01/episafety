import { describe, it, expect } from "vitest";
import { paraNormalizado, paraCanvas, fatorParaCaber, type Traco } from "./tracosAssinatura";

/**
 * O caso do vídeo: assinatura feita em retrato, aparelho girado, e o traço
 * chegando cada vez menor até virar um borrão.
 */
const RETRATO = { l: 390, a: 700 };
const PAISAGEM = { l: 700, a: 390 };

/** Um traço qualquer, dentro do canvas de retrato. */
const traco = (pontos: [number, number][]): Traco[] => [
  { points: pontos.map(([x, y]) => ({ x, y, time: 0, pressure: 1 })) },
];

/** Maior distância entre dois pontos — serve de medida do tamanho do traço. */
function tamanho(dados: Traco[]): number {
  const ps = dados.flatMap((g) => (g.points || []) as { x: number; y: number }[]);
  let maior = 0;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      maior = Math.max(maior, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y));
    }
  }
  return maior;
}

/** Um giro: normaliza no tamanho atual e desenha no tamanho novo. */
const girar = (dados: Traco[], de: { l: number; a: number }, para: { l: number; a: number }) =>
  paraCanvas(paraNormalizado(dados, de.l, de.a), para.l, para.a);

describe("fatorParaCaber", () => {
  it("é 1 quando o traço cabe — girar não deve encolher à toa", () => {
    const n = paraNormalizado(traco([[100, 300], [290, 400]]), RETRATO.l, RETRATO.a);
    expect(fatorParaCaber(n, PAISAGEM.l, PAISAGEM.a)).toBe(1);
  });

  it("é menor que 1 só quando não cabe", () => {
    const n = paraNormalizado(traco([[20, 195], [680, 195]]), PAISAGEM.l, PAISAGEM.a);
    expect(fatorParaCaber(n, RETRATO.l, RETRATO.a)).toBeLessThan(1);
  });
});

describe("paraCanvas / paraNormalizado", () => {
  const original = traco([[100, 300], [200, 350], [290, 400]]);

  it("ida e volta no mesmo tamanho devolve o mesmo ponto", () => {
    const volta = paraCanvas(paraNormalizado(original, RETRATO.l, RETRATO.a), RETRATO.l, RETRATO.a);
    const ps = (volta[0].points || []) as { x: number; y: number }[];
    expect(ps[0].x).toBeCloseTo(100, 6);
    expect(ps[0].y).toBeCloseTo(300, 6);
    expect(ps[2].x).toBeCloseTo(290, 6);
    expect(ps[2].y).toBeCloseTo(400, 6);
  });

  it("girar NÃO muda o tamanho do traço — era isto que estava quebrado", () => {
    const antes = tamanho(original);
    const depois = tamanho(girar(original, RETRATO, PAISAGEM));
    expect(depois).toBeCloseTo(antes, 6);
  });

  it("encolher para caber e voltar recupera o traço inteiro", () => {
    // Assinatura larga feita em paisagem: em retrato ela não cabe e encolhe.
    // Voltando para paisagem tem de voltar ao tamanho de origem — é aqui que
    // a conta antiga acumulava perda e nunca mais devolvia.
    const largo = traco([[20, 195], [680, 195]]);
    const emRetrato = girar(largo, PAISAGEM, RETRATO);
    expect(tamanho(emRetrato)).toBeLessThan(tamanho(largo));

    const devolta = paraCanvas(paraNormalizado(largo, PAISAGEM.l, PAISAGEM.a), PAISAGEM.l, PAISAGEM.a);
    expect(tamanho(devolta)).toBeCloseTo(tamanho(largo), 6);
  });

  it("dez giros seguidos não encolhem nada", () => {
    // A conta antiga era min(nova/antiga) nos dois eixos, com o resultado
    // gravado por cima do original: 0,557 elevado ao número de giros. Dez
    // giros deixavam menos de 0,3% do traço.
    let atual = original;
    let de = RETRATO;
    for (let i = 0; i < 10; i++) {
      const para = de === RETRATO ? PAISAGEM : RETRATO;
      atual = girar(atual, de, para);
      de = para;
    }
    expect(tamanho(atual)).toBeCloseTo(tamanho(original), 4);
  });

  it("mantém o formato: não estica um eixo mais que o outro", () => {
    const largo = traco([[20, 340], [370, 360]]);
    const girado = girar(largo, RETRATO, PAISAGEM);
    const ps = (girado[0].points || []) as { x: number; y: number }[];
    const origPs = (largo[0].points || []) as { x: number; y: number }[];
    const razaoOriginal = Math.abs(origPs[1].x - origPs[0].x) / Math.abs(origPs[1].y - origPs[0].y);
    const razaoGirada = Math.abs(ps[1].x - ps[0].x) / Math.abs(ps[1].y - ps[0].y);
    expect(razaoGirada).toBeCloseTo(razaoOriginal, 6);
  });

  it("fica centralizado depois do giro", () => {
    const centrado = traco([[195 - 50, 350], [195 + 50, 350]]);
    const girado = girar(centrado, RETRATO, PAISAGEM);
    const ps = (girado[0].points || []) as { x: number; y: number }[];
    expect((ps[0].x + ps[1].x) / 2).toBeCloseTo(PAISAGEM.l / 2, 6);
    expect(ps[0].y).toBeCloseTo(PAISAGEM.a / 2, 6);
  });

  it("encolhe só quando não cabe, e o suficiente para caber", () => {
    // Traço ocupando quase toda a largura da paisagem (700). Virando para
    // retrato (390 de largura) ele não cabe: precisa encolher, mas continuar
    // inteiro dentro da tela.
    const largoNaPaisagem = traco([[20, 195], [680, 195]]);
    const girado = girar(largoNaPaisagem, PAISAGEM, RETRATO);
    const ps = (girado[0].points || []) as { x: number; y: number }[];
    for (const p of ps) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(RETRATO.l);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(RETRATO.a);
    }
    // Encostou nas duas bordas: encolheu o mínimo necessário, não mais.
    expect(Math.min(...ps.map((p) => p.x))).toBeCloseTo(0, 6);
    expect(Math.max(...ps.map((p) => p.x))).toBeCloseTo(RETRATO.l, 6);
  });

  it("preserva os outros campos do ponto (tempo e pressão)", () => {
    const n = paraNormalizado(original, RETRATO.l, RETRATO.a);
    const p = ((n[0].points || [])[0]) as any;
    expect(p.time).toBe(0);
    expect(p.pressure).toBe(1);
  });

  it("tamanho inválido devolve a entrada sem quebrar", () => {
    expect(paraCanvas(original, 0, 700)).toBe(original);
    expect(paraNormalizado(original, 390, Number.NaN)).toBe(original);
  });

  it("lista vazia e traço sem pontos não estouram", () => {
    expect(paraCanvas([], 390, 700)).toEqual([]);
    expect(paraNormalizado([{ points: undefined }], 390, 700)).toEqual([{ points: undefined }]);
  });
});
