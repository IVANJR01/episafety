import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { resolveCors } from "../_shared/cors.ts";

// ============================================================================
// BASE DE REGRAS INTERNAS (pré-IA) — palavras-chave -> normas prováveis
// ============================================================================
type RegraNR = {
  keywords: string[];
  referencias: string[]; // formato: "NR-XX — Item X.X.X — Descrição curta"
  gravidade: "LEVE" | "MODERADO" | "GRAVE" | "RISCO CRÍTICO";
  acao: string;
};

const REGRAS_INTERNAS: RegraNR[] = [
  {
    keywords: [
      "quadro elétrico", "quadro eletrico", "quadro de distribuição", "quadro de distribuicao",
      "painel elétrico", "painel eletrico", "disjuntor", "acesso não autorizado", "acesso nao autorizado",
      "falta de trancamento", "sem trancamento", "falta de bloqueio", "sem bloqueio",
      "falta de sinalização elétrica", "sinalizacao eletrica", "partes vivas expostas",
      "instalação elétrica em canteiro", "instalacao eletrica em canteiro", "canteiro de obra elétrico",
    ],
    referencias: [
      "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas contra acesso de trabalhadores não autorizados.",
      "NR-18 — Item 18.6.12(c) — Dispositivos de manobra, controle e comando devem possuir condições para bloqueio e sinalização de impedimento de ligação.",
      "NR-10 — Item 10.5.1 — Segurança em instalações elétricas desenergizadas, com seccionamento, impedimento de reenergização e sinalização.",
    ],
    gravidade: "GRAVE",
    acao: "Instalar sistema de trancamento/bloqueio no quadro elétrico, manter sinalização de risco elétrico, restringir o acesso a trabalhadores autorizados e garantir que os dispositivos de manobra possuam condição de bloqueio e sinalização.",
  },
  {
    keywords: ["trabalho em altura", "sem cinto", "sem talabarte", "queda de altura", "andaime sem guarda"],
    referencias: [
      "NR-35 — Item 35.4.5 — Adoção de medidas de proteção contra queda com uso de sistemas de proteção coletiva ou individual.",
      "NR-35 — Item 35.5.1 — Equipamentos de proteção individual, acessórios e sistemas de ancoragem específicos para trabalho em altura.",
    ],
    gravidade: "RISCO CRÍTICO",
    acao: "Interromper a atividade imediatamente, fornecer cinto tipo paraquedista com talabarte duplo, instalar pontos de ancoragem certificados e garantir Análise de Risco e permissão de trabalho antes do reinício.",
  },
  {
    keywords: ["espaço confinado", "espaco confinado", "sem PET", "sem permissão de entrada"],
    referencias: [
      "NR-33 — Item 33.3.2 — Elaboração de Permissão de Entrada e Trabalho (PET) para cada entrada em espaço confinado.",
      "NR-33 — Item 33.3.4.4 — Isolamento, sinalização e controle de acesso à entrada do espaço confinado.",
    ],
    gravidade: "RISCO CRÍTICO",
    acao: "Interditar o acesso, emitir Permissão de Entrada e Trabalho, realizar avaliação atmosférica prévia e disponibilizar vigia e equipamentos de resgate antes de qualquer entrada.",
  },
  {
    keywords: ["sem EPI", "sem epi", "não uso de EPI", "falta de EPI", "capacete", "luva", "óculos de proteção"],
    referencias: [
      "NR-06 — Item 6.6.1(d) — O empregador deve exigir o uso do EPI.",
      "NR-06 — Item 6.7.1(b) — O trabalhador deve usar o EPI apenas para a finalidade a que se destina.",
    ],
    gravidade: "MODERADO",
    acao: "Fornecer o EPI adequado com CA vigente, treinar o trabalhador quanto ao uso correto, registrar a entrega em ficha e fiscalizar o uso continuamente.",
  },
  {
    keywords: ["máquina sem proteção", "maquina sem protecao", "proteção fixa", "protecao movel", "sem dispositivo de segurança"],
    referencias: [
      "NR-12 — Item 12.38 — Proteções fixas e móveis intertravadas para zonas de perigo de máquinas e equipamentos.",
      "NR-12 — Item 12.24 — Instalação, operação e manutenção de máquinas conforme especificações do fabricante.",
    ],
    gravidade: "GRAVE",
    acao: "Interromper o uso da máquina, instalar proteções fixas/móveis intertravadas na zona de perigo e capacitar operadores conforme Anexo II da NR-12.",
  },
];

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchRegras(situacao: string): RegraNR | null {
  const alvo = normalizar(situacao);
  let melhor: { regra: RegraNR; hits: number } | null = null;
  for (const regra of REGRAS_INTERNAS) {
    let hits = 0;
    for (const kw of regra.keywords) {
      if (alvo.includes(normalizar(kw))) hits++;
    }
    if (hits > 0 && (!melhor || hits > melhor.hits)) {
      melhor = { regra, hits };
    }
  }
  return melhor?.regra ?? null;
}

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { situacao } = await req.json();
    if (!situacao || situacao.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Descrição muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 1) Base interna: se bater com regra, usa como sugestão principal ----
    const regra = matchRegras(situacao);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      // Sem IA disponível: retorna direto a regra interna se houver. Isto
      // não tem relação com Lovable — é a base de palavras-chave própria
      // deste arquivo, que continua servindo de rede de segurança mesmo
      // com Gemini como único provedor de IA.
      if (regra) {
        return new Response(JSON.stringify({
          referencia_normativa: regra.referencias.join("\n"),
          gravidade: regra.gravidade,
          acao_corretiva: regra.acao,
          trecho_norma: regra.referencias[0],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("GEMINI_API_KEY não configurada");
    }
    const aiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const aiKey = GEMINI_API_KEY;
    const aiModel = "gemini-2.5-flash";

    const dicaInterna = regra
      ? `\n\nDICA DE BASE INTERNA (use como principal, adaptando à situação; pode acrescentar itens complementares se fizer sentido):\n${regra.referencias.map(r => `- ${r}`).join("\n")}\nGravidade sugerida pela base: ${regra.gravidade}\nAção corretiva sugerida pela base: ${regra.acao}`
      : "";

    const systemPrompt = `Você é um técnico de segurança do trabalho sênior, especialista em TODAS as Normas Regulamentadoras brasileiras vigentes (NR-01 a NR-38), com foco em precisão de item/subitem.

FORMATO OBRIGATÓRIO da "referencia_normativa":
"NORMA — ITEM/SUBITEM — DESCRIÇÃO CURTA DO REQUISITO"

Exemplos válidos:
- "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas contra acesso de trabalhadores não autorizados."
- "NR-18 — Item 18.6.12(c) — Dispositivos de manobra, controle e comando devem possuir condições para bloqueio e sinalização de impedimento de ligação."
- "NR-10 — Item 10.5.1 — Segurança em instalações elétricas desenergizadas, com seccionamento, impedimento de reenergização e sinalização."

REGRAS OBRIGATÓRIAS:
1. SEMPRE inclua item/subitem — nunca responda apenas "NR-XX — título genérico".
2. Se a situação envolver mais de uma norma aplicável, retorne MÚLTIPLAS linhas separadas por "\\n" na mesma string "referencia_normativa" (norma principal primeiro, complementares depois).
3. Priorize a norma MAIS ESPECÍFICA (ex.: canteiro de obra elétrico -> NR-18 antes de NR-10; NR-10 fica como complementar).
4. Anti-alucinação: só cite um item (ex.: 18.6.10) se tiver ALTA confiança. Se não tiver certeza do número exato, escreva:
   "NR-XX — Item a confirmar pelo responsável técnico — Descrição curta"
   NUNCA invente número (ex.: 12.135, 24.1.3) só para parecer preciso.
5. Descrição curta: 1 frase objetiva, com o requisito real da norma.
6. "gravidade": uma de "LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO". Choque elétrico, queda de altura ou espaço confinado sem controle = "GRAVE" ou "RISCO CRÍTICO".
7. "acao_corretiva": ação prática e específica (máx. 3 frases).
8. "trecho_norma": trecho resumido real da(s) norma(s) citada(s) (máx. 2 frases). Não invente trecho.

Base de NRs vigentes (Portaria MTE, gov.br/trabalho-e-emprego): NR-01, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38. Revogadas (ignorar): NR-02, NR-27.

Palavras-chave elétricas em canteiro (quadro elétrico, painel, disjuntor, sem trancamento, sem bloqueio, partes vivas, acesso não autorizado) -> priorizar NR-18 itens 18.6.10, 18.6.12(c), 18.6.17 e NR-10 itens 10.4.1 e 10.5.1 como complementares.${dicaInterna}`;

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
              description: "Retorna sugestão de NR(s), gravidade e ação corretiva.",
              parameters: {
                type: "object",
                properties: {
                  referencia_normativa: {
                    type: "string",
                    description: "Uma ou mais referências no formato 'NR-XX — Item X.X.X — Descrição', separadas por \\n quando houver mais de uma.",
                  },
                  gravidade: { type: "string", enum: ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"] },
                  acao_corretiva: { type: "string" },
                  trecho_norma: { type: "string" },
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
      // Fallback para regra interna se houver
      if (regra) {
        return new Response(JSON.stringify({
          referencia_normativa: regra.referencias.join("\n"),
          gravidade: regra.gravidade,
          acao_corretiva: regra.acao,
          trecho_norma: regra.referencias[0],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let result: any;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      result = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    }

    // Se a IA respondeu genérico demais (sem "Item") e temos regra interna, mesclar
    if (regra && result?.referencia_normativa && !/item/i.test(result.referencia_normativa)) {
      result.referencia_normativa = regra.referencias.join("\n");
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
