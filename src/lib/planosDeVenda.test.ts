import { describe, expect, it } from "vitest";
import {
  PLANOS, precoFormatado, linkDoWhatsapp, algumPrecoDefinido, totalMensal,
  descontoPercentual, CONTATO,
} from "./planosDeVenda";

/**
 * Página pública: o que estiver escrito aqui é oferta. Preço inventado
 * vira promessa que alguém vai cobrar.
 */

describe("o preço", () => {
  it("sai em reais, no formato brasileiro", () => {
    expect(precoFormatado(149.9)).toContain("149,90");
    expect(precoFormatado(1250)).toContain("1.250,00");
  });

  it("sem valor definido, devolve null — a página não inventa número", () => {
    expect(precoFormatado(null)).toBeNull();
    expect(precoFormatado(undefined)).toBeNull();
  });

  it("zero é um preço, e não 'sob consulta'", () => {
    /* Plano gratuito existe; confundir com "não definido" esconderia. */
    expect(precoFormatado(0)).toContain("0,00");
  });
});

describe("o botão de contato", () => {
  it("sem número cadastrado, não há link", () => {
    /* Botão que leva a lugar nenhum é pior que botão nenhum. */
    const original = CONTATO.whatsapp;
    CONTATO.whatsapp = "";
    try {
      expect(linkDoWhatsapp()).toBeNull();
      expect(linkDoWhatsapp(PLANOS[0])).toBeNull();
    } finally {
      CONTATO.whatsapp = original;
    }
  });

  it("o número cadastrado é discável: DDI 55, DDD e 9 dígitos", () => {
    /* Um dígito a menos no número e a página inteira vira enfeite. */
    expect(CONTATO.whatsapp, "falta cadastrar o WhatsApp").not.toBe("");
    expect(CONTATO.whatsapp).toMatch(/^55\d{2}9\d{8}$/);
  });

  it("com número, monta o link com a mensagem pronta", () => {
    const original = CONTATO.whatsapp;
    CONTATO.whatsapp = "55 (88) 99999-9999";
    const link = linkDoWhatsapp(PLANOS[0])!;
    expect(link).toContain("https://wa.me/5588999999999");
    expect(decodeURIComponent(link)).toContain(PLANOS[0].nome);
    CONTATO.whatsapp = original;
  });
});

describe("os planos", () => {
  it("a oferta de hoje é Gestão de EPIs", () => {
    /* O foco da página é um só; dois produtos dividem a atenção. */
    expect(PLANOS.length).toBe(1);
    expect(PLANOS[0].id).toBe("epi");
  });

  it("cada plano tem nome, público e o que inclui", () => {
    for (const p of PLANOS) {
      expect(p.nome, "plano sem nome").toBeTruthy();
      expect(p.publico, `${p.nome} sem público`).toBeTruthy();
      expect(p.inclui.length, `${p.nome} sem itens`).toBeGreaterThan(0);
    }
  });

  it("só um plano é destacado", () => {
    /* Dois destaques não destacam nada. */
    expect(PLANOS.filter((p) => p.destaque).length).toBeLessThanOrEqual(1);
  });

  it("ids não se repetem", () => {
    expect(new Set(PLANOS.map((p) => p.id)).size).toBe(PLANOS.length);
  });

  it("a página sabe quando nenhum preço foi definido", () => {
    expect(algumPrecoDefinido([{ ...PLANOS[0], precoPorVida: null }])).toBe(false);
    expect(algumPrecoDefinido([{ ...PLANOS[0], precoPorVida: 100 }])).toBe(true);
  });
});

describe("o desconto", () => {
  const base = { ...PLANOS[0] };

  it("sai da diferença entre os dois preços", () => {
    expect(descontoPercentual({ ...base, precoDe: 200, precoPorVida: 150 })).toBe(25);
  });

  it("sem os dois preços, não há desconto nenhum", () => {
    /*
     * Desconto calculado sobre preço inventado é a propaganda enganosa
     * mais comum da internet. Aqui ele simplesmente não aparece.
     */
    expect(descontoPercentual({ ...base, precoDe: null, precoPorVida: 150 })).toBeNull();
    expect(descontoPercentual({ ...base, precoDe: 200, precoPorVida: null })).toBeNull();
  });

  it("'de' menor ou igual ao 'por' não vira desconto", () => {
    expect(descontoPercentual({ ...base, precoDe: 100, precoPorVida: 150 })).toBeNull();
    expect(descontoPercentual({ ...base, precoDe: 150, precoPorVida: 150 })).toBeNull();
  });
});

describe("a conta por vida", () => {
  /*
   * O preço é por colaborador. Errar essa multiplicação é cobrar errado
   * do cliente ou prometer errado na página — os dois caros.
   */
  it("multiplica o preço pelas vidas", () => {
    expect(totalMensal(1)).toBe(2.5);
    expect(totalMensal(50)).toBe(125);
    expect(totalMensal(73)).toBe(182.5);
  });

  it("não arredonda centavo para cima nem para baixo", () => {
    const plano = { ...PLANOS[0], precoPorVida: 2.47 };
    expect(totalMensal(3, plano)).toBe(7.41);
  });

  it("número de vidas que não dá para cobrar não vira total", () => {
    expect(totalMensal(0)).toBeNull();
    expect(totalMensal(-10)).toBeNull();
    expect(totalMensal(1.5)).toBeNull();
    expect(totalMensal(NaN)).toBeNull();
    expect(totalMensal(100001)).toBeNull();
  });

  it("sem preço definido não há total", () => {
    expect(totalMensal(50, { ...PLANOS[0], precoPorVida: null })).toBeNull();
  });

  it("o preço de hoje é R$ 2,50 por vida", () => {
    /* Trava o combinado: mudar o valor sem querer quebra aqui. */
    expect(PLANOS[0].precoPorVida).toBe(2.5);
    expect(PLANOS[0].unidade).toContain("vida");
  });
});
