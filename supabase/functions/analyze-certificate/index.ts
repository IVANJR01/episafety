import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(requisitosContext: string, funcionarioContext: string): string {
  return `Você é um auditor técnico especialista em Segurança do Trabalho no Brasil, com domínio completo das Normas Regulamentadoras (NRs) do MTE e da Matriz de Capacitação da Neoenergia.

TAREFA: Analise o documento PDF enviado. O documento pode ser:
1) Um CERTIFICADO de treinamento/curso
2) Uma ANUÊNCIA/AUTORIZAÇÃO FORMAL para NR-10 (item 10.8.4) ou NR-12 (item 12.16.1) ou outra NR
3) Outro documento de segurança do trabalho

Primeiro, IDENTIFIQUE O TIPO DE DOCUMENTO e a NR correspondente, depois aplique a validação correspondente.

=== REGRAS PARA ANUÊNCIA / AUTORIZAÇÃO FORMAL NR-10 (Item 10.8.4) ===

O item 10.8.4 da NR-10 estabelece:
"São considerados autorizados os trabalhadores qualificados ou capacitados e os profissionais habilitados, com anuência formal da empresa."

VALIDAÇÃO DE ANUÊNCIA NR-10:
- A Anuência é VÁLIDA se contiver: (a) identificação do colaborador (nome e CPF), (b) declaração explícita de autorização/anuência da empresa, (c) assinatura do Responsável Técnico (Engenheiro com CREA).
- REGRA CRÍTICA: Se o colaborador possuir certificados válidos de NR-10 Básico e NR-10 SEP no sistema, a Anuência para intervenção em circuitos energizados é VÁLIDA, INDEPENDENTEMENTE do cargo nominal (ex: um "Operador de Betoneira" com NR-10 Básico + SEP válidos ESTÁ APTO).
- O cargo no documento pode diferir do cargo no sistema — isto NÃO invalida a anuência se os treinamentos estão em dia.
- A validade da Anuência está atrelada à data de vencimento do treinamento mais antigo (Básico ou SEP). Se um dos cursos vencer, o status deve ser "⚠️ Anuência Suspensa por Treinamento Vencido".
- Para Anuência NR-10 VÁLIDA, use na descricao_completa: "✅ Anuência Formal validada conforme item 10.8.4 da NR-10. Colaborador capacitado e autorizado pelo Responsável Técnico [NOME] ([CREA]). [Detalhes adicionais]."

=== REGRAS PARA ANUÊNCIA / AUTORIZAÇÃO FORMAL NR-12 (Item 12.16.1) ===

A NR-12 (Segurança no Trabalho em Máquinas e Equipamentos) exige:
- Item 12.16.1: A operação, manutenção, inspeção e demais intervenções em máquinas e equipamentos devem ser realizadas por trabalhadores habilitados, qualificados, capacitados ou autorizados para este fim.
- Item 12.16.2: Os trabalhadores devem receber capacitação compatível com suas funções, que aborde os riscos específicos das máquinas e equipamentos.
- Item 12.16.3: A capacitação deve ser realizada antes que o trabalhador assuma a função e revisada quando houver modificações significativas.
- Item 12.16.4: O conteúdo programático da capacitação deve incluir: descrição e identificação dos riscos, funcionamento e proteções da máquina, medidas de proteção, como e por que utilizar as proteções, procedimentos seguros de operação.

VALIDAÇÃO DE ANUÊNCIA NR-12:
- A Anuência NR-12 é VÁLIDA se contiver: (a) identificação do colaborador (nome e CPF), (b) identificação da máquina/equipamento autorizado, (c) declaração de autorização da empresa, (d) assinatura do Responsável Técnico.
- REGRA DE FUNÇÃO: Se o cargo do colaborador é compatível com a máquina citada (ex: "Operador de Betoneira" autorizado para "Betoneira"), validar como CONFORME desde que exista treinamento de NR-12 ou operação segura de máquinas vinculado.
- Validade recomendada: 12 meses (ou conforme definido pelo PCMSO/PGR da empresa).
- ALERTA DE EQUIPAMENTO: Se a anuência autoriza um equipamento específico, emitir nota: "⚠️ Autorização restrita ao equipamento citado no documento."
- Para Anuência NR-12 VÁLIDA, use: "✅ Anuência NR-12 Validada. Colaborador autorizado para operação de [EQUIPAMENTO] conforme item 12.16.1 da norma vigente. Responsável Técnico: [NOME] ([CREA])."
- Para Anuência NR-12 INVÁLIDA: "❌ INVÁLIDO: Anuência NR-12 em desacordo. [MOTIVO]. Verifique treinamento específico para o equipamento."
- Normalize o curso como: "Anuência NR 12" ou "Anuência NR 12 - [EQUIPAMENTO]"

=== BASE DE CONHECIMENTO NORMATIVA (NRs vigentes - MTE/Gov.br - Atualizado 2025) ===

NR-01 (Disposições Gerais e Gerenciamento de Riscos Ocupacionais - GRO/PGR):
- Treinamento de integração obrigatório ANTES do início das atividades
- Capacitação e treinamento devem ser realizados por trabalhadores ou profissionais qualificados
- Validade: conforme periodicidade estabelecida no PGR ou norma específica

NR-05 (CIPA - Comissão Interna de Prevenção de Acidentes e de Assédio):
- Carga horária mínima: 20h (distribuídas em no máximo 8h diárias)
- Validade: mandato de 1 ano, treinamento no prazo de 30 dias contados da data da posse

NR-06 (EPI - Equipamento de Proteção Individual):
- Treinamento obrigatório sobre uso correto, guarda, higienização e conservação
- Periodicidade: sempre que houver troca de EPI, mudança de função ou nova exposição

NR-10 (Segurança em Instalações e Serviços em Eletricidade):
- Curso Básico (item 10.8.8): mínimo 40h | Validade: 2 anos (reciclagem bienal, item 10.8.8.2)
- Curso SEP - Sistema Elétrico de Potência (item 10.8.8.1): mínimo 40h | Validade: 2 anos
- PRÉ-REQUISITO: Curso SEP exige Curso Básico vigente
- Autorização (item 10.8.4): trabalhadores qualificados, capacitados ou habilitados com ANUÊNCIA FORMAL da empresa
- REGRA CRÍTICA: Se o colaborador possuir NR-10 Básico + SEP vigentes, está APTO independente do cargo nominal
- Conteúdo programático obrigatório (Anexo II)
- OBRIGATÓRIO: nome e registro profissional do instrutor (CREA/CFT)

NR-11 (Transporte, Movimentação, Armazenagem e Manuseio de Materiais):
- Treinamento específico por tipo de equipamento operado
- Reciclagem: quando houver mudança de equipamento ou a critério do empregador

NR-12 (Segurança no Trabalho em Máquinas e Equipamentos):
- Item 12.16.1: Operação apenas por trabalhador habilitado, qualificado, capacitado ou autorizado
- Item 12.16.2: Capacitação compatível com a função, abordando riscos específicos da máquina
- Item 12.16.3: Capacitação antes de assumir a função; revisão quando houver modificações
- Item 12.16.4: Conteúdo programático deve incluir riscos, funcionamento, proteções, procedimentos seguros
- Carga horária compatível com a complexidade da máquina/equipamento
- Reciclagem: quando houver modificação significativa nas condições ou troca de equipamento
- ANUÊNCIA NR-12: Autorização formal vinculada ao equipamento ESPECÍFICO

NR-18 (Segurança e Saúde no Trabalho na Indústria da Construção):
- Treinamento admissional: mínimo 6h (antes do início das atividades)
- Treinamento periódico: a cada 12 meses

NR-20 (Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis):
- Básico: 8h | Intermediário: 16h | Avançado I: 24h | Avançado II: 32h
- Validade: 3 anos (reciclagem com carga horária igual ao curso original)

NR-23 (Proteção Contra Incêndios):
- Treinamento obrigatório para toda a força de trabalho
- Periodicidade: anual ou conforme determinação do Corpo de Bombeiros

NR-33 (Segurança e Saúde nos Trabalhos em Espaços Confinados):
- Trabalhadores autorizados e Vigias: 16h | Supervisores de entrada: 40h
- Validade: anual (reciclagem obrigatória a cada 12 meses)

NR-35 (Trabalho em Altura):
- Carga horária mínima: 8h (teórico e prático)
- Validade: 2 anos (reciclagem bienal)
- Conteúdo obrigatório: normas e regulamentos, análise de risco, EPIs, sistemas de ancoragem, acidentes típicos, condutas em emergência, primeiros socorros

=== REGRAS DE FUZZY MATCHING PARA CURSOS ===

Ao identificar o nome do curso, normalize para o padrão do sistema:
- "Curso de NR10 Básico", "NR10", "NR-10 Básico", "NR 10 Básico", "Segurança em Instalações Elétricas" → "NR 10"
- "NR10 SEP", "NR-10 SEP", "NR 10 SEP", "Sistema Elétrico de Potência" → "NR 10 SEP"
- "NR35", "NR-35", "Trabalho em Altura" → "NR 35"
- "NR33", "NR-33", "Espaço Confinado" → "NR 33"
- "NR12", "NR-12", "Segurança em Máquinas" → "NR 12"
- Se for Anuência/Autorização NR-10, use: "Anuência NR 10"
- Se for Anuência/Autorização NR-12, use: "Anuência NR 12" ou "Anuência NR 12 - [EQUIPAMENTO]"
- Use SEMPRE o formato "NR XX" (com espaço) para normalização.

=== VALIDAÇÃO LEGAL E CONTRATUAL ===

VALIDAÇÃO LEGAL (NR):
- Verifique carga horária mínima conforme NR específica
- Verifique conteúdo programático (se disponível)
- Verifique presença do nome do instrutor e registro profissional (CREA, CFT, CRM)
- Verifique validade conforme periodicidade da NR

VALIDAÇÃO CONTRATUAL (Matriz Neoenergia - Capacitação MANUT SE LD Rev.13.8):
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

Para ANUÊNCIA NR-10 VÁLIDA:
"✅ Anuência Formal validada conforme item 10.8.4 da NR-10. Colaborador capacitado e autorizado pelo Responsável Técnico [NOME] ([CREA]). Empresa: [NOME]. Data: [DATA]."

Para ANUÊNCIA NR-12 VÁLIDA:
"✅ Anuência NR-12 Validada. Colaborador autorizado para operação de [EQUIPAMENTO] conforme item 12.16.1 da norma vigente. Responsável Técnico: [NOME] ([CREA]). ⚠️ Autorização restrita ao equipamento citado."

Para INVÁLIDO por NR:
"❌ INVÁLIDO: Certificado em desacordo com a [NR-XX]. [MOTIVO DETALHADO]. Itens faltantes: [LISTA]."

Para INVÁLIDO por Matriz:
"⚠️ ATENÇÃO: Atende à [NR-XX] mas NÃO atende à Matriz Neoenergia Rev.12. [MOTIVO]."`;
}

