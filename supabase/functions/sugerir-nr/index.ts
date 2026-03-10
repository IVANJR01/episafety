import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situacao } = await req.json();
    if (!situacao || situacao.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descrição muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um técnico de segurança do trabalho especialista em normas regulamentadoras brasileiras.
Dado uma situação/irregularidade detectada em uma inspeção de segurança, você deve responder APENAS com um JSON válido contendo:

1. "referencia_normativa": A NR e item específico aplicável (ex: "NR-10, Item 10.2.1 - Medidas de proteção coletiva")
2. "gravidade": Uma das opções: "LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"  
3. "acao_corretiva": Ação corretiva recomendada (máximo 2 frases)

Base de NRs que você conhece bem:
- NR-06: Equipamentos de Proteção Individual (EPIs)
- NR-10: Segurança em Instalações e Serviços em Eletricidade
- NR-12: Segurança no Trabalho em Máquinas e Equipamentos
- NR-23: Proteção Contra Incêndios
- NR-24: Condições Sanitárias e de Conforto nos Locais de Trabalho
- NR-26: Sinalização de Segurança
- NR-35: Trabalho em Altura

Se a situação não se encaixar claramente em nenhuma NR específica, use a mais próxima e indique.
Responda SOMENTE com o JSON, sem markdown, sem explicação adicional.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Situação detectada: "${situacao}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_conformidade",
              description: "Retorna sugestão de NR, gravidade e ação corretiva para uma situação de inspeção.",
              parameters: {
                type: "object",
                properties: {
                  referencia_normativa: { type: "string", description: "NR e item aplicável" },
                  gravidade: { type: "string", enum: ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"] },
                  acao_corretiva: { type: "string", description: "Ação corretiva recomendada" },
                },
                required: ["referencia_normativa", "gravidade", "acao_corretiva"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_conformidade" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let result;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content || "";
      result = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sugerir-nr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
