import { describe, it, expect } from "vitest";
import {
  aplicarMetaDaPaginaDeVendas,
  META_DA_PAGINA_DE_VENDAS,
  marcacaoDoPixelDaMeta,
} from "./metaDaPaginaDeVendas";

/**
 * O link da página de vendas circula no WhatsApp — é o canal do negócio.
 * A prévia que aparece ali é a primeira coisa que o cliente vê da
 * empresa, e ela é montada a partir do HTML cru, sem rodar JavaScript.
 * Se estas marcações saírem erradas, a prévia volta a dizer "Sistema de
 * gestão de EPIs" com o ícone do aplicativo.
 */

const HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>SafetySoluções - Segurança do Trabalho</title>
    <meta name="description" content="Sistema de gestão de EPIs e segurança do trabalho">
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://safetysolucoes.com/pwa-512x512.png?v=2">
    <meta property="og:url" content="https://safetysolucoes.com">
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://safetysolucoes.com/pwa-512x512.png?v=2">
    <meta property="og:title" content="SafetySoluções - Segurança do Trabalho">
    <meta name="twitter:title" content="SafetySoluções - Segurança do Trabalho">
    <meta property="og:description" content="Sistema de gestão de EPIs e segurança do trabalho">
    <meta name="twitter:description" content="Sistema de gestão de EPIs e segurança do trabalho">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc123.js"></script>
  </body>
</html>`;

const saida = aplicarMetaDaPaginaDeVendas(HTML, "build-9");

describe("a prévia do link no WhatsApp", () => {
  it("o título deixa de ser o genérico do sistema", () => {
    expect(saida).toContain("<title>Gestão e Ficha de EPIs — SafetySoluções</title>");
    expect(saida, "sobrou o título antigo em algum lugar")
      .not.toContain("Segurança do Trabalho</title>");
  });

  it("título, descrição e imagem valem para as três redes", () => {
    /*
     * WhatsApp e Facebook leem og:, o X lê twitter:. Trocar só um lado
     * faz a prévia aparecer certa num lugar e errada no outro.
     */
    for (const marca of [
      'property="og:title"', 'name="twitter:title"',
      'property="og:description"', 'name="twitter:description"',
      'property="og:image"', 'name="twitter:image"',
    ]) {
      const achado = saida.match(new RegExp(`<meta ${marca} content="([^"]*)"`));
      expect(achado, `faltou ${marca}`).not.toBeNull();
      expect(achado![1], `${marca} ficou com o texto antigo`)
        .not.toMatch(/Sistema de gestão de EPIs e segurança do trabalho|Segurança do Trabalho$/);
    }
  });

  it("a imagem é o cartão da oferta, não o ícone do aplicativo", () => {
    expect(saida).toContain("/marca/og-planos.png");
    expect(saida, "ficou o ícone do PWA na prévia").not.toContain("pwa-512x512.png");
  });

  it("a imagem leva a versão do build", () => {
    /*
     * Sem isso o WhatsApp continua servindo a prévia que guardou da
     * primeira vez, mesmo depois de a arte mudar.
     */
    expect(saida).toMatch(/og-planos\.png\?v=build-9/);
  });

  it("o endereço aponta para a página de vendas, não para a raiz", () => {
    expect(saida).toContain('content="https://safetysolucoes.com/planos"');
  });

  it("declara o endereço canônico uma vez só", () => {
    const vezes = saida.match(/rel="canonical"/g) || [];
    expect(vezes).toHaveLength(1);
    expect(aplicarMetaDaPaginaDeVendas(saida, "build-9").match(/rel="canonical"/g))
      .toHaveLength(1);
  });

  it("o pacote JavaScript continua no arquivo", () => {
    /*
     * O arquivo não é uma cópia morta: é a aplicação de sempre. Perder o
     * script faria a página abrir em branco para quem clicasse.
     */
    expect(saida).toContain('src="/assets/index-abc123.js"');
    expect(saida).toContain('id="root"');
  });

  it("o texto da descrição vende e cabe na prévia", () => {
    const d = META_DA_PAGINA_DE_VENDAS.descricao;
    expect(d).toMatch(/CA vencido/);
    expect(d).toMatch(/ficha individual/i);
    expect(d.length, "descrição longa demais: a prévia corta").toBeLessThanOrEqual(300);
  });

  it("aspas no texto não quebram o HTML", () => {
    const comAspas = aplicarMetaDaPaginaDeVendas(
      HTML.replace("Sistema de gestão", 'Sistema "de" gestão'),
      "build-9",
    );
    const descricoes = comAspas.match(/<meta name="description" content="([^"]*)"/);
    expect(descricoes).not.toBeNull();
    expect(comAspas).not.toContain('content="O sistema recusa EPI com CA vencido" ');
  });
});

describe("Pixel da Meta", () => {
  const HTML = `<!doctype html><html><head><title>EPISafety</title></head><body></body></html>`;

  it("entra na página de vendas com o id certo", () => {
    const saida = aplicarMetaDaPaginaDeVendas(HTML, "v1");
    expect(saida).toContain("connect.facebook.net/en_US/fbevents.js");
    expect(saida).toContain("fbq('init', '1734362404017048')");
    expect(saida).toContain("fbq('track', 'PageView')");
  });

  it("traz o <noscript>, para quem navega sem JavaScript", () => {
    const saida = aplicarMetaDaPaginaDeVendas(HTML, "v1");
    expect(saida).toContain("facebook.com/tr?id=1734362404017048");
    expect(saida).toContain("ev=PageView");
  });

  it("o & da URL do noscript vai escapado, senão o HTML quebra", () => {
    const saida = aplicarMetaDaPaginaDeVendas(HTML, "v1");
    expect(saida).toContain("&amp;ev=PageView");
    expect(saida).not.toMatch(/tr\?id=\d+&ev=/);
  });

  it("fica dentro do <head>", () => {
    const saida = aplicarMetaDaPaginaDeVendas(HTML, "v1");
    expect(saida.indexOf("fbevents.js")).toBeLessThan(saida.indexOf("</head>"));
  });

  it("não entra duas vezes: a visita seria contada em dobro", () => {
    const uma = aplicarMetaDaPaginaDeVendas(HTML, "v1");
    const duas = aplicarMetaDaPaginaDeVendas(uma, "v1");
    expect(duas.match(/fbevents\.js/g)).toHaveLength(1);
  });

  it("id que não é número não vira script na página", () => {
    /*
     * Um id torto — vazio, com aspas, com script dentro — produziria
     * HTML quebrado numa página pública. Melhor não gerar nada.
     */
    for (const ruim of ["", "   ", "abc", "123", "'); alert(1); //", "17343624040170489999999"]) {
      expect(marcacaoDoPixelDaMeta(ruim), `aceitou o id ${ruim}`).toBe("");
    }
  });

  it("id válido com espaço em volta é aceito, limpo", () => {
    expect(marcacaoDoPixelDaMeta(" 1734362404017048 ")).toContain("fbq('init', '1734362404017048')");
  });
});
