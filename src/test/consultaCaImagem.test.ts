import { describe, it, expect } from "vitest";
import { extrairImagemDoCa } from "../../supabase/functions/consulta-ca/extrairImagem";

/*
 * O HTML aqui não é inventado: é o que a página real do consultaca.com traz,
 * conferido buscando os CAs 34474, 5745 e 19578 e listando as imagens de cada
 * um. A foto do certificado fica em /files/fotos_ca/<CA>-<id>.jpg; ao lado dela
 * a página tem logo do fabricante, publicidade, selos e um catálogo de lojas
 * parceiras em OUTROS domínios.
 */
const PAGINA_REAL = `<html><head>
  <meta id="ogMetaTagImage" property="og:image" content="/images/og-image.jpg" />
</head><body>
  <img src="/images/logo.png">
  <img src="/images/grupo-epi-4.jpg">
  <img src="https://consultaca.com/files/logo_fabricantes/23.jpg?5953">
  <img src="https://consultaca.com/files/publicidade/1108.jpg?5359">
  <img src="https://consultaca.com/images/selo/selo1-consultaca.png">
  <img src="https://consultaca.com/files/fotos_ca/34474-5691.jpg">
  <img src="https://buscaepi.com/files/ofertas/17207-12645.jpg">
  <img src="https://d3bhvz7al37iy6.cloudfront.net/Custom/Content/Products/10/62/1062767_luva-ca-34474_m1.webp">
  <img src="https://epizeus.com.br/media/catalog/product/3/6/366-1.jpeg">
</body></html>`;

describe("extrairImagemDoCa", () => {
  it("acha a foto do certificado na pasta que o site usa para isso", () => {
    expect(extrairImagemDoCa(PAGINA_REAL, "https://consultaca.com/34474", "34474"))
      .toBe("https://consultaca.com/files/fotos_ca/34474-5691.jpg");
  });

  it("NÃO usa a og:image — no consultaca ela é a arte genérica do site", () => {
    /*
     * Este é o teste que existe por causa de um erro real: a primeira versão
     * punha a og:image em primeiro lugar, como se faz na maioria dos sites.
     * Aqui ela é `/images/og-image.jpg`, idêntica em toda página — teria
     * anexado o cartão do site como se fosse o equipamento, em todos os itens.
     */
    const achado = extrairImagemDoCa(PAGINA_REAL, "https://consultaca.com/34474", "34474");
    expect(achado).not.toContain("og-image");
  });

  it("não confunde com logo do fabricante, publicidade nem selo", () => {
    const achado = extrairImagemDoCa(PAGINA_REAL, "https://consultaca.com/34474", "34474")!;
    expect(achado).not.toContain("logo_fabricantes");
    expect(achado).not.toContain("publicidade");
    expect(achado).not.toContain("selo");
  });

  it("não pega foto de loja parceira — a página lista produtos de outros sites", () => {
    const achado = extrairImagemDoCa(PAGINA_REAL, "https://consultaca.com/34474", "34474")!;
    for (const alheio of ["buscaepi.com", "cloudfront.net", "epizeus.com.br"]) {
      expect(achado).not.toContain(alheio);
    }
  });

  it("recusa outro domínio mesmo imitando o caminho da foto do CA", () => {
    /*
     * Sem este caso o filtro de domínio ficava sem teste: nenhuma loja parceira
     * usa o caminho /files/fotos_ca/, então tirar a verificação de domínio não
     * mudava nada nos outros testes. Aqui o endereço alheio copia o caminho
     * exato — é o que o filtro de domínio existe para barrar.
     */
    const html = `<img src="https://site-qualquer.com/files/fotos_ca/34474-1.jpg">`;
    expect(extrairImagemDoCa(html, "https://consultaca.com/34474", "34474")).toBeNull();
  });

  it("entre duas fotos de CA, fica com a do CA pedido", () => {
    const html = `<img src="https://consultaca.com/files/fotos_ca/99999-1.jpg">
                  <img src="https://consultaca.com/files/fotos_ca/5745-1689.jpg">`;
    expect(extrairImagemDoCa(html, "https://consultaca.com/5745", "5745"))
      .toBe("https://consultaca.com/files/fotos_ca/5745-1689.jpg");
  });

  it("CA sem foto no site devolve nada — é o caso do 19578, conferido na página", () => {
    const semFoto = `<html><head><meta property="og:image" content="/images/og-image.jpg"></head>
      <body><img src="/images/logo.png"><img src="https://consultaca.com/files/publicidade/1108.jpg"></body></html>`;
    expect(extrairImagemDoCa(semFoto, "https://consultaca.com/19578", "19578")).toBeNull();
  });

  it("resolve caminho relativo, que é como o site escreve alguns endereços", () => {
    const html = `<img src="/files/fotos_ca/5745-1689.jpg">`;
    expect(extrairImagemDoCa(html, "https://consultaca.com/5745", "5745"))
      .toBe("https://consultaca.com/files/fotos_ca/5745-1689.jpg");
  });

  it("sem saber o número do CA, ainda acha a foto na pasta certa", () => {
    expect(extrairImagemDoCa(PAGINA_REAL, "https://consultaca.com/34474"))
      .toBe("https://consultaca.com/files/fotos_ca/34474-5691.jpg");
  });

  it("página vazia ou endereço inválido não derruba a consulta", () => {
    expect(extrairImagemDoCa("")).toBeNull();
    expect(extrairImagemDoCa(`<img src="javascript:alert(1)">`)).toBeNull();
  });
});
