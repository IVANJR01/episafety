/*
 * Acha a foto do EPI na página do CA.
 *
 * Fica em arquivo próprio, sem nada do Deno dentro, por um motivo prático: a
 * função de borda roda no Deno e os testes do projeto rodam no Node. Separado
 * assim, o MESMO código que vai para o servidor é o que os testes exercitam.
 *
 * A ordem das tentativas não é arbitrária. `og:image` é a que o site declara
 * para redes sociais: é a foto do produto, é absoluta e é a que menos muda de
 * lugar quando o layout do site é mexido. As outras existem porque o site pode
 * simplesmente não ter `og:image`, e aí uma foto errada é pior do que nenhuma —
 * por isso a última tentativa exige que o nome do arquivo pareça de produto.
 */

/** Domínios de onde vale a pena aceitar uma foto. */
const DOMINIOS_ACEITOS = ["consultaca.com", "consultaca.com.br"];

/**
 * Nada de ícone, logo, selo, bandeira — não são a foto do equipamento — e nada
 * de pixel de rastreio, que foi o que um teste pegou: um `pixel.gif` de 1x1
 * passava por todos os filtros e virava a "foto do EPI" do item.
 */
const NOMES_RECUSADOS =
  /logo|icon|favicon|sprite|banner|selo|bandeira|avatar|placeholder|sem-?imagem|no-?image|pixel|spacer|blank|1x1|track/i;

/** Pastas de enfeite do site; foto de produto não mora nelas. */
const PASTAS_RECUSADAS = /\/(estatico|static|assets|css|js|tema|theme|ui)\//i;

/* Sem `gif`: foto de produto não é gif — gif ali é animação ou rastreio. */
const EXTENSOES = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;

function absoluta(url: string, base: string): string | null {
  try {
    const u = new URL(url, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function aceitavel(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  // Aceita o próprio site e seus subdomínios (imagens costumam ficar em outro).
  const doDominio = DOMINIOS_ACEITOS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  if (!doDominio) return false;
  if (NOMES_RECUSADOS.test(u.pathname)) return false;
  if (PASTAS_RECUSADAS.test(u.pathname)) return false;
  return true;
}

/**
 * @param html   página do CA
 * @param base   endereço de onde o html veio, para resolver caminho relativo
 * @returns endereço absoluto da foto, ou null quando não há uma confiável
 */
export function extrairImagemDoCa(html: string, base = "https://consultaca.com/"): string | null {
  if (!html) return null;

  const tentativas: Array<RegExp> = [
    // 1. og:image / twitter:image — nas duas ordens de atributo.
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    // 2. Imagem marcada como a do EPI pelo próprio site.
    /<img[^>]+(?:class|id)=["'][^"']*(?:epi|produto|equipamento|foto-ca)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*(?:epi|produto|equipamento|foto-ca)[^"']*["']/i,
  ];

  for (const padrao of tentativas) {
    const achado = html.match(padrao)?.[1];
    if (!achado) continue;
    const url = absoluta(achado.trim(), base);
    if (url && aceitavel(url)) return url;
  }

  // 3. Último recurso: alguma <img> do próprio site cujo arquivo pareça foto.
  //    Exige extensão de imagem para não pegar pixel de rastreio nem SVG de UI.
  const todas = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const m of todas) {
    const url = absoluta(m[1].trim(), base);
    if (url && aceitavel(url) && EXTENSOES.test(url)) return url;
  }

  return null;
}
