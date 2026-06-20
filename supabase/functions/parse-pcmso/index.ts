import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
const systemPrompt = `Você é um especialista em Medicina do Trabalho e PCMSO (NR-07). Receba um PCMSO (texto livre, tabela copiada, lista por GHE/GES, Quadro Laboral, ou PDF completo) e estruture o conteúdo em JSON.

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
- Se houver vários GHEs/GES no documento, retorne TODOS.`;

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const __rl_ok = await checkRateLimit({ key: clientKey(req, null, "parse-pcmso"), limit: 10, windowSeconds: 60 });
  if (!__rl_ok) {
    return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde alguns segundos e tente novamente." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const body = await req.json();
    const { texto, pdf_base64, mime_type } = body || {};

    if (!texto && !pdf_base64) {
      return new Response(JSON.stringify({ error: "Envie texto ou pdf_base64" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (texto && String(texto).trim().length < 20 && !pdf_base64) {
      return new Response(JSON.stringify({ error: "Texto muito curto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) throw new Error("Sem chave de IA configurada");

    let content = "{}";

    if (pdf_base64) {
      // Use native Gemini API for PDF input (supports inline_data)
      if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "Importação de PDF requer GEMINI_API_KEY configurada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: mime_type || "application/pdf", data: pdf_base64 } },
              { text: "Extraia todos os GHEs/GES deste PCMSO no formato JSON especificado." },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return new Response(JSON.stringify({ error: `Gemini falhou: ${resp.status} ${t}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const j = await resp.json();
      content = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "{}";
    } else {
      const useGemini = !!GEMINI_API_KEY;
      const aiUrl = useGemini
        ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions";
      const aiKey = useGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
      const aiModel = useGemini ? "gemini-2.5-flash" : "google/gemini-2.5-flash";

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
      content = j?.choices?.[0]?.message?.content || "{}";
    }

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
