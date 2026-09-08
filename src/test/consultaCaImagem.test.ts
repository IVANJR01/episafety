import { describe, it, expect } from "vitest";
import { extrairImagemDoCa } from "../../supabase/functions/consulta-ca/extrairImagem";

/*
 * Nota honesta: o ambiente onde estes testes foram escritos não alcança
 * consultaca.com (o proxy recusa a conexão), então o HTML aqui é montado à mão
 * a partir das formas que páginas desse tipo costumam ter. O que estes testes
 * garantem é a REGRA — qual candidata ganha, e o que nunca pode ser aceito.
 * Se o site mudar de layout, a extração devolve null e o item fica sem foto,
 * que é o comportamento seguro (nunca uma foto errada).
 */

const pagina = (miolo: string) => `<!doctype html><html><head>${miolo}</head><body></body></html>`;

describe("extrairImagemDoCa", () => {
  it("prefere a og:image — é a foto que o próprio site declara como a do produto", () => {
    const html = pagina(`<meta property="og:image" content="https://consultaca.com/fotos/epi-1234.jpg">`);
    expect(extrairImagemDoCa(html)).toBe("https://consultaca.com/fotos/epi-1234.jpg");
  });

  it("lê a og:image com os atributos na ordem invertida", () => {
    const html = pagina(`<meta content="https://consultaca.com/fotos/epi-9.png" property="og:image">`);
    expect(extrairImagemDoCa(html)).toBe("https://consultaca.com/fotos/epi-9.png");
  });

  it("resolve caminho relativo a partir do endereço da página", () => {
    const html = pagina(`<meta property="og:image" content="/fotos/luva.jpg">`);
    expect(extrairImagemDoCa(html, "https://consultaca.com/26967")).toBe("https://consultaca.com/fotos/luva.jpg");
  });

  it("aceita foto vinda de subdomínio do site (imagens costumam ficar em outro)", () => {
    const html = pagina(`<meta property="og:image" content="https://cdn.consultaca.com/p/38501.webp">`);
    expect(extrairImagemDoCa(html)).toBe("https://cdn.consultaca.com/p/38501.webp");
  });

  it("NÃO aceita imagem de outro domínio — é por onde entraria conteúdo de terceiro", () => {
    const html = pagina(`<meta property="og:image" content="https://site-qualquer.com/foto.jpg">`);
    expect(extrairImagemDoCa(html)).toBeNull();
  });

  it("NÃO aceita logotipo, ícone nem selo: não são a foto do equipamento", () => {
    for (const arquivo of ["logo.png", "favicon.ico.png", "selo-verificado.png", "banner-topo.jpg", "sem-imagem.png"]) {
      const html = pagina(`<meta property="og:image" content="https://consultaca.com/img/${arquivo}">`);
      expect(extrairImagemDoCa(html), arquivo).toBeNull();
    }
  });

  it("sem og:image, usa a <img> que o site marcou como a do EPI", () => {
    const html = `<html><body>
      <img src="https://consultaca.com/img/logo.png" class="logo">
      <img class="foto-ca destaque" src="https://consultaca.com/fotos/mascara.jpg">
    </body></html>`;
    expect(extrairImagemDoCa(html)).toBe("https://consultaca.com/fotos/mascara.jpg");
  });

  it("em último caso pega uma <img> do site com cara de foto, pulando os enfeites", () => {
    const html = `<html><body>
      <img src="/img/logo.png">
      <img src="/estatico/pixel.gif?id=1">
      <img src="/fotos/protetor-auditivo.jpg">
    </body></html>`;
    expect(extrairImagemDoCa(html)).toBe("https://consultaca.com/fotos/protetor-auditivo.jpg");
  });

  it("não inventa foto quando a página não tem nenhuma", () => {
    expect(extrairImagemDoCa(pagina("<title>CA</title>"))).toBeNull();
    expect(extrairImagemDoCa("")).toBeNull();
  });

  it("endereço inválido não derruba a consulta", () => {
    const html = pagina(`<meta property="og:image" content="javascript:alert(1)">`);
    expect(extrairImagemDoCa(html)).toBeNull();
  });
});
