import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A página de vendas é pública e é oferta: o que estiver escrito ali,
 * alguém vai cobrar. Preço que ninguém combinou não pode aparecer, e
 * botão que não leva a lugar nenhum é pior que botão nenhum.
 */

vi.mock("@/assets/logo-episafety.png", () => ({ default: "logo.png" }));
vi.mock("/marca/ficha-epi-exemplo.png", () => ({ default: "ficha.png" }));

const PLANO = {
  id: "epi", nome: "Gestão de EPIs",
  publico: "Para quem entrega EPI e precisa provar que entregou.",
  precoPorVida: null as number | null, precoDe: null as number | null,
  unidade: "por empresa / mês", destaque: true,
  inclui: ["Cadastro de EPI com consulta automática do CA"],
};

async function montar(plano: Record<string, unknown>, whatsapp = "") {
  /*
   * Sem isto, a segunda montagem do mesmo teste se soma à primeira no
   * body, e a página antiga responde pela nova — um teste assim passa
   * verde sem nunca ter conferido o caso novo.
   */
  cleanup();
  vi.resetModules();
  vi.doMock("@/lib/planosDeVenda", async () => {
    const real = await vi.importActual<any>("@/lib/planosDeVenda");
    const planos = [plano];
    return {
      ...real,
      PLANOS: planos,
      CONTATO: { ...real.CONTATO, whatsapp },
      algumPrecoDefinido: () => plano.precoPorVida != null,
      linkDoWhatsapp: (p?: any) => {
        const n = whatsapp.replace(/\D/g, "");
        return n ? `https://wa.me/${n}?text=${encodeURIComponent(p?.nome || "oi")}` : null;
      },
    };
  });
  const Planos = (await import("./Planos")).default;
  return render(<MemoryRouter><Planos /></MemoryRouter>);
}

const textoDaPagina = () => document.body.textContent || "";
const linksDeWhatsapp = () =>
  Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") || "")
    .filter((h) => h.includes("wa.me"));

describe("preço na página", () => {
  it("sem valor definido, não aparece nenhum valor em reais", async () => {
    await montar(PLANO);
    expect(textoDaPagina(), "apareceu um valor que ninguém definiu")
      .not.toMatch(/R\$\s?\d/);
    expect(screen.getAllByText("Sob consulta").length).toBeGreaterThan(0);
  });

  it("com valor definido, o valor aparece", async () => {
    await montar({ ...PLANO, precoPorVida: 199.9 });
    expect(textoDaPagina()).toMatch(/199,90/);
    expect(screen.queryByText("Sob consulta")).toBeNull();
  });

  it("sem preço, a página explica por que não há valor", async () => {
    await montar(PLANO);
    expect(textoDaPagina()).toContain("O valor é fechado no contato");
  });

  it("desconto só aparece quando os dois preços existem", async () => {
    await montar({ ...PLANO, precoPorVida: 150, precoDe: 200 });
    expect(textoDaPagina()).toContain("−25%");

    await montar({ ...PLANO, precoPorVida: 150, precoDe: null });
    expect(textoDaPagina(), "inventou um desconto sem preço de referência")
      .not.toMatch(/−\d+%/);
  });
});

describe("os botões", () => {
  it("sem WhatsApp cadastrado, nenhum link aponta para o wa.me", async () => {
    await montar(PLANO, "");
    expect(linksDeWhatsapp(), "link de WhatsApp sem número cadastrado").toEqual([]);
  });

  it("com WhatsApp, os botões levam o nome do plano na mensagem", async () => {
    await montar(PLANO, "55 88 99999-9999");
    const links = linksDeWhatsapp();
    expect(links.length, "nenhum botão de WhatsApp apareceu").toBeGreaterThan(0);
    expect(links.every((h) => h.includes("5588999999999"))).toBe(true);
    expect(links.some((h) => decodeURIComponent(h).includes("Gestão de EPIs"))).toBe(true);
  });

  it("a oferta está ao alcance em qualquer ponto da página", async () => {
    /* Quem decide no meio da leitura não deve ter de procurar o botão. */
    await montar(PLANO, "55 88 99999-9999");
    expect(linksDeWhatsapp().length).toBeGreaterThanOrEqual(3);
  });
});

describe("o foco da página", () => {
  it("fala de EPI, e não dos outros módulos", async () => {
    await montar(PLANO);
    const texto = textoDaPagina();
    expect(texto).toContain("Ficha");
    expect(texto).toContain("CA");
    for (const fora of ["PGR", "PCMSO", "LTCAT", "PPP"]) {
      expect(texto, `a página voltou a falar de ${fora}`).not.toContain(fora);
    }
  });

  it("mostra a ficha gerada pelo sistema, dizendo que os dados são fictícios", async () => {
    /* Imagem de produto sem essa ressalva vira promessa do que não é. */
    await montar(PLANO);
    expect(screen.getByAltText(/Ficha de EPI gerada pelo sistema/)).toBeTruthy();
    expect(textoDaPagina()).toContain("Dados fictícios");
  });
});

