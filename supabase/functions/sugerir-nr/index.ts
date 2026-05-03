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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada (GEMINI_API_KEY ou LOVABLE_API_KEY)");
    }
    const useGemini = !!GEMINI_API_KEY;
    const aiUrl = useGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiKey = useGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
    const aiModel = useGemini ? "gemini-2.5-flash" : "google/gemini-2.5-flash";

    const systemPrompt = `Você é um técnico de segurança do trabalho especialista em TODAS as normas regulamentadoras brasileiras vigentes (NR-01 a NR-38).

Dado uma situação/irregularidade detectada em uma inspeção de segurança, retorne um JSON com:
1. "referencia_normativa": A NR aplicável e o capítulo/seção geral (ex: "NR-12, Capítulo XII - Capacitação"). IMPORTANTE: Cite APENAS a NR e o capítulo/seção que você tem CERTEZA que existe. NÃO invente números de itens específicos (como 24.1.3, 12.135, etc.) se não tiver absoluta certeza de que o item existe na versão vigente da norma. Prefira citar o capítulo ou seção geral.
2. "gravidade": Uma das opções: "LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"
3. "acao_corretiva": Ação corretiva recomendada (máximo 2 frases)
4. "trecho_norma": Trecho resumido da norma que justifica a não conformidade (máximo 2 frases). Deve ser um conceito real da norma, NÃO invente trechos.

Base completa de NRs vigentes (conforme gov.br/trabalho-e-emprego, atualizado em 08/10/2024):
- NR-01: Disposições Gerais e Gerenciamento de Riscos Ocupacionais
- NR-03: Embargo e Interdição
- NR-04: Serviços Especializados em Segurança e em Medicina do Trabalho (SESMT)
- NR-05: Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA)
- NR-06: Equipamento de Proteção Individual (EPI)
- NR-07: Programa de Controle Médico de Saúde Ocupacional (PCMSO)
- NR-08: Edificações
- NR-09: Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos
- NR-10: Segurança em Instalações e Serviços em Eletricidade
- NR-11: Transporte, Movimentação, Armazenagem e Manuseio de Materiais
- NR-12: Segurança no Trabalho em Máquinas e Equipamentos
- NR-13: Caldeiras, Vasos de Pressão e Tubulações e Tanques Metálicos de Armazenamento
- NR-14: Fornos
- NR-15: Atividades e Operações Insalubres
- NR-16: Atividades e Operações Perigosas
- NR-17: Ergonomia
- NR-18: Segurança e Saúde no Trabalho na Indústria da Construção
- NR-19: Explosivos
- NR-20: Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis
- NR-21: Trabalhos a Céu Aberto
- NR-22: Segurança e Saúde Ocupacional na Mineração
- NR-23: Proteção Contra Incêndios
- NR-24: Condições Sanitárias e de Conforto nos Locais de Trabalho
- NR-25: Resíduos Industriais
- NR-26: Sinalização de Segurança
- NR-28: Fiscalização e Penalidades
- NR-29: Norma Regulamentadora de Segurança e Saúde no Trabalho Portuário
- NR-30: Segurança e Saúde no Trabalho Aquaviário
- NR-31: Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura
- NR-32: Segurança e Saúde no Trabalho em Serviços de Saúde
- NR-33: Segurança e Saúde nos Trabalhos em Espaços Confinados
- NR-34: Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval
- NR-35: Trabalho em Altura
- NR-36: Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados
- NR-37: Segurança e Saúde em Plataformas de Petróleo
- NR-38: Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos

NRs REVOGADAS (ignorar): NR-02 (Inspeção Prévia), NR-27 (Registro Profissional do Técnico de Segurança do Trabalho).

REGRAS DE ANÁLISE:
- Se a descrição mencionar "EPI", cruzar NR-06 com a norma específica da atividade (ex: NR-10, NR-35, NR-18).
- Para irregularidades em canteiros de obra, aplicar prioritariamente NR-18.
- Risco de queda ou choque elétrico = classificar como "GRAVE" ou "RISCO CRÍTICO" automaticamente.
- Espaço confinado sem procedimento = "RISCO CRÍTICO".
- REGRA CRÍTICA: NÃO invente números de itens específicos da norma. Cite apenas o número da NR e o capítulo/seção geral (ex: "NR-24, Seção 24.3 - Água potável" ou "NR-12, Capítulo XII - Capacitação"). Se não souber o item exato, cite apenas a NR e seu título.
- Para a NR-24 vigente (Portaria SEPRT nº 1.066/2019), a estrutura é: 24.1 Objetivo, 24.2 Instalações sanitárias, 24.3 Vestiários, 24.4 Locais para refeições, 24.5 Cozinhas, 24.6 Alojamento, 24.7 Vestimentas de trabalho, 24.8 Disposições gerais. O tema "água potável" está na seção 24.8 Disposições gerais.`;

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
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
