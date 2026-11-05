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
vi.mock("/marca/mobile-entregas-real.png", () => ({ default: "tela.png" }));
vi.mock("/marca/tela-estoque-epis.png", () => ({ default: "estoque.png" }));
vi.mock("/marca/tela-conferencia-publica.png", () => ({ default: "conferencia.png" }));

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
    expect(textoDaPagina()).toMatch(/dados fict[ií]cios/i);
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
    /*
      * O botão flutuante do celular é só o ícone, então o nome dele está no
      * aria-label — que é justamente o que o leitor de tela anuncia.
      */
    const rotulos = new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .filter((a) => (a.getAttribute("href") || "").includes("wa.me"))
        .map((a) => ((a.textContent || "").trim() || a.getAttribute("aria-label") || "").trim()),
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

describe("o print do celular é tela de verdade", () => {
  /*
   * A imagem anterior era um mockup desenhado: aparecia um celular com
   * "CA: 43910 - Aprovado e Válido" e uma assinatura em letra cursiva que
   * o sistema não produz. Pior, ela repetia em forma de imagem a mesma
   * promessa de conferência de CA que foi retirada do texto — corrigir só
   * as palavras teria deixado a mentira no desenho.
   *
   * Agora é um print do sistema rodando no celular, com os nomes dos
   * colaboradores e da empresa trocados por fictícios: dado pessoal de
   * terceiro não vai para página pública.
   */
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("a página avisa que os nomes do print são fictícios", async () => {
    await montar(comPreco, "5588996349359");
    expect(textoDaPagina(), "sumiu o aviso de que os nomes foram trocados")
      .toMatch(/nomes trocados por fict/i);
  });

  it("as duas imagens têm descrição para quem não enxerga", async () => {
    await montar(comPreco, "5588996349359");
    const alts = Array.from(document.querySelectorAll("img"))
      .map((i) => i.getAttribute("alt") || "");
    expect(alts.some((a) => /ficha/i.test(a)), "a ficha ficou sem alt").toBe(true);
    expect(alts.some((a) => /entregas de EPI/i.test(a)), "o print ficou sem alt")
      .toBe(true);
    expect(alts.every((a) => a.length > 0), "alguma imagem ficou sem alt").toBe(true);
  });

  it("não sobrou nenhuma afirmação de CA 'aprovado e válido'", async () => {
    await montar(comPreco, "5588996349359");
    expect(textoDaPagina()).not.toMatch(/aprovado e v[áa]lido/i);
  });
});

describe("as seções que decidem a compra", () => {
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("os três pilares estão na página, cada um com o seu custo de não ter", async () => {
    /*
     * A página listava recursos demais e nenhum ficava. Estes três são o
     * que o comprador precisa levar embora da leitura.
     */
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    /* O pilar 01 virou a promessa forte quando o sistema passou a cumpri-la. */
    /* A promessa do pilar 01: o sistema recusa a entrega, não só registra. */
    expect(texto).toMatch(/recusa a entrega se estiver vencido/i);
    expect(texto).toMatch(/assinatura de quem recebeu/i);
    expect(texto).toMatch(/ficha individual em PDF/i);
  });

  it("a página responde quem cuida dos dados do colaborador", async () => {
    /* Quem compra para a empresa pergunta isso antes de assinar. */
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect(texto).toMatch(/Segurança e proteção de dados/i);
    expect(texto).toMatch(/Cada empresa vê só o que é dela/i);
    expect(texto).toMatch(/[Bb]ackup/);
  });

  it("o FAQ cobre as perguntas que travam a decisão", async () => {
    await montar(comPreco, "5588996349359");
    /*
      * Só dentro do FAQ. Procurar na página inteira dava verde mesmo com a
      * pergunta apagada, porque as mesmas palavras aparecem nos recursos.
      */
    const faq = screen.getByTestId("lista-faq").textContent || "";
    for (const assunto of [
      /como é feita uma entrega/i,
      /conferência do CA/i,
      /colaborador assina/i,
      /histórico/i,
      /controle de estoque/i,
      /contratação/i,
    ]) {
      expect(faq, `o FAQ não responde ${assunto}`).toMatch(assunto);
    }
  });

  it("não cita número de item da NR que pode estar desatualizado", async () => {
    /*
     * A resposta citava "item 6.6.1, alínea h" — numeração anterior à
     * revisão da NR-06. Errar o número da norma numa página vendida para
     * técnico de segurança custa mais credibilidade do que o número dá.
     * O conteúdo da regra continua: livro, ficha OU sistema eletrônico.
     */
    await montar(comPreco, "5588996349359");
    expect(textoDaPagina()).not.toMatch(/6\.6\.1/);
    expect(textoDaPagina()).toMatch(/sistema eletrônico/i);
  });
});