describe("o simulador de vidas", () => {
  /*
   * Vender por vida significa que ninguém sabe o próprio preço só de ler
   * "R$ 2,50". O simulador é o que transforma o preço em decisão.
   */
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("já abre com uma conta feita", async () => {
    await montar(comPreco, "5588996349359");
    const campo = screen.getByLabelText(/Quantos colaboradores/i) as HTMLInputElement;
    expect(campo.value).toBe("50");
    /* O pt-BR separa "R$" do número com espaço fixo, não com espaço comum. */
    expect(textoDaPagina(), "abriu sem mostrar o total de exemplo")
      .toMatch(/R\$\s125,00/);
  });

  it("muda o total quando o visitante muda o número", async () => {
    await montar(comPreco, "5588996349359");
    const campo = screen.getByLabelText(/Quantos colaboradores/i);
    fireEvent.change(campo, { target: { value: "200" } });
    /*
      * Olha só o resultado do simulador, não a página inteira: a primeira
      * dobra mostra "50 colaboradores = R$ 125,00" como exemplo fixo, e
      * ele continua lá de propósito depois de simular outro número.
      */
    const total = screen.getByTestId("total-simulado");
    expect(total.textContent).toMatch(/R\$\s500,00/);
    expect(total.textContent, "o total do simulador não acompanhou o número")
      .not.toMatch(/125,00/);
  });

  it("número impossível não vira R$ NaN na cara do cliente", async () => {
    await montar(comPreco, "5588996349359");
    fireEvent.change(screen.getByLabelText(/Quantos colaboradores/i), {
      target: { value: "0" },
    });
    expect(textoDaPagina()).not.toContain("NaN");
    expect(textoDaPagina()).toContain("informe de 1 a 100.000");
  });

  it("sem preço definido não existe simulador", async () => {
    await montar(PLANO);
    expect(screen.queryByLabelText(/Quantos colaboradores/i)).toBeNull();
  });
});

describe("a página não promete o que o sistema não faz", () => {
  /*
   * Página pública de venda é OFERTA: o que estiver escrito ali, o cliente
   * vai cobrar. A página dizia que "o sistema checa o CA na hora" e que
   * "impede a entrega de itens com validade expirada". Conferido no
   * código: o número do CA e a validade são cadastrados e saem impressos
   * na ficha, mas NADA checa, avisa ou bloqueia no momento da entrega.
   * Prometer barreira de segurança que não existe, para quem compra
   * justamente segurança, é o pior defeito que esta página podia ter.
   */
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("não diz que bloqueia entrega de EPI com CA vencido", async () => {
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect(texto, "voltou a prometer bloqueio de CA vencido")
      .not.toMatch(/impede a entrega/i);
    expect(texto, "voltou a prometer conferência de CA no ato")
      .not.toMatch(/checa o CA/i);
    expect(texto).not.toMatch(/verifica a situação do Certificado de Aprovação/i);
  });

  it("continua falando do CA pelo que ele realmente faz", async () => {
    /* Corrigir não é apagar: o CA cadastrado e impresso é um argumento real. */
    await montar(comPreco, "5588996349359");
    expect(textoDaPagina()).toMatch(/CA/);
  });
});

describe("o preço aparece antes de rolar a página", () => {
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("a primeira dobra mostra o valor e um exemplo pronto", async () => {
    /*
     * Preço por vida levanta sempre a mesma dúvida — "no meu caso dá
     * quanto?". Quem precisa rolar oito seções para descobrir não rola.
     */
    await montar(comPreco, "5588996349359");
    /*
      * Olha o bloco da primeira dobra, não a página toda: os mesmos valores
      * aparecem lá embaixo na oferta, então procurar no texto inteiro dava
      * teste verde mesmo com a primeira dobra sem preço nenhum.
      */
    const bloco = screen.getByTestId("preco-primeira-dobra");
    expect(bloco.textContent).toMatch(/R\$\s2,50/);
    expect(bloco.textContent, "sumiu o exemplo de 50 colaboradores da primeira dobra")
      .toMatch(/R\$\s125,00/);
    expect(bloco.getAttribute("href"), "o preço do topo não leva ao simulador")
      .toBe("#oferta");
  });

  it("sem preço definido, a primeira dobra não inventa valor", async () => {
    await montar(PLANO);
    expect(screen.queryByTestId("preco-primeira-dobra")).toBeNull();
    expect(textoDaPagina()).not.toMatch(/R\$\s?\d/);
  });
});

describe("os botões falam a mesma língua", () => {
  it("todo botão de contato diz a mesma coisa", async () => {
    /*
     * Eram cinco rótulos para a mesma ação ("Solicitar Demonstração",
     * "Testar no WhatsApp", "Conhecer a Safety Soluções"...). Cinco
     * promessas diferentes para o mesmo clique fazem hesitar, e hesitar
     * é não clicar.
     */
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    const rotulos = new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .filter((a) => (a.getAttribute("href") || "").includes("wa.me"))
        .map((a) => (a.textContent || "").trim()),
    );
    expect(rotulos.size, `rótulos diferentes: ${[...rotulos].join(" | ")}`).toBe(1);
  });
});

describe("título da aba", () => {
  it("a página põe o próprio nome na aba", async () => {
    /* O link desta página circula sozinho; a aba não pode dizer só "Sistema". */
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    expect(document.title).toContain("EPIs");
  });
});
