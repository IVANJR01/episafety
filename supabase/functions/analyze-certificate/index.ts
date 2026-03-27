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
    const bytes = new Uint8Array(arrayBuffer);
    
    // Build base64 in chunks to avoid stack overflow
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    
    // Check file size - if too large, warn
    const fileSizeMB = bytes.length / (1024 * 1024);
    console.log(`Processing file: ${file.name}, size: ${fileSizeMB.toFixed(2)}MB`);

    // Fetch requisitos_cliente for Neoenergia matrix comparison
    let requisitos: any[] = [];
    const { data } = await supabase
      .from("requisitos_cliente")
      .select("*")
      .order("curso_nome");
    if (data) requisitos = data;

    const requisitosContext = requisitos.length > 0
      ? `\n\nMATRIZ DE REQUISITOS NEOENERGIA (Rev.12 - 24/09/2024 - Expansão AT, SE e LD):\n${requisitos.map(r =>
          `CURSO: "${r.curso_nome}" | Sinônimos: [${(r.sinonimos || []).join(", ")}] | Carga Horária MÍNIMA: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções exigidas: [${(r.funcoes_exigidas || []).join(", ")}]`
        ).join("\n")}`
      : "";

    const funcionarioContext = funcionarioNome
      ? `\nDADOS DO COLABORADOR:\nNome: ${funcionarioNome}\nFunção/Cargo: ${funcionarioCargo || "Não informada"}\nIMPORTANTE: Compare o nome no certificado com "${funcionarioNome}". Se forem diferentes, defina alerta_nome=true.`
      : "";

    const systemPrompt = `Você é um auditor técnico especialista em Segurança do Trabalho no Brasil, com domínio completo das Normas Regulamentadoras (NRs) do Ministério do Trabalho e Emprego (MTE) e da Matriz de Capacitação da Neoenergia.

TAREFA: Analise o certificado/documento PDF e realize uma DUPLA VALIDAÇÃO:
1º) Validação Legal — Se atende à NR correspondente (legislação do governo).
2º) Validação Contratual — Se atende à Matriz Neoenergia Rev.12.

BASE DE CONHECIMENTO NORMATIVA (NRs vigentes - MTE):

NR-01 (Disposições Gerais / GRO / PGR):
- Treinamento de integração obrigatório antes do início das atividades
- Deve conter: direitos e deveres, riscos da operação, medidas de proteção
- Validade: definida pelo empregador conforme análise de risco

NR-05 (CIPA / Comissão Interna de Prevenção de Acidentes e de Assédio):
- Carga horária mínima: 20h
- Conteúdo obrigatório: metodologia de investigação de acidentes, noções de legislação trabalhista e previdenciária, organização da CIPA

NR-06 (EPI):
- Treinamento sobre uso, higienização, guarda e conservação do EPI
- Registro obrigatório de fornecimento

NR-10 (Segurança em Instalações e Serviços em Eletricidade):
- Curso Básico: mínimo 40h | Validade: 2 anos (reciclagem bienal)
- Curso SEP (Sistema Elétrico de Potência): mínimo 40h | Validade: 2 anos
- Conteúdo programático obrigatório: introdução à segurança com eletricidade, riscos em instalações e serviços com eletricidade, técnicas de análise de risco, medidas de controle do risco elétrico, normas técnicas brasileiras, regulamentações do MTE, equipamentos de proteção coletiva e individual, rotinas de trabalho e procedimentos, documentação de instalações elétricas, riscos adicionais, proteção e combate a incêndios, acidentes de origem elétrica, primeiros socorros, responsabilidades
- OBRIGATÓRIO: nome e registro profissional do instrutor (CREA/CFT)

NR-11 (Transporte, Movimentação, Armazenagem e Manuseio de Materiais):
- Operadores devem possuir treinamento específico conforme tipo de equipamento
- Validade: definida pelo empregador

NR-12 (Segurança no Trabalho em Máquinas e Equipamentos):
- Carga horária compatível com a complexidade da máquina/equipamento
- Validade: definida pelo empregador, com reciclagem quando houver mudanças

NR-18 (Segurança e Saúde no Trabalho na Indústria da Construção):
- Treinamento admissional: mínimo 6h
- Conteúdo: informações sobre condições e meio ambiente de trabalho, riscos inerentes, EPIs, EPCs

NR-20 (Segurança e Saúde com Inflamáveis e Combustíveis):
- Curso Básico: 8h | Intermediário: 16h | Avançado I: 24h | Avançado II: 32h | Específico: 16h
- Validade: 3 anos (reciclagem com carga horária mínima de 4h para Básico, 4h para Intermediário, 8h para Avançados)

NR-23 (Proteção Contra Incêndios):
- Treinamento obrigatório para toda a força de trabalho
- Conteúdo: utilização de extintores, procedimentos de evacuação

NR-33 (Segurança e Saúde nos Trabalhos em Espaços Confinados):
- Trabalhadores autorizados e vigias: mínimo 16h
- Supervisores de entrada: mínimo 40h
- Validade: anual (reciclagem)
- Conteúdo obrigatório: definições, reconhecimento, avaliação, monitoramento e controle de riscos, critérios de indicação e uso de EPIs, operação de equipamentos de comunicação, resgate e primeiros socorros

NR-35 (Trabalho em Altura):
- Carga horária mínima: 8h (teórico e prático)
- Validade: 2 anos (reciclagem bienal)
- Conteúdo obrigatório: normas e regulamentos, análise de risco e condições impeditivas, riscos potenciais inerentes ao trabalho em altura, medidas de prevenção e controle, sistemas e equipamentos de proteção coletiva e individual, EPIs, acidentes típicos, condutas de emergência e resgate, noções de primeiros socorros
- OBRIGATÓRIO: nome e registro profissional do instrutor

REGRAS DE VALIDAÇÃO:

VALIDAÇÃO LEGAL (NR):
- Verifique se a carga horária atende ao MÍNIMO exigido pela NR específica
- Verifique se o conteúdo programático cobre os tópicos OBRIGATÓRIOS da NR
- Verifique presença do nome do instrutor e registro profissional (CREA, CFT, CRM, etc.)
- Se faltar instrutor/registro, marque conforme_nr=false com explicação
- Verifique a validade do certificado conforme periodicidade da NR

VALIDAÇÃO CONTRATUAL (Matriz Neoenergia Rev.12):
- Identifique o curso correspondente na Matriz usando sinônimos
- Compare carga horária com o mínimo da Matriz
- Verifique se a função/cargo do colaborador está na lista de funções exigidas
${requisitosContext}
${funcionarioContext}

FORMATO DA DESCRIÇÃO (campo descricao_completa):
Se VÁLIDO nas duas verificações:
"✅ VALIDADO: Atende aos requisitos técnicos da [NR-XX] (carga horária: Xh ≥ Yh mínimas) e da Matriz Neoenergia Rev.12. Instrutor: [NOME] ([REGISTRO]). Instituição: [NOME]. Conteúdo verificado: [Lista resumida de tópicos principais]."

Se INVÁLIDO por NR:
"❌ INVÁLIDO: Certificado em desacordo com a [NR-XX]. [MOTIVO DETALHADO - ex: Carga horária insuficiente (Xh < Yh exigidas), ausência de registro do instrutor, conteúdo programático incompleto]. Itens faltantes: [LISTA]."

Se INVÁLIDO por Matriz Neoenergia:
"⚠️ ATENÇÃO: Atende à [NR-XX] mas NÃO atende à Matriz Neoenergia Rev.12. [MOTIVO - ex: Carga horária Xh < Yh exigidas pela Matriz]."`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise este certificado/documento de treinamento em PDF (codificado em base64). Extraia TODAS as informações de TODAS as páginas (frente e verso), incluindo o conteúdo programático, nome do instrutor e registro profissional.\n\nPDF em Base64:\n${base64}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_certificate",
              description: "Retorna os dados extraídos e validados do certificado",
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
                  instrutor_nome: { type: "string", description: "Nome do instrutor/responsável técnico" },
                  instrutor_registro: { type: "string", description: "Registro profissional do instrutor (CREA, CFT, etc.)" },
                  conteudo_programatico: { type: "string", description: "Conteúdo programático completo" },
                  descricao_completa: { type: "string", description: "Descrição formatada conforme padrão" },
                  alerta_nome: { type: "boolean", description: "Se o nome diverge do colaborador selecionado" },
                  alerta_nome_msg: { type: "string", description: "Mensagem de alerta sobre divergência" },
                  nr_referencia: { type: "string", description: "NR de referência identificada (ex: NR-10, NR-35)" },
                  conforme_nr: { type: "boolean", description: "Se atende à NR correspondente" },
                  motivo_nr: { type: "string", description: "Detalhes da validação contra a NR" },
                  conforme_matriz: { type: "boolean", description: "Se atende à Matriz Neoenergia" },
                  motivo_nao_conforme: { type: "string", description: "Motivo da não conformidade com a Matriz" },
                  requisito_atendido: { type: "string", description: "Nome do requisito da Matriz atendido" },
                  confianca: { type: "number", description: "Nível de confiança 0-1" },
                },
                required: ["nome_certificado", "curso", "carga_horaria", "descricao_completa", "conforme_nr", "conforme_matriz", "confianca"],
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
          conforme_nr: false,
          conforme_matriz: false,
          motivo_nr: "IA não conseguiu estruturar a resposta",
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