const toolSchema = {
  type: "function" as const,
  function: {
    name: "analyze_certificate",
    description: "Retorna os dados extraídos e validados do certificado ou anuência",
    parameters: {
      type: "object",
      properties: {
        nome_certificado: { type: "string", description: "Nome do colaborador no documento" },
        cpf: { type: "string", description: "CPF encontrado no documento" },
        curso: { type: "string", description: "Nome do curso normalizado (ex: 'NR 10', 'Anuência NR 10', 'Anuência NR 12 - Betoneira')" },
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
        nr_referencia: { type: "string", description: "NR de referência (ex: NR-10, NR-12, NR-35)" },
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
};

function extractAnalysis(aiResult: any): any {
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
    const funcionarioId = formData.get("funcionario_id") as string | null;
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

    // Fetch existing trainings for this employee (cross-validation)
    let treinamentosExistentes = "";
    if (funcionarioId && empresaId) {
      const { data: treinos } = await supabase
        .from("controle_treinamentos")
        .select("nome_curso, data_realizacao, data_renovacao")
        .eq("empresa_id", empresaId)
        .eq("funcionario_id", funcionarioId);
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

    const systemPrompt = buildSystemPrompt(requisitosContext, funcionarioContext);

    console.log("Sending request to AI gateway...");

    const makeRequest = async (isMultimodal: boolean) => {
      const messages = isMultimodal
        ? [
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
- Equipamento/máquina mencionado (se for NR-12)
Identifique primeiro se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL e para qual NR.`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
                },
              ],
            },
          ]
        : [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analise este documento de segurança do trabalho. O conteúdo do PDF está codificado em base64 abaixo. Extraia TODAS as informações de TODAS as páginas.
Identifique se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL e para qual NR.
Converta datas para formato YYYY-MM-DD.

Nome do arquivo: ${file.name}

PDF em Base64 (decodifique e analise):
${pdfBase64.substring(0, 50000)}`,
            },
          ];

      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools: [toolSchema],
          tool_choice: { type: "function", function: { name: "analyze_certificate" } },
        }),
      });
    };

    let response = await makeRequest(true);
    console.log(`AI gateway response status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway error ${response.status}: ${errText}`);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: text-only
      if (response.status === 400 || response.status === 422) {
        console.log("PDF format rejected, trying text-only fallback...");
        response = await makeRequest(false);
        if (!response.ok) {
          const fallbackErr = await response.text();
          console.error(`Fallback also failed ${response.status}: ${fallbackErr}`);
          return new Response(JSON.stringify({ error: "Erro ao processar documento com IA" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Erro ao processar documento com IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const aiResult = await response.json();
    console.log("AI response received, extracting analysis...");
    const parsed = extractAnalysis(aiResult);
    console.log(`Analysis complete: curso=${parsed.curso}, confianca=${parsed.confianca}`);

    // Persist analysis to analises_ia table
    let analysisId: string | null = null;
    if (funcionarioId && empresaId) {
      try {
        const { data: insertedRow } = await supabase.from("analises_ia").insert({
          empresa_id: empresaId,
          funcionario_id: funcionarioId,
          arquivo_nome: file.name,
          ia_metadata: parsed,
          status: "analisado",
        }).select("id").single();
        analysisId = insertedRow?.id || null;
        console.log("Analysis persisted to analises_ia table, id:", analysisId);
      } catch (e) {
        console.error("Failed to persist analysis:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis: parsed, analysisId }), {
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
