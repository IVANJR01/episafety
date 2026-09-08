/*
 * Acha a foto do EPI na página do CA no consultaca.com.
 *
 * Fica em arquivo próprio, sem nada do Deno dentro, por um motivo prático: a
 * função de borda roda no Deno e os testes do projeto rodam no Node. Separado
 * assim, o MESMO código que vai para o servidor é o que os testes exercitam.
 *
 * A REGRA VEIO DA PÁGINA REAL, não de suposição. Buscando o HTML de CAs de
 * verdade (34474, 5745, 19578), o padrão é este:
 *
 *   https://consultaca.com/files/fotos_ca/<número do CA>-<id>.jpg
 *
 * O nome do arquivo começa com o próprio número do CA, o que permite conferir
 * que a foto é daquele certificado e não de outro.
 *
 * A primeira versão disto usava `og:image` como melhor candidata, por ser o que
 * a maioria dos sites declara como imagem do conteúdo. Aqui isso estava ERRADO:
 * a og:image do consultaca é `/images/og-image.jpg`, a arte genérica do site,
 * igual em toda página. A regra teria anexado o cartão do site como se fosse o
 * equipamento — em todos os itens.
 *
 * A página também traz muita imagem que não é o EPI do certificado: logo do
 * fabricante, publicidade, selos, e um catálogo de produtos de lojas parceiras
 * em outros domínios (buscaepi.com, cloudfront, epizeus). Nada disso entra.
 */

/** A pasta onde o site guarda a foto de cada CA. */
const PASTA_DA_FOTO = "/files/fotos_ca/";

/** Anfitriões de onde a foto pode vir. Loja parceira não é fonte do CA. */
const DOMINIOS_ACEITOS = ["consultaca.com", "consultaca.com.br"];

function absoluta(url: string, base: string): string | null {
  try {
    const u = new URL(url, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function doSite(u: URL): boolean {
  return DOMINIOS_ACEITOS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
}

/**
 * @param html   página do CA
 * @param base   endereço de onde o html veio, para resolver caminho relativo
 * @param ca     número do certificado, para conferir que a foto é dele
 * @returns endereço absoluto da foto, ou null quando a página não tem uma
 */
export function extrairImagemDoCa(html: string, base = "https://consultaca.com/", ca?: string): string | null {
  if (!html) return null;

  const candidatas: URL[] = [];
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const url = absoluta(m[1].trim(), base);
    if (!url) continue;
    let u: URL;
    try { u = new URL(url); } catch { continue; }
    if (!doSite(u)) continue;
    if (!u.pathname.startsWith(PASTA_DA_FOTO)) continue;
    candidatas.push(u);
  }
  if (candidatas.length === 0) return null;

  // Quando se sabe o número do CA, vale a foto cujo arquivo começa com ele:
  // é a prova de que a imagem é deste certificado, e não de um relacionado.
  const numero = (ca || "").replace(/\D/g, "");
  if (numero) {
    const daquele = candidatas.find((u) =>
      u.pathname.slice(PASTA_DA_FOTO.length).startsWith(`${numero}-`)
      || u.pathname.slice(PASTA_DA_FOTO.length).startsWith(`${numero}.`));
    if (daquele) return daquele.toString();
  }

  return candidatas[0].toString();
}
