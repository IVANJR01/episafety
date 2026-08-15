import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { resolveCors } from "../_shared/cors.ts";
import { resolverProvedorIa, SEM_PROVEDOR } from "../_shared/provedorIa.ts";

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

    /*
     * O provedor agora é escolhido em tempo de execução: OpenAI quando a
     * OPENAI_API_KEY existe, Gemini como reserva. O corpo da requisição é o
     * mesmo nos dois — o Gemini sempre foi chamado pelo endpoint compatível
     * com a OpenAI —, então só mudam URL, chave e nome do modelo.
     */
    const provedor = resolverProvedorIa();
    if (!provedor) {
      // Sem IA configurada, a base de palavras-chave deste arquivo continua
      // valendo: é rede de segurança, não enfeite.
      if (regra) {
        return new Response(JSON.stringify({
          referencia_normativa: regra.referencias.join("\n"),
          gravidade: regra.gravidade,
          acao_corretiva: regra.acao,
          trecho_norma: regra.referencias[0],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(SEM_PROVEDOR);
    }
    const aiUrl = provedor.url;
    const aiKey = provedor.chave;
    const aiModel = provedor.modelo;

    const dicaInterna = regra
      ? `\n\nDICA DE BASE INTERNA (use como principal, adaptando à situação; pode acrescentar itens complementares se fizer sentido):\n${regra.referencias.map(r => `- ${r}`).join("\n")}\nGravidade sugerida pela base: ${regra.gravidade}\nAção corretiva sugerida pela base: ${regra.acao}`
      : "";

    const systemPrompt = `Você é um técnico de segurança do trabalho sênior e auditor especialista na legislação brasileira. Sua expertise abrange:
1. Normas Regulamentadoras (NR-01 a NR-38);
2. Instruções Técnicas do Corpo de Bombeiros, especificamente do Ceará (IT-CE) e Rio Grande do Norte (IT-RN);
3. Normas Técnicas Brasileiras (NBR / ABNT);
4. Legislação de Meio Ambiente (Resoluções CONAMA e Leis Ambientais);
5. Legislação de Trânsito (CTB, Resoluções CONTRAN e diretrizes SENATRAN).

FORMATO OBRIGATÓRIO da "referencia_normativa":
"NORMA — ITEM/SUBITEM/ARTIGO — DESCRIÇÃO CURTA DO REQUISITO"

Exemplos válidos:
- "NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis e protegidas."
- "IT-16/CE — Item 5.1.1 — Plano de emergência contra incêndio e pânico."
- "NBR 14136 — Item 4.1 — Padrão de plugues e tomadas."
- "CTB — Art. 167 — Deixar o condutor ou passageiro de usar o cinto de segurança."
- "CONAMA 275/01 — Art. 1º — Código de cores para resíduos."

REGRAS OBRIGATÓRIAS:
1. SEMPRE inclua item/subitem/artigo exato. Nunca responda apenas "NR-XX" ou "CTB" sem especificar onde.
2. Quase nenhuma situação real é coberta por uma norma só. Retorne MÚLTIPLAS linhas separadas por "\\n", com a norma principal primeiro, SEMPRE que houver norma complementar. Responder uma linha só quando cabem duas é resposta incompleta.
2.1. A NR diz O QUE é exigido; a NBR diz COMO se faz. Citada uma NR de instalação, equipamento ou sistema, procure a NBR correspondente e cite as duas. Exemplos de par: elétrica/aterramento -> NR-10 + NBR 5410 (baixa tensão) ou NBR 5419 (descargas atmosféricas); incêndio -> IT do Corpo de Bombeiros + NBR do sistema (extintor, hidrante, alarme); andaime -> NR-18 + NBR 6494; ergonomia de mobiliário -> NR-17 + NBR 13962.
2.2. Se a descrição citar Corpo de Bombeiros, CBMCE, CBMRN, AVCB, projeto aprovado ou laudo do Corpo de Bombeiros, a Instrução Técnica correspondente é OBRIGATÓRIA na resposta.
3. Anti-alucinação: só cite um NÚMERO DE ITEM se tiver ALTA confiança. Se não tiver certeza do número exato, escreva:
   "NORMA — Item a confirmar pelo responsável técnico — Descrição curta"
   NUNCA invente números de itens só para parecer preciso.
3.1. A dúvida sobre o NÚMERO nunca é motivo para OMITIR a norma. Quem lê é técnico de segurança e sabe localizar o item; o que ele não consegue é adivinhar que a NBR existe. Entre citar "NBR 5419 — Item a confirmar pelo responsável técnico — ..." e não citar a NBR, cite.
4. Descrição curta: 1 frase objetiva, com o requisito real da lei ou norma.
5. "gravidade": uma de "LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO". Choque, risco de explosão, atropelamento, contaminação ambiental grave ou espaço confinado = "GRAVE" ou "RISCO CRÍTICO".
6. "acao_corretiva": ação prática, imediata e específica (máx. 3 frases).
7. "trecho_norma": o que a(s) norma(s) citada(s) exigem, em texto corrido (2 a 4 frases). Cubra TODAS as normas citadas na referencia_normativa, não só a primeira. Este campo vai impresso no relatório de inspeção, abaixo da citação — é o que explica ao leitor o que a norma manda fazer. Não invente texto de lei: descreva o requisito.

Palavras-chave elétricas em canteiro (quadro, disjuntor) -> priorizar NR-18 e NR-10.
Trânsito (veículo, cinto, habilitação) -> focar em CTB/CONTRAN.
Meio ambiente (vazamento, óleo, lixo) -> focar em resoluções CONAMA.
Incêndio (extintor, alarme, rota de fuga) -> focar nas IT do Corpo de Bombeiros do Ceará e RN.${dicaInterna}`;

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
      if (response.status === 401 || response.status === 403) {
        // Erro mais provável logo depois de trocar de provedor: chave ausente,
        // colada com espaço, ou de um projeto sem crédito.
        console.error(`Chave de IA recusada pelo provedor ${provedor.nome}`);
        if (regra) {
          return new Response(JSON.stringify({
            referencia_normativa: regra.referencias.join("\n"),
            gravidade: regra.gravidade,
            acao_corretiva: regra.acao,
            trecho_norma: regra.referencias[0],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: "Chave de IA inválida ou sem permissão. Confira a configuração." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error(`AI (${provedor.nome}/${provedor.modelo}) error:`, response.status, t);
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