describe("a página não inventa prova social", () => {
  it("a seção de depoimentos não aparece enquanto estiver vazia", async () => {
    /*
     * A estrutura existe e fica pronta: no dia em que houver um cliente
     * real autorizando, é uma linha. Até lá a seção não ocupa espaço com
     * título sem conteúdo embaixo.
     */
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    expect(document.querySelector("#depoimentos"),
      "apareceu seção de depoimentos sem depoimento nenhum").toBeNull();
    expect(textoDaPagina()).not.toMatch(/O que dizem os técnicos/i);
  });

  it("não há depoimento assinado por cliente nenhum", async () => {
    /*
     * Depoimento inventado é o jeito mais rápido de perder a venda e de
     * criar problema jurídico. Enquanto não houver cliente real querendo
     * aparecer, a página não finge que tem.
     */
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    const texto = textoDaPagina();
    expect(texto).not.toMatch(/depoimento/i);
    expect(texto, "apareceu aspas de cliente fictício").not.toMatch(/—\s*(Diretor|Gerente|Eng\.|Técnico)\s+de/i);
  });
});

describe("a promessa da página e o sistema andam juntos", () => {
  /*
   * Este teste existe porque o problema já aconteceu: a página prometia
   * conferência de CA meses antes de o sistema conferir qualquer coisa.
   * Agora que ela voltou a prometer, a promessa fica amarrada ao código
   * que a cumpre — mexer num lado sem o outro quebra aqui.
   */
  it("se a página diz que recusa CA vencido, o sistema recusa mesmo", async () => {
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    const prometeBloqueio = /recusa a entrega se estiver vencido/i.test(textoDaPagina());

    const { episComCaVencido } = await import("@/lib/validadeDoCa");
    const recusados = episComCaVencido(
      [{ epi: { nome: "LUVA", validade: "2020-01-01" } }],
      "entrega",
      "2026-11-03",
    );

    expect(
      prometeBloqueio && recusados.length === 1,
      prometeBloqueio
        ? "a página promete recusar CA vencido, e o sistema deixou passar"
        : "o sistema recusa CA vencido e a página deixou de dizer isso",
    ).toBe(true);
  });
});

describe("as telas do sistema na página", () => {
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it("mostra estoque e conferência pública, e diz que não é desenho", async () => {
    /*
     * "O sistema controla EPI" não vende; ver a tela vende. As duas
     * imagens saem do próprio código do sistema — uma renderizada com
     * dados inventados, a outra é a página pública como está no ar.
     */
    await montar(comPreco, "5588996349359");
    const alts = Array.from(document.querySelectorAll("img"))
      .map((i) => i.getAttribute("alt") || "");
    expect(alts.some((a) => /cadastro de EPIs/i.test(a)), "faltou a tela de estoque")
      .toBe(true);
    expect(alts.some((a) => /verificação de ficha/i.test(a)), "faltou a conferência")
      .toBe(true);
    expect(textoDaPagina()).toMatch(/não um desenho/i);
  });

  it("toda imagem de tela declara que o dado é fictício ou é pública", async () => {
    /*
     * Regra da página inteira: nenhuma imagem passa por dado de cliente
     * sem avisar. Quatro imagens hoje — ficha, celular, estoque e a
     * página pública.
     */
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect((texto.match(/fict/gi) || []).length,
      "alguma imagem ficou sem o aviso de dado fictício")
      .toBeGreaterThanOrEqual(3);
    expect(texto).toMatch(/página pública do sistema/i);
  });
});

