import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    const funcionarioCpf = formData.get("funcionario_cpf") as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`Processing file: ${file.name}, size: ${fileSizeMB}MB`);

    const pdfBase64 = base64Encode(buffer);

    // Fetch requisitos_cliente for Neoenergia matrix comparison
    let requisitos: any[] = [];
    const { data } = await supabase
      .from("requisitos_cliente")
      .select("*")
      .order("curso_nome");
    if (data) requisitos = data;

    // Also fetch existing trainings for this employee (cross-validation)
    let treinamentosExistentes = "";
    if (funcionarioNome && empresaId) {
      const { data: treinos } = await supabase
        .from("controle_treinamentos")
        .select("nome_curso, data_realizacao, data_renovacao")
        .eq("empresa_id", empresaId);
      if (treinos && treinos.length > 0) {
        treinamentosExistentes = `\n\nTREINAMENTOS JÁ CADASTRADOS NO SISTEMA PARA ESTE COLABORADOR:\n${treinos.map(t =>
          `- ${t.nome_curso} | Realização: ${t.data_realizacao} | Validade: ${t.data_renovacao || "Não informada"}`
        ).join("\n")}`;
      }
    }

    const requisitosContext = requisitos.length > 0
      ? `\n\nMATRIZ DE REQUISITOS NEOENERGIA (Rev.12 - 24/09/2024 - Expansão AT, SE e LD):\n${requisitos.map(r =>
          `CURSO: "${r.curso_nome}" | Sinônimos: [${(r.sinonimos || []).join(", ")}] | Carga Horária MÍNIMA: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções exigidas: [${(r.funcoes_exigidas || []).join(", ")}]`
        ).join("\n")}`
      : "";

    const funcionarioContext = funcionarioNome
      ? `\nDADOS DO COLABORADOR SELECIONADO:\nNome: ${funcionarioNome}\nCPF: ${funcionarioCpf || "Não informado"}\nFunção/Cargo: ${funcionarioCargo || "Não informada"}\n\nREGRAS DE IDENTIFICAÇÃO:\n- Use o CPF "${funcionarioCpf || ""}" como CHAVE PRIMÁRIA de identificação infalível.\n- Se o CPF do documento coincidir com "${funcionarioCpf || ""}", o colaborador é o MESMO, independentemente de variações no nome (abreviações, nome do meio, acentos).\n- Só defina alerta_nome=true se AMBOS nome E CPF forem completamente diferentes.${treinamentosExistentes}`
      : "";

    const systemPrompt = `Você é um auditor técnico especialista em Segurança do Trabalho no Brasil, com domínio completo das Normas Regulamentadoras (NRs) do MTE e da Matriz de Capacitação da Neoenergia.

TAREFA: Analise o documento PDF enviado. O documento pode ser:
1) Um CERTIFICADO de treinamento/curso
2) Uma ANUÊNCIA/AUTORIZAÇÃO FORMAL (conforme item 10.8.4 da NR-10)
3) Outro documento de segurança do trabalho

Primeiro, IDENTIFIQUE O TIPO DE DOCUMENTO, depois aplique a validação correspondente.

=== REGRAS PARA ANUÊNCIA / AUTORIZAÇÃO FORMAL (Item 10.8.4 NR-10) ===

O item 10.8.4 da NR-10 estabelece:
"São considerados autorizados os trabalhadores qualificados ou capacitados e os profissionais habilitados, com anuência formal da empresa."

VALIDAÇÃO DE ANUÊNCIA:
- A Anuência é VÁLIDA se contiver: (a) identificação do colaborador (nome e CPF), (b) declaração explícita de autorização/anuência da empresa, (c) assinatura do Responsável Técnico (Engenheiro com CREA).
- REGRA CRÍTICA: Se o colaborador possuir certificados válidos de NR-10 Básico e NR-10 SEP no sistema, a Anuência para intervenção em circuitos energizados é VÁLIDA, INDEPENDENTEMENTE do cargo nominal (ex: um "Operador de Betoneira" com NR-10 Básico + SEP válidos ESTÁ APTO).
- O cargo no documento pode diferir do cargo no sistema — isto NÃO invalida a anuência se os treinamentos estão em dia.
- A validade da Anuência está atrelada à data de vencimento do treinamento mais antigo (Básico ou SEP). Se um dos cursos vencer, o status deve ser "⚠️ Anuência Suspensa por Treinamento Vencido".
- Para Anuência VÁLIDA, use na descricao_completa: "✅ Anuência Formal validada conforme item 10.8.4 da NR-10. Colaborador capacitado e autorizado pelo Responsável Técnico [NOME] ([CREA]). [Detalhes adicionais]."

=== BASE DE CONHECIMENTO NORMATIVA (NRs vigentes - MTE) ===

NR-10 (Segurança em Instalações e Serviços em Eletricidade):
- Curso Básico: mínimo 40h | Validade: 2 anos (reciclagem bienal, item 10.8.8.2)
- Curso SEP (Sistema Elétrico de Potência): mínimo 40h | Validade: 2 anos
- Conteúdo programático obrigatório: introdução à segurança com eletricidade, riscos em instalações e serviços com eletricidade, técnicas de análise de risco, medidas de controle do risco elétrico, normas técnicas brasileiras, regulamentações do MTE, equipamentos de proteção coletiva e individual, rotinas de trabalho e procedimentos, documentação de instalações elétricas, riscos adicionais, proteção e combate a incêndios, acidentes de origem elétrica, primeiros socorros, responsabilidades
- OBRIGATÓRIO: nome e registro profissional do instrutor (CREA/CFT)

NR-01 (Disposições Gerais / GRO / PGR): Treinamento de integração obrigatório antes do início das atividades.
NR-05 (CIPA): Carga horária mínima 20h.
NR-06 (EPI): Treinamento sobre uso, higienização, guarda e conservação.
NR-11 (Transporte/Movimentação): Treinamento específico por tipo de equipamento.
NR-12 (Máquinas/Equipamentos): Carga compatível com complexidade.
NR-18 (Construção): Admissional mínimo 6h.
NR-20 (Inflamáveis): Básico 8h, Intermediário 16h, Avançado I 24h, Avançado II 32h. Validade: 3 anos.
NR-23 (Incêndios): Treinamento obrigatório para toda a força de trabalho.
NR-33 (Espaços Confinados): Autorizados/Vigias 16h, Supervisores 40h. Validade: anual.
NR-35 (Trabalho em Altura): Mínimo 8h (teórico + prático). Validade: 2 anos.

=== REGRAS DE FUZZY MATCHING PARA CURSOS ===

Ao identificar o nome do curso, normalize para o padrão do sistema:
- "Curso de NR10 Básico", "NR10", "NR-10 Básico", "NR 10 Básico", "Segurança em Instalações Elétricas" → "NR 10"
- "NR10 SEP", "NR-10 SEP", "NR 10 SEP", "Sistema Elétrico de Potência" → "NR 10 SEP"
- "NR35", "NR-35", "Trabalho em Altura" → "NR 35"
- "NR33", "NR-33", "Espaço Confinado" → "NR 33"
- Se for Anuência/Autorização, use: "Anuência NR 10" ou "Autorização Formal NR 10"
- Use SEMPRE o formato "NR XX" (com espaço) para normalização.

=== VALIDAÇÃO LEGAL E CONTRATUAL ===

VALIDAÇÃO LEGAL (NR):
- Verifique carga horária mínima conforme NR específica
- Verifique conteúdo programático (se disponível)
- Verifique presença do nome do instrutor e registro profissional (CREA, CFT, CRM)
- Verifique validade conforme periodicidade da NR

VALIDAÇÃO CONTRATUAL (Matriz Neoenergia Rev.12):
- Identifique o curso na Matriz usando sinônimos
- Compare carga horária com o mínimo da Matriz
- Verifique se a função do colaborador está na lista de funções exigidas
- EXCEÇÃO: Se o colaborador tem os cursos necessários no sistema, valide mesmo que o cargo nominal não esteja na lista
${requisitosContext}
${funcionarioContext}

=== FORMATO DAS DATAS ===
Converta TODAS as datas para formato YYYY-MM-DD (ex: 20/07/2024 → 2024-07-20).

=== FORMATO DA DESCRIÇÃO (campo descricao_completa) ===

NUNCA deixe este campo vazio. SEMPRE concatene os dados extraídos:

Para CERTIFICADO VÁLIDO:
"✅ VALIDADO: Atende aos requisitos da [NR-XX] (carga horária: Xh ≥ Yh mínimas) e da Matriz Neoenergia Rev.12. Instrutor: [NOME] ([REGISTRO]). Instituição: [NOME]. Conteúdo verificado: [resumo dos tópicos principais]."

Para ANUÊNCIA VÁLIDA:
"✅ Anuência Formal validada conforme item 10.8.4 da NR-10. Colaborador capacitado e autorizado pelo Responsável Técnico [NOME] ([CREA]). Empresa: [NOME]. Data: [DATA]."

Para INVÁLIDO por NR:
"❌ INVÁLIDO: Certificado em desacordo com a [NR-XX]. [MOTIVO DETALHADO]. Itens faltantes: [LISTA]."

Para INVÁLIDO por Matriz:
"⚠️ ATENÇÃO: Atende à [NR-XX] mas NÃO atende à Matriz Neoenergia Rev.12. [MOTIVO]."`;

    console.log("Sending request to AI gateway...");
    
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
              {
                type: "text",
                text: `Analise este documento PDF de segurança do trabalho. 
Extraia TODAS as informações de TODAS as páginas (frente e verso), incluindo:
- Conteúdo programático (geralmente na página 2 / verso)
- Nome e registro profissional do instrutor/responsável técnico
- CPF do colaborador
- Datas (converter para YYYY-MM-DD)
- Entidade/Instituição emissora
- Carga horária
Identifique primeiro se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_certificate",
              description: "Retorna os dados extraídos e validados do certificado ou anuência",
              parameters: {
                type: "object",
                properties: {
                  nome_certificado: { type: "string", description: "Nome do colaborador no documento" },
                  cpf: { type: "string", description: "CPF encontrado no documento" },
                  curso: { type: "string", description: "Nome do curso normalizado (ex: 'NR 10', 'Anuência NR 10')" },
                  carga_horaria: { type: "number", description: "Carga horária em horas (0 se for anuência)" },
                  data_realizacao: { type: "string", description: "Data de realização/emissão YYYY-MM-DD" },
                  data_validade: { type: "string", description: "Data de validade YYYY-MM-DD" },
                  instituicao: { type: "string", description: "Entidade/Instituição emissora" },
                  instrutor_nome: { type: "string", description: "Nome do instrutor ou responsável técnico" },
                  instrutor_registro: { type: "string", description: "Registro profissional (CREA, CFT, etc.)" },
                  conteudo_programatico: { type: "string", description: "Conteúdo programático completo extraído" },
                  descricao_completa: { type: "string", description: "Descrição formatada conforme padrão - NUNCA deixar vazio" },
                  alerta_nome: { type: "boolean", description: "true SOMENTE se nome E CPF divergem do colaborador" },
                  alerta_nome_msg: { type: "string", description: "Mensagem de alerta sobre divergência" },
                  nr_referencia: { type: "string", description: "NR de referência (ex: NR-10, NR-35)" },
                  conforme_nr: { type: "boolean", description: "Se atende à NR correspondente" },
                  motivo_nr: { type: "string", description: "Detalhes da validação contra a NR" },
                  conforme_matriz: { type: "boolean", description: "Se atende à Matriz Neoenergia" },
                  motivo_nao_conforme: { type: "string", description: "Motivo da não conformidade" },
                  requisito_atendido: { type: "string", description: "Requisito da Matriz atendido" },
                  confianca: { type: "number", description: "Nível de confiança 0.0 a 1.0" },
                },
                required: ["nome_certificado", "curso", "carga_horaria", "descricao_completa", "conforme_nr", "conforme_matriz", "confianca"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_certificate" } },
      }),
    });

    console.log(`AI gateway response status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway error ${response.status}: ${errText}`);
      
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
      
      // If PDF format is rejected, try as text-only fallback
      if (response.status === 400 || response.status === 422) {
        console.log("PDF format rejected, trying text-only fallback...");
        
        const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `Analise este documento de segurança do trabalho. O conteúdo do PDF está codificado em base64 abaixo. Extraia TODAS as informações de TODAS as páginas.
Identifique se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL.
Converta datas para formato YYYY-MM-DD.

Nome do arquivo: ${file.name}

PDF em Base64 (decodifique e analise):
${pdfBase64.substring(0, 50000)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "analyze_certificate",
                  description: "Retorna os dados extraídos e validados do certificado ou anuência",
                  parameters: {
                    type: "object",
                    properties: {
                      nome_certificado: { type: "string", description: "Nome do colaborador no documento" },
                      cpf: { type: "string", description: "CPF encontrado no documento" },
                      curso: { type: "string", description: "Nome do curso normalizado" },
                      carga_horaria: { type: "number", description: "Carga horária em horas" },
                      data_realizacao: { type: "string", description: "Data YYYY-MM-DD" },
                      data_validade: { type: "string", description: "Data de validade YYYY-MM-DD" },
                      instituicao: { type: "string", description: "Instituição emissora" },
                      instrutor_nome: { type: "string", description: "Nome do instrutor/responsável técnico" },
                      instrutor_registro: { type: "string", description: "Registro profissional" },
                      conteudo_programatico: { type: "string", description: "Conteúdo programático" },
                      descricao_completa: { type: "string", description: "Descrição formatada - NUNCA vazio" },
                      alerta_nome: { type: "boolean" },
                      alerta_nome_msg: { type: "string" },
                      nr_referencia: { type: "string" },
                      conforme_nr: { type: "boolean" },
                      motivo_nr: { type: "string" },
                      conforme_matriz: { type: "boolean" },
                      motivo_nao_conforme: { type: "string" },
                      requisito_atendido: { type: "string" },
                      confianca: { type: "number" },
                    },
                    required: ["nome_certificado", "curso", "carga_horaria", "descricao_completa", "conforme_nr", "conforme_matriz", "confianca"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "analyze_certificate" } },
          }),
        });

        if (!fallbackResponse.ok) {
          const fallbackErr = await fallbackResponse.text();
          console.error(`Fallback also failed ${fallbackResponse.status}: ${fallbackErr}`);
          return new Response(JSON.stringify({ error: "Erro ao processar documento com IA" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const fallbackResult = await fallbackResponse.json();
        const parsed = extractAnalysis(fallbackResult);
        console.log("Fallback analysis successful");
        return new Response(JSON.stringify({ success: true, analysis: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao processar documento com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    console.log("AI response received, extracting analysis...");
    const parsed = extractAnalysis(aiResult);
    console.log(`Analysis complete: curso=${parsed.curso}, confianca=${parsed.confianca}`);

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

function extractAnalysis(aiResult: any): any {
  // Try tool call response first
  try {
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      console.log("Parsed from tool call successfully");
      return args;
    }
  } catch (e) {
    console.error("Failed to parse tool call:", e);
  }

  // Fallback: try content as JSON
  try {
    const content = aiResult.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const content = aiResult.choices?.[0]?.message?.content || "";
    return {
      curso: "Não identificado",
      descricao_completa: content || "IA não conseguiu analisar o documento",
      confianca: 0.3,
      conforme_nr: false,
      conforme_matriz: false,
      motivo_nr: "IA não conseguiu estruturar a resposta",
      motivo_nao_conforme: "IA não conseguiu estruturar a resposta",
      carga_horaria: 0,
      nome_certificado: "",
    };
  }
}
