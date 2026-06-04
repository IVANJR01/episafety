import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto } = await req.json();
    if (!texto || String(texto).trim().length < 20) {
      return new Response(JSON.stringify({ error: "Texto muito curto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) throw new Error("Sem chave de IA configurada");
    const useGemini = !!GEMINI_API_KEY;
    const aiUrl = useGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiKey = useGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
    const aiModel = useGemini ? "gemini-2.5-flash" : "google/gemini-2.5-flash";

    const systemPrompt = `Você é um especialista em Medicina do Trabalho e PCMSO (NR-07). Receba um trecho de PCMSO (texto livre, tabela copiada, lista por GHE/GES ou Quadro Laboral) e estruture o conteúdo em JSON.

Retorne APENAS JSON válido no formato:
{
  "ghes": [
    {
      "codigo": "GHE 01",
      "nome": "Administrativo / PCP",
      "setor": "Administrativo",
      "descricao": "...",
      "funcoes": ["Auxiliar Administrativo", "Supervisor de PCP"],
      "riscos": [
        { "grupo": "ergonomico", "tipo_agente": "Postura sentada prolongada", "texto_aso": "Postura sentada prolongada" }
      ],
      "exames": [
        { "nome_exame": "Clínico Ocupacional", "codigo_exame": null, "admissional": true, "periodico": true, "retorno_trabalho": true, "mudanca_risco": true, "mudanca_funcao": true, "demissional": true }
      ]
    }
  ]
}

Regras:
- Use SEMPRE os grupos exatos: "fisico", "quimico", "biologico", "ergonomico", "acidente", "outro".
- Quando não houver risco em um grupo, simplesmente não inclua riscos daquele grupo (N.A. é implícito).
- Se o texto trouxer apenas funções por setor (sem riscos), crie um GHE por setor com as funções listadas e deixe "riscos" e "exames" vazios.
- Exames clássicos (admissional, periódico, demissional, mudança de risco, mudança de função, retorno) são booleanos. Marque true onde o texto indicar.
- Não invente CA, datas ou médicos. Não escreva nada fora do JSON.
- Se houver vários GHEs/GES no texto, retorne todos.`;

    const resp = await fetch(aiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: texto },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `IA falhou: ${resp.status} ${t}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await resp.json();
    const content = j?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    if (!parsed.ghes || !Array.isArray(parsed.ghes)) parsed.ghes = [];

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