describe("as regras de escrita da página", () => {
  /*
   * A página estava com cara de texto de modelo: título dramático,
   * negrito em tudo e a mesma ideia repetida em seções diferentes. Estas
   * verificações existem para ela não voltar a engordar sozinha.
   */
  const comPreco = { ...PLANO, precoPorVida: 2.5, unidade: "por vida / mês" };

  it('a palavra "offline" aparece no máximo 3 vezes', async () => {
    await montar(comPreco, "5588996349359");
    const vezes = (textoDaPagina().match(/offline/gi) || []).length;
    expect(vezes, `apareceu ${vezes} vezes`).toBeLessThanOrEqual(3);
  });

  it("nenhum número de prova social inventado", async () => {
    /* "0 fichas de papel perdidas" é slogan, não dado — e parece dado. */
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect(texto).not.toMatch(/fichas de papel perdidas/i);
    expect(texto).not.toMatch(/entregas com CA vencido/i);
  });

  it("some com as frases de modelo que o cliente pediu para tirar", async () => {
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect(texto).not.toMatch(/torne seu controle de EPI mais eficiente/i);
    expect(texto).not.toMatch(/ficha de EPI digitalizada sempre acess/i);
    expect(texto).not.toMatch(/pastas empoeiradas|risco iminente|solução completa/i);
  });

  it("no máximo 3 botões de WhatsApp fixos, mais o flutuante do celular", async () => {
    /*
     * Botão repetido em toda seção cansa e some no meio do texto. Ficam
     * três — cabeçalho, preços e fecho — e o flutuante no celular.
     */
    await montar(comPreco, "5588996349359");
    expect(linksDeWhatsapp().length).toBeLessThanOrEqual(4);
  });

  it("o menu do topo cabe numa linha: no máximo 6 itens", async () => {
    await montar(comPreco, "5588996349359");
    const itens = document.querySelectorAll("nav a");
    expect(itens.length, "o menu voltou a crescer").toBeLessThanOrEqual(6);
    for (const a of Array.from(itens)) {
      expect(a.className, `"${a.textContent}" pode quebrar linha`)
        .toContain("whitespace-nowrap");
    }
  });

  it("o comparativo é uma tabela de 3 linhas", async () => {
    await montar(comPreco, "5588996349359");
    const linhas = document.querySelectorAll("table tbody tr");
    expect(linhas).toHaveLength(3);
    const texto = textoDaPagina();
    for (const caso of [/Fiscalização/, /Processo trabalhista/, /Balcão do almoxarifado/]) {
      expect(texto).toMatch(caso);
    }
  });

  it("a seção das seis dores saiu da página", async () => {
    await montar(comPreco, "5588996349359");
    expect(textoDaPagina()).not.toMatch(/arquivo morto|desespero às vésperas/i);
  });

  it("a grade de recursos tem 6 cards, não 8", async () => {
    await montar(comPreco, "5588996349359");
    const texto = textoDaPagina();
    expect(texto).toMatch(/Conferência do CA/);
    expect(texto).not.toMatch(/Relatórios de Consumo e Custos/);
  });
});

describe('a seção "Quem está por trás"', () => {
  it("não aparece enquanto não houver nome de verdade", async () => {
    /*
     * É o bloco que mais vende num negócio pequeno — e o único que eu não
     * posso escrever: quem é a pessoa, há quantos anos e por quê.
     */
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    expect(document.querySelector("#quem-somos")).toBeNull();
    expect(textoDaPagina()).not.toMatch(/Sou\s*,|Criei a SafetySoluções porque\s*\./);
  });

  it("o rodapé não inventa CNPJ", async () => {
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    expect(textoDaPagina()).not.toMatch(/CNPJ\s*(00|\[|xx)/i);
  });

  it("o rodapé mostra o WhatsApp cadastrado", async () => {
    await montar({ ...PLANO, precoPorVida: 2.5 }, "5588996349359");
    expect(textoDaPagina()).toMatch(/WhatsApp \(88\) 99634-9359/);
  });
});
