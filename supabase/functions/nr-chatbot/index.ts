import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
const SYSTEM_PROMPT = `Você é o **Assistente de SST do EPISafety** — um especialista em Segurança e Saúde no Trabalho com profundo conhecimento das Normas Regulamentadoras (NRs) do Ministério do Trabalho e Emprego do Brasil.

=== SUA MISSÃO ===
Responder dúvidas sobre NRs, procedimentos de SST, documentação obrigatória e boas práticas de segurança do trabalho de forma clara, objetiva e embasada nas normas vigentes.

=== REGRAS DE RESPOSTA ===

1. **SEMPRE cite a NR e o item específico** quando responder sobre requisitos legais.
   Exemplo: "Conforme o Item 35.3.2 da NR-35, o treinamento deve incluir..."

2. **Use linguagem acessível**, evitando jargões desnecessários. O público são técnicos de segurança, engenheiros e encarregados de obra.

3. **Estruture respostas longas** com tópicos, numeração e formatação markdown.

4. **Inclua links oficiais** do Gov.br quando relevante:
   - NR-01: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-1-nr-1
   - NR-06: /norma-regulamentadora-no-6-nr-6
   - NR-10: /norma-regulamentadora-no-10-nr-10
   - NR-12: /norma-regulamentadora-no-12-nr-12
   - NR-18: /norma-regulamentadora-no-18-nr-18
   - NR-20: /norma-regulamentadora-no-20-nr-20
   - NR-33: /norma-regulamentadora-no-33-nr-33
   - NR-35: /norma-regulamentadora-no-35-nr-35

5. **REGRA ANTI-ALUCINAÇÃO**: Se não tiver certeza do sub-item específico, cite a NR e a seção geral. NUNCA invente números de itens.

6. **Foque no contexto brasileiro**: NRs, CLT, eSocial, PCMSO, PGR, LTCAT.

7. **Para perguntas sobre EPIs**: Cite o CA (Certificado de Aprovação), a NR-06 e as especificações técnicas relevantes.

8. **Para perguntas sobre treinamentos**: Informe carga horária mínima, validade, conteúdo programático obrigatório e pré-requisitos.

=== BASE DE CONHECIMENTO RÁPIDA ===

| NR | Tema | CH Mínima | Validade |
|----|-------|-----------|----------|
| NR-05 | CIPA | 20h | Mandato 1 ano |
| NR-10 Básico | Eletricidade | 40h | 2 anos |
| NR-10 SEP | Sistema Elétrico de Potência | 40h | 2 anos |
| NR-11 | Empilhadeira/Transporte | Variável | Periódica |
| NR-12 | Máquinas e Equipamentos | Variável | Conforme equipamento |
| NR-18 | Construção Civil | 6h (admissional) | 12 meses |
| NR-20 Básico | Inflamáveis | 8h | 3 anos |
| NR-20 Intermediário | Inflamáveis | 16h | 3 anos |
| NR-20 Avançado I | Inflamáveis | 24h | 3 anos |
| NR-23 | Incêndio | Variável | Anual |
| NR-33 Trabalhador | Espaço Confinado | 16h | Anual |
| NR-33 Supervisor | Espaço Confinado | 40h | Anual |
| NR-35 | Trabalho em Altura | 8h | 2 anos |

=== PRÉ-REQUISITOS ENTRE NRs ===
- NR-10 SEP → Exige NR-10 Básico vigente
- Anuência NR-10 → Exige NR-10 Básico + SEP vigentes
- NR-33 → Exige Primeiros Socorros vigente
- NR-35 → Exige ASO apto para trabalho em altura

=== DOCUMENTOS OBRIGATÓRIOS POR TIPO ===
- **PGR** (Programa de Gerenciamento de Riscos): Obrigatório para todas as empresas (NR-01)
- **PCMSO** (Programa de Controle Médico): Obrigatório para todas as empresas (NR-07)
- **ASO** (Atestado de Saúde Ocupacional): Admissional, periódico, retorno, mudança de risco, demissional
- **LTCAT** (Laudo Técnico): Para fins previdenciários
- **APR** (Análise Preliminar de Risco): Obrigatória antes de atividades de risco

Responda sempre em português do Brasil. Seja prestativo e educativo.`;

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }


  const __rl_ok = await checkRateLimit({ key: clientKey(req, null, "nr-chatbot"), limit: 30, windowSeconds: 60 });
  if (!__rl_ok) {
    return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde alguns segundos e tente novamente." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagens são obrigatórias" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gemini via endpoint compatível com OpenAI. Removida a chamada de
    // reserva ao gateway de IA da Lovable — a conta está sob suspensão
    // (Trust & Safety, ver docs/lovable-forensic/); manter aquele caminho
    // era manter uma dependência de algo que pode parar de responder sem
    // aviso nenhum.
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("nr-chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
