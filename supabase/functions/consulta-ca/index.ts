const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ca } = await req.json();

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

    console.log('CA data found:', JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, data }),
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
