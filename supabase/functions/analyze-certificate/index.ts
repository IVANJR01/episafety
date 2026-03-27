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

    // Convert PDF to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Fetch requisitos_cliente for comparison
    let requisitos: any[] = [];
    if (empresaId) {
      const { data } = await supabase
        .from("requisitos_cliente")
        .select("*")
        .or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      if (data) requisitos = data;
    }

    const requisitosContext = requisitos.length > 0
      ? `\n\nMATRIZ DE REQUISITOS DO CLIENTE:\n${requisitos.map(r =>
          `- Curso: ${r.curso_nome} | Sinônimos: ${(r.sinonimos || []).join(", ")} | Carga Horária Mínima: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções Exigidas: ${(r.funcoes_exigidas || []).join(", ")}`
        ).join("\n")}`
      : "";

    const funcionarioContext = funcionarioNome
      ? `\n\nDADOS DO COLABORADOR SELECIONADO:\nNome: ${funcionarioNome}\nFunção: ${funcionarioCargo || "Não informada"}`
      : "";

    const systemPrompt = `Você é um especialista em análise de certificados e documentos de treinamento de segurança do trabalho no Brasil.

Analise o documento PDF enviado e extraia as seguintes informações:
1. Nome completo do colaborador que aparece no certificado
2. CPF (se visível)
3. Nome do curso/treinamento
4. Carga horária do curso
5. Data de realização
6. Data de validade (se informada)
7. Instituição/entidade de ensino
8. Resumo do conteúdo programático (se disponível no documento)
${requisitosContext}
${funcionarioContext}

INSTRUÇÕES DE VALIDAÇÃO:
- Se houver Matriz de Requisitos, compare o certificado com os requisitos e informe se atende ou não.
- Compare a carga horária do certificado com a carga horária mínima exigida.
- Se o nome no certificado for diferente do colaborador selecionado, ALERTE.
- Se a função do colaborador estiver nas funções exigidas de algum requisito, verifique se o certificado atende.

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem código) no seguinte formato:
{
  "nome_certificado": "Nome que aparece no certificado",
  "cpf": "CPF encontrado ou null",
  "curso": "Nome do curso identificado",
  "carga_horaria": 40,
  "data_realizacao": "2024-01-15",
  "data_validade": "2026-01-15",
  "instituicao": "Nome da instituição",
  "conteudo_programatico": "Resumo do conteúdo",
  "descricao_completa": "[INSTITUIÇÃO] - [CARGA HORÁRIA]h. Status: [APROVADO/REPROVADO] conforme Matriz. Conteúdo: [RESUMO]",
  "alerta_nome": false,
  "alerta_nome_msg": "",
  "conforme_matriz": true,
  "motivo_nao_conforme": "",
  "requisito_atendido": "Nome do requisito atendido ou null",
  "confianca": 0.95
}`;

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
            content: [
              { type: "text", text: "Analise este certificado/documento de treinamento e extraia todas as informações solicitadas." },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
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
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Try to parse JSON from response
    let parsed: any = null;
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = {
        curso: "Não identificado",
        descricao_completa: content,
        confianca: 0.3,
        conforme_matriz: false,
        motivo_nao_conforme: "IA não conseguiu estruturar a resposta",
      };
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
