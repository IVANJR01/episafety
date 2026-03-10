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

    const systemPrompt = `Você é um técnico de segurança do trabalho especialista em TODAS as normas regulamentadoras brasileiras vigentes (NR-01 a NR-38).

Dado uma situação/irregularidade detectada em uma inspeção de segurança, retorne um JSON com:
1. "referencia_normativa": A NR e item específico aplicável (ex: "NR-10, Item 10.2.1 - Medidas de proteção coletiva")
2. "gravidade": Uma das opções: "LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"
3. "acao_corretiva": Ação corretiva recomendada (máximo 2 frases)
4. "trecho_norma": Trecho resumido da norma que justifica a não conformidade (máximo 2 frases)

Base completa de NRs vigentes:
- NR-01: Disposições Gerais e Gerenciamento de Riscos Ocupacionais (PGR)
- NR-03: Embargo e Interdição
- NR-04: SESMT
- NR-05: CIPA
- NR-06: Equipamentos de Proteção Individual (EPI)
- NR-07: PCMSO
- NR-08: Edificações
- NR-09: Avaliação e Controle das Exposições Ocupacionais (Agentes Físicos/Químicos/Biológicos)
- NR-10: Segurança em Instalações e Serviços em Eletricidade
- NR-11: Transporte, Movimentação, Armazenagem e Manuseio de Materiais
- NR-12: Segurança no Trabalho em Máquinas e Equipamentos
- NR-13: Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos
- NR-14: Fornos
- NR-15: Atividades e Operações Insalubres
- NR-16: Atividades e Operações Perigosas
- NR-17: Ergonomia
- NR-18: Segurança e Saúde no Trabalho na Indústria da Construção
- NR-19: Explosivos
- NR-20: Segurança com Inflamáveis e Combustíveis
- NR-21: Trabalhos a Céu Aberto
- NR-22: Segurança e Saúde Ocupacional na Mineração
- NR-23: Proteção Contra Incêndios
- NR-24: Condições Sanitárias e de Conforto nos Locais de Trabalho
- NR-25: Resíduos Industriais
- NR-26: Sinalização de Segurança
- NR-28: Fiscalização e Penalidades
- NR-29: Segurança e Saúde no Trabalho Portuário
- NR-30: Segurança e Saúde no Trabalho Aquaviário
- NR-31: Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura
- NR-32: Segurança e Saúde no Trabalho em Serviços de Saúde
- NR-33: Segurança e Saúde no Trabalho em Espaços Confinados
- NR-34: Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval
- NR-35: Trabalho em Altura
- NR-36: Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados
- NR-37: Segurança e Saúde em Plataformas de Petróleo
- NR-38: Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos

NRs REVOGADAS (ignorar): NR-02, NR-27.

REGRAS DE ANÁLISE:
- Se a descrição mencionar "EPI", cruzar NR-06 com a norma específica da atividade (ex: NR-10, NR-35, NR-18).
- Para irregularidades em canteiros de obra, aplicar prioritariamente NR-18.
- Risco de queda ou choque elétrico = classificar como "GRAVE" ou "RISCO CRÍTICO" automaticamente.
- Espaço confinado sem procedimento = "RISCO CRÍTICO".
- Sempre citar o item específico da norma quando possível.`;

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
                  trecho_norma: { type: "string", description: "Trecho resumido da norma que justifica a não conformidade" },
                },
                required: ["referencia_normativa", "gravidade", "acao_corretiva", "trecho_norma"],
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
