import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const empresaId = formData.get("empresa_id") as string | null;
    const funcionarioNome = formData.get("funcionario_nome") as string | null;
    const funcionarioCargo = formData.get("funcionario_cargo") as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert PDF to base64 in chunks to avoid stack overflow
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Fetch requisitos_cliente for comparison
    let requisitos: any[] = [];
    const { data } = await supabase
      .from("requisitos_cliente")
      .select("*")
      .order("curso_nome");
    if (data) requisitos = data;

    const requisitosContext = requisitos.length > 0
      ? `\n\nMATRIZ DE REQUISITOS NEOENERGIA (Rev.12 - 24/09/2024 - Expansão AT, SE e LD):\nUse esta matriz como referência principal para validação. Cada curso possui carga horária mínima obrigatória e funções que o exigem.\n\n${requisitos.map(r =>
          `CURSO: "${r.curso_nome}" | Sinônimos aceitos: [${(r.sinonimos || []).join(", ")}] | Carga Horária MÍNIMA: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções que exigem: [${(r.funcoes_exigidas || []).join(", ")}]`
        ).join("\n")}`
      : "";

    const funcionarioContext = funcionarioNome
      ? `\n\nDADOS DO COLABORADOR SELECIONADO:\nNome: ${funcionarioNome}\nFunção/Cargo: ${funcionarioCargo || "Não informada"}\n\nIMPORTANTE: Compare o nome no certificado com "${funcionarioNome}". Se forem diferentes, ALERTE definindo alerta_nome=true.`
      : "";

    const systemPrompt = `Você é um especialista em análise de certificados de treinamento de segurança do trabalho no Brasil, com conhecimento profundo das Normas Regulamentadoras (NRs) e da Matriz de Capacitação da Neoenergia.

TAREFA: Analise o certificado/documento PDF enviado e extraia TODAS as informações possíveis.

EXTRAÇÃO OBRIGATÓRIA:
1. Nome completo do colaborador no certificado
2. CPF (se visível)
3. Nome exato do curso/treinamento
4. Carga horária (em horas)
5. Data de realização (formato YYYY-MM-DD)
6. Data de validade (se informada, formato YYYY-MM-DD)
7. Nome da instituição/entidade de ensino
8. Conteúdo programático completo (transcreva todos os tópicos encontrados no verso ou corpo do certificado)
${requisitosContext}
${funcionarioContext}

REGRAS DE VALIDAÇÃO CONTRA A MATRIZ NEOENERGIA:
1. Identifique qual curso da Matriz corresponde ao certificado (use os sinônimos para correspondência).
2. Compare a CARGA HORÁRIA do certificado com a carga horária MÍNIMA exigida na Matriz.
3. Se a função/cargo do colaborador estiver na lista de "funções que exigem" aquele curso, marque conforme_matriz=true APENAS se a carga horária for >= à mínima.
4. Se a carga horária for INFERIOR à exigida, marque conforme_matriz=false e explique no motivo.
5. Se o curso não for encontrado na Matriz, marque conforme_matriz=null.

FORMATO DA DESCRIÇÃO (campo descricao_completa):
Siga EXATAMENTE este padrão:
"Análise Automática (Matriz Rev.12): [NOME DA INSTITUIÇÃO] - [CARGA HORÁRIA]h. Status: [APROVADO/REPROVADO] conforme Matriz Neoenergia. [Se APROVADO: Validado para atividades de Expansão AT, SE e LD.] [Se REPROVADO: ATENÇÃO - Carga horária insuficiente (Xh apresentadas vs Yh exigidas pela Matriz Rev.12).] Conteúdo: [RESUMO DO CONTEÚDO PROGRAMÁTICO]."

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem código) no seguinte formato:
{
  "nome_certificado": "Nome que aparece no certificado",
  "cpf": "CPF ou null",
  "curso": "Nome do curso identificado",
  "carga_horaria": 40,
  "data_realizacao": "2024-01-15",
  "data_validade": "2026-01-15",
  "instituicao": "Nome da instituição",
  "conteudo_programatico": "Lista completa dos tópicos do conteúdo programático",
  "descricao_completa": "Descrição formatada conforme padrão acima",
  "alerta_nome": false,
  "alerta_nome_msg": "",
  "conforme_matriz": true,
  "motivo_nao_conforme": "",
  "requisito_atendido": "Nome do requisito da Matriz atendido ou null",
  "confianca": 0.95
}`;

    // Use tool calling for structured output
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
          {
            role: "user",
            content: `Analise este certificado/documento de treinamento. O conteúdo do PDF em base64 está abaixo:\n\n${base64}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_certificate",
              description: "Retorna os dados extraídos e validados do certificado de treinamento",
              parameters: {
                type: "object",
                properties: {
                  nome_certificado: { type: "string", description: "Nome do colaborador no certificado" },
                  cpf: { type: "string", description: "CPF encontrado ou string vazia" },
                  curso: { type: "string", description: "Nome do curso identificado" },
                  carga_horaria: { type: "number", description: "Carga horária em horas" },
                  data_realizacao: { type: "string", description: "Data de realização YYYY-MM-DD" },
                  data_validade: { type: "string", description: "Data de validade YYYY-MM-DD ou string vazia" },
                  instituicao: { type: "string", description: "Nome da instituição" },
                  conteudo_programatico: { type: "string", description: "Conteúdo programático completo" },
                  descricao_completa: { type: "string", description: "Descrição formatada conforme padrão" },
                  alerta_nome: { type: "boolean", description: "Se o nome diverge do colaborador selecionado" },
                  alerta_nome_msg: { type: "string", description: "Mensagem de alerta sobre divergência de nome" },
                  conforme_matriz: { type: "boolean", description: "Se atende à Matriz Neoenergia" },
                  motivo_nao_conforme: { type: "string", description: "Motivo da não conformidade" },
                  requisito_atendido: { type: "string", description: "Nome do requisito atendido" },
                  confianca: { type: "number", description: "Nível de confiança 0-1" },
                },
                required: ["nome_certificado", "curso", "carga_horaria", "descricao_completa", "conforme_matriz", "confianca"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_certificate" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar documento com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    
    // Extract from tool call response
    let parsed: any = null;
    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = typeof toolCall.function.arguments === "string" 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
        parsed = args;
      }
    } catch (e) {
      console.error("Failed to parse tool call:", e);
    }

    // Fallback: try parsing content directly
    if (!parsed) {
      try {
        const content = aiResult.choices?.[0]?.message?.content || "";
        const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const content = aiResult.choices?.[0]?.message?.content || "";
        parsed = {
          curso: "Não identificado",
          descricao_completa: content || "IA não conseguiu analisar o documento",
          confianca: 0.3,
          conforme_matriz: false,
          motivo_nao_conforme: "IA não conseguiu estruturar a resposta",
          carga_horaria: 0,
          nome_certificado: "",
        };
      }
    }

    return new Response(JSON.stringify({ success: true, analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-certificate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
