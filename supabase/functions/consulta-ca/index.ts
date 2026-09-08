import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
import { extrairImagemDoCa } from "./extrairImagem.ts";

/** Teto da foto trazida junto. Acima disso o item fica sem foto e a consulta segue. */
const LIMITE_FOTO_BYTES = 3 * 1024 * 1024;

/**
 * Baixa a foto do EPI e devolve como endereço embutido.
 *
 * Precisa ser aqui, e não no navegador: consultaca.com não libera leitura de
 * outra origem (CORS), então o navegador conseguiria no máximo exibir a imagem
 * numa tag — nunca lê-la para anexar ao item. Aqui não há essa barreira.
 *
 * Qualquer problema devolve null: foto é acessório, e a consulta do CA — que é
 * o que a pessoa pediu — não pode cair por causa dela.
 */
async function baixarFoto(url: string): Promise<{ dataUrl: string; tipo: string; bytes: number } | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://consultaca.com/" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const tipo = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > LIMITE_FOTO_BYTES) return null;
    let bin = "";
    for (const b of buf) bin += String.fromCharCode(b);
    return { dataUrl: `data:${tipo};base64,${btoa(bin)}`, tipo, bytes: buf.byteLength };
  } catch {
    return null;
  }
}
function extractText(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function parseConsultaCA(html: string, ca: string) {
  // Check if CA was found
  if (html.includes('não foi localizado') || html.includes('não encontrado')) {
    return null;
  }

  // Extract EPI name from <h1> tag
  const nomeMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const nome = nomeMatch ? nomeMatch[1].trim() : null;

  // Extract category from subtitle after h1 (e.g. "Proteção dos Membros Inferiores")
  const categoriaMatch = html.match(/<h1[^>]*>[^<]+<\/h1>\s*<[^>]*>([^<]+)</i);
  const categoria = categoriaMatch ? categoriaMatch[1].trim() : null;

  // Extract situação (VÁLIDO / VENCIDO)
  const situacaoMatch = html.match(/Situa[çc][ãa]o[^<]*<[^>]*>\s*<[^>]*>\s*([^<]+)/i);
  const situacao = situacaoMatch ? situacaoMatch[1].trim() : null;

  // Extract validade date
  const validadeMatch = html.match(/Validade[^<]*<[^>]*>\s*<[^>]*>\s*(\d{2}\/\d{2}\/\d{4})/i);
  let validade: string | null = null;
  if (validadeMatch) {
    const parts = validadeMatch[1].split('/');
    validade = `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
  }

  // Extract description
  const descMatch = html.match(/Descri[çc][ãa]o Completa<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  let descricao: string | null = null;
  if (descMatch) {
    descricao = descMatch[1].replace(/<[^>]+>/g, '').trim();
  } else {
    // Try alternative pattern
    const descAlt = html.match(/Descri[çc][ãa]o Completa[\s\S]*?<\/h[23]>\s*([\s\S]*?)(?:<h[23]|<\/div>)/i);
    if (descAlt) {
      descricao = descAlt[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Extract fabricante
  const fabMatch = html.match(/Raz[ãa]o Social[^<]*<[^>]*>\s*<[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
  const fabricante = fabMatch ? fabMatch[1].trim() : null;

  // Extract "Aprovado Para"
  const aprovadoMatch = html.match(/Aprovado Para[^<]*<[^>]*>\s*<[^>]*>\s*([^<]+)/i);
  const aprovado_para = aprovadoMatch ? aprovadoMatch[1].trim() : null;

  if (!nome && !categoria) {
    return null;
  }

  return {
    ca,
    // O número do CA vai junto: a foto do site tem o número no nome do
    // arquivo, e é assim que se confere que ela é deste certificado.
    imagem_url: extrairImagemDoCa(html, `https://consultaca.com/${ca}`, ca),
    nome: nome || null,
    categoria: categoria || null,
    situacao: situacao || null,
    validade,
    descricao: descricao || null,
    fabricante: fabricante || null,
    aprovado_para: aprovado_para || null,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const __rl_ok = await checkRateLimit({ key: clientKey(req, null, "consulta-ca"), limit: 60, windowSeconds: 60 });
  if (!__rl_ok) {
    return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde alguns segundos e tente novamente." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const { ca, comFoto, diagnostico } = await req.json() as { ca?: string; comFoto?: boolean; diagnostico?: boolean };

    if (!ca || typeof ca !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Número do CA é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const caNumber = ca.replace(/\D/g, '');
    if (!caNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'CA inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Consulting CA: ${caNumber}`);

    const response = await fetch(`https://consultaca.com/${caNumber}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao consultar CA: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const data = parseConsultaCA(html, caNumber);

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: `CA ${caNumber} não encontrado` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    /*
     * Modo de diagnóstico: devolve o que a página REALMENTE tem de imagem.
     *
     * Existe porque a extração da foto foi escrita sem poder abrir o site — o
     * ambiente de desenvolvimento não alcança o consultaca.com. Sem isto, achar
     * por que uma foto não veio vira adivinhação; com isto, é uma chamada.
     * Não expõe nada que já não esteja na página pública do CA.
     */
    if (diagnostico) {
      const ogs = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](og:image|twitter:image)[^>]*>/gi)]
        .map((m) => m[0]).slice(0, 5);
      const imgs = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0].slice(0, 220)).slice(0, 25);
      return new Response(JSON.stringify({
        success: true,
        diagnostico: {
          tamanho_html: html.length,
          escolhida: data.imagem_url,
          metas_de_imagem: ogs,
          tags_img: imgs,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // A foto só é buscada quando quem chamou pediu — quem só quer o nome e a
    // validade não paga o download nem a espera.
    let foto: { dataUrl: string; tipo: string; bytes: number } | null = null;
    if (comFoto && data.imagem_url) foto = await baixarFoto(data.imagem_url);

    console.log('CA data found:', JSON.stringify({ ...data, imagem_url: data.imagem_url }));

    return new Response(
      JSON.stringify({ success: true, data: { ...data, foto } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
