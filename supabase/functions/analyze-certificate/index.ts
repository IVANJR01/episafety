import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(requisitosContext: string, funcionarioContext: string): string {
  return `Você é um AUDITOR DE CONFORMIDADE padrão Bernhoeft — a maior empresa de auditoria de documentação de SST do Brasil.

=== MENTALIDADE BERNHOEFT (OS 4 PILARES DA AUDITORIA) ===

Ao avaliar QUALQUER documento, você deve pensar como a Bernhoeft: "Se esse funcionário sofrer um acidente HOJE, este papel protege a empresa no tribunal?"

PILAR 1 - INTEGRIDADE DOCUMENTAL:
- O documento está COMPLETO? Todas as páginas (frente e verso) foram enviadas?
- Se faltar o verso com o conteúdo programático, REPROVE IMEDIATAMENTE.
- Se o documento parecer cortado, ilegível ou parcial, marque como "REPROVADO - Documento Incompleto".

PILAR 2 - ASSINATURAS E CARIMBOS (TOLERÂNCIA ZERO):
- Verifique VISUALMENTE a presença de:
  a) ASSINATURA DO COLABORADOR: campo preenchido com assinatura manuscrita
  b) ASSINATURA DO INSTRUTOR: campo preenchido com assinatura manuscrita
  c) CARIMBO/REGISTRO do Engenheiro ou Instrutor (CREA, CFT, CRM)
- Documento sem assinatura = APÓCRIFO = INVÁLIDO JURIDICAMENTE
- Se a assinatura parece recortada/colada digitalmente, marcar como "SUSPEITO DE FRAUDE"
- Para Anuências: OBRIGATÓRIO ter assinatura E carimbo do Engenheiro com CREA visível

PILAR 3 - VIGÊNCIA REAL (sem margem):
- NÃO aceite documentos no limite do vencimento.
- Se a reciclagem for necessária em 30 dias ou menos, emita: "⚠️ RISCO DE BLOQUEIO: Documento vence em [X] dias. Providenciar reciclagem URGENTE."
- Se já vencido: "❌ DOCUMENTO VENCIDO. Colaborador NÃO PODE atuar até reciclagem."
- Calcule SEMPRE a distância em dias até o vencimento.

PILAR 4 - CONFORMIDADE COM O CLIENTE (NEOENERGIA):
- Cruze com a Matriz Unificada Rev. 12. Carga horária EXATA, sem aproximações.
- Se a carga horária for 39h e a Matriz exigir 40h → REPROVE. A Bernhoeft NÃO aceita aproximações.
- Se o conteúdo programático não citar tópicos obrigatórios da NR (ex: "Análise de Risco/APR" para NR-10), considere o treinamento INCOMPLETO.

=== FORMATO DO PARECER (ESTILO BERNHOEFT) ===

O campo descricao_completa deve ser um PARECER DE AUDITORIA completo:

"📋 PARECER DE AUDITORIA
Status: [APROVADO / REPROVADO / COM RESSALVA]
Evidência Encontrada: [Carga horária, Instrutor, Conteúdo Programático]
Assinaturas: Colaborador [✅/❌] | Instrutor [✅/❌] | Resp. Técnico [✅/❌]
Registro Profissional: [CREA/CFT nº XX ou NÃO IDENTIFICADO]
Não Conformidade: [Explique exatamente por que NÃO passaria na auditoria da Neoenergia, ou 'Nenhuma']
Vigência: [DATA] até [DATA] ([X] dias restantes)
Conformidade Bernhoeft: [APROVADO PARA CAMPO / BLOQUEADO]"

=== CAMPOS DE AUDITORIA DE ASSINATURAS ===

Retorne OBRIGATORIAMENTE os seguintes campos booleanos:
- assinatura_colaborador: true se detectou assinatura manuscrita do colaborador
- assinatura_instrutor: true se detectou assinatura manuscrita do instrutor
- assinatura_responsavel: true se detectou assinatura/carimbo do responsável técnico (CREA)
- parecer_bernhoeft: "APROVADO" | "REPROVADO" | "COM_RESSALVA"
- motivo_reprovacao_bernhoeft: texto explicando por que a Bernhoeft reprovaria (vazio se aprovado)
- dias_para_vencimento: número de dias até o vencimento (null se não aplicável)

=== TAREFA ===

Analise o documento PDF enviado. O documento pode ser:
1) Um CERTIFICADO de treinamento/curso
2) Uma ANUÊNCIA/AUTORIZAÇÃO FORMAL para NR-10 (item 10.8.4) ou NR-12 (item 12.16.1) ou outra NR
3) Outro documento de segurança do trabalho

Primeiro, IDENTIFIQUE O TIPO DE DOCUMENTO e a NR correspondente, depois aplique a validação dos 4 Pilares Bernhoeft.

=== REGRAS PARA ANUÊNCIA / AUTORIZAÇÃO FORMAL NR-10 (Item 10.8.4) ===

O item 10.8.4 da NR-10 estabelece:
"São considerados autorizados os trabalhadores qualificados ou capacitados e os profissionais habilitados, com anuência formal da empresa."

VALIDAÇÃO DE ANUÊNCIA NR-10:
- A Anuência é VÁLIDA se contiver: (a) identificação do colaborador (nome e CPF), (b) declaração explícita de autorização/anuência da empresa, (c) assinatura do Responsável Técnico (Engenheiro com CREA).
- REGRA CRÍTICA: Se o colaborador possuir certificados válidos de NR-10 Básico e NR-10 SEP no sistema, a Anuência para intervenção em circuitos energizados é VÁLIDA, INDEPENDENTEMENTE do cargo nominal.
- A validade da Anuência está atrelada à data de vencimento do treinamento mais antigo (Básico ou SEP).

=== REGRAS PARA ANUÊNCIA / AUTORIZAÇÃO FORMAL NR-12 (Item 12.16.1) ===

VALIDAÇÃO DE ANUÊNCIA NR-12:
- A Anuência NR-12 é VÁLIDA se contiver: (a) identificação do colaborador (nome e CPF), (b) identificação da máquina/equipamento autorizado, (c) declaração de autorização da empresa, (d) assinatura do Responsável Técnico.
- Normalize o curso como: "Anuência NR 12" ou "Anuência NR 12 - [EQUIPAMENTO]"

=== BASE DE CONHECIMENTO NORMATIVA (NRs vigentes - MTE) ===

NR-01 (Disposições Gerais - https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-1-nr-1):
- Treinamento de integração obrigatório ANTES do início das atividades.
- Item 1.6.1: Documentos digitais DEVEM possuir assinatura eletrônica que garanta integridade e autenticidade.
  → Se a assinatura for apenas uma imagem colada/sobreposta sem certificado digital (ICP-Brasil) ou log de assinatura eletrônica, aponte como "⚠️ RISCO DE VALIDADE - Item 1.6.1 NR-01: Assinatura sem garantia de autenticidade. Ref: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-1-nr-1"
- Capacitação periódica: Cruze a data de emissão com a periodicidade exigida pela NR correspondente. Se VENCIDO → colaborador é INAPTO para a atividade.
- Item 1.7: O empregador deve manter documentação comprobatória de capacitação disponível para fiscalização.

NR-05 (CIPA): CH mínima 20h | Validade: mandato 1 ano.
NR-06 (EPI): Treinamento obrigatório sobre uso correto.

NR-10 (Eletricidade - https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10):
- Básico 40h (2 anos) | SEP 40h (2 anos) | PRÉ-REQUISITO: SEP exige Básico vigente.
- Item 10.8 (Autorização): Para eletricistas, o documento DEVE citar explicitamente que o trabalhador é "Autorizado" ou "Habilitado" conforme 10.8.1/10.8.4.
  → Se NÃO constar termo de autorização formal: REPROVE com "❌ Violação Item 10.8 NR-10 - Falta de Autorização Formal. Trabalhador NÃO pode intervir em instalações elétricas. Ref: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10"
- Item 10.2.9 (EPI para Eletricidade): Para eletricistas, fichas de EPI devem incluir vestimentas com proteção contra arco elétrico e fogo, luvas isolantes, mangas isolantes.
  → Se constar apenas EPI comum (capacete, botina padrão) sem EPI específico para risco elétrico: "⚠️ INCOMPATIBILIDADE DE RISCO - Item 10.2.9 NR-10: EPI inadequado para atividade elétrica."
- Item 10.7: Prontuário de Instalações Elétricas é obrigatório para estabelecimentos com carga > 75kW.

NR-11: Treinamento específico por tipo de equipamento.
NR-12: Operação apenas por trabalhador habilitado/autorizado. Anuência vinculada ao equipamento ESPECÍFICO.
NR-18: Admissional 6h | Periódico: 12 meses.
NR-20: Básico 8h | Intermediário 16h | Avançado I 24h | Avançado II 32h | Validade: 3 anos.
NR-23: Treinamento obrigatório, periodicidade anual.
NR-33: Trabalhadores 16h | Supervisores 40h | Validade: anual.
NR-35: CH mínima 8h | Validade: 2 anos.

=== REFERÊNCIA LEGAL NAS REPROVAÇÕES ===

REGRA OBRIGATÓRIA: Sempre que reprovar ou emitir ressalva, inclua na descricao_completa:
1. O NÚMERO DO ITEM da NR violada (ex: "Item 10.8.4 da NR-10")
2. O LINK oficial do Gov.br da NR correspondente
3. A CONSEQUÊNCIA prática (ex: "Colaborador INAPTO para atividade elétrica até regularização")

Links de referência:
- NR-01: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-1-nr-1
- NR-10: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10
- NR-35: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35

=== DOCUMENTOS SEM VENCIMENTO (CARGA ÚNICA / PERMANENTE) ===

Os seguintes tipos de documento NÃO POSSUEM validade/vencimento:
- Ficha de EPI, Comprovante de Escolaridade, Ficha de Registro, CTPS, Regras de Ouro, Contrato de Trabalho, CNH, Edital
- Para esses documentos: defina data_validade como "9999-12-31" e dias_para_vencimento como null.
- Eles são considerados "Entregues" permanentemente uma vez enviados.
- Na descricao_completa, indique: "📋 Documento de Carga Única — sem vencimento."

=== REGRAS DE FUZZY MATCHING PARA CURSOS ===

Normalize nomes: "NR10 Básico", "NR-10 Básico", "NR 10 Básico", "Segurança em Instalações Elétricas" → "NR 10"
"NR10 SEP", "NR-10 SEP", "Sistema Elétrico de Potência" → "NR 10 SEP"
"NR35", "NR-35", "Trabalho em Altura" → "NR 35"
Anuências: "Anuência NR 10", "Anuência NR 12 - [EQUIPAMENTO]"
Use SEMPRE o formato "NR XX" (com espaço).

=== VALIDAÇÃO CONTRATUAL (Matriz Unificada Neoenergia Rev.12) ===

- Compare carga horária com o mínimo da Matriz PARA A FUNÇÃO ESPECÍFICA do colaborador
- IMPORTANTE: O mesmo curso pode ter CH diferente por função (ex: POP 00 = 8h para Administrativo, 40h para Eletricista)
- Se encontrar no conteúdo programático itens que NÃO constam na grade obrigatória da NR, registrar como "Conteúdo Extra" (não penalizar)
- Se FALTAR item obrigatório do conteúdo programático, REPROVAR
${requisitosContext}
${funcionarioContext}

=== FORMATO DAS DATAS ===
Converta TODAS as datas para formato YYYY-MM-DD.`;
}

const toolSchema = {
  type: "function" as const,
  function: {
    name: "analyze_certificate",
    description: "Retorna os dados extraídos e validados do certificado ou anuência com parecer Bernhoeft",
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
        descricao_completa: { type: "string", description: "PARECER DE AUDITORIA BERNHOEFT completo - NUNCA deixar vazio" },
        alerta_nome: { type: "boolean", description: "true SOMENTE se nome E CPF divergem do colaborador" },
        alerta_nome_msg: { type: "string", description: "Mensagem de alerta sobre divergência" },
        nr_referencia: { type: "string", description: "NR de referência (ex: NR-10, NR-12, NR-35)" },
        conforme_nr: { type: "boolean", description: "Se atende à NR correspondente" },
        motivo_nr: { type: "string", description: "Detalhes da validação contra a NR" },
        conforme_matriz: { type: "boolean", description: "Se atende à Matriz Neoenergia" },
        motivo_nao_conforme: { type: "string", description: "Motivo da não conformidade" },
        requisito_atendido: { type: "string", description: "Requisito da Matriz atendido" },
        confianca: { type: "number", description: "Nível de confiança 0.0 a 1.0" },
        // Bernhoeft audit fields
        assinatura_colaborador: { type: "boolean", description: "true se assinatura do colaborador foi detectada visualmente" },
        assinatura_instrutor: { type: "boolean", description: "true se assinatura do instrutor foi detectada visualmente" },
        assinatura_responsavel: { type: "boolean", description: "true se assinatura/carimbo do responsável técnico (CREA) foi detectado" },
        parecer_bernhoeft: { type: "string", enum: ["APROVADO", "REPROVADO", "COM_RESSALVA"], description: "Parecer final no padrão Bernhoeft" },
        motivo_reprovacao_bernhoeft: { type: "string", description: "Motivo pelo qual a Bernhoeft reprovaria o documento" },
        dias_para_vencimento: { type: "number", description: "Dias restantes até o vencimento (negativo se já vencido)" },
      },
      required: ["nome_certificado", "curso", "carga_horaria", "descricao_completa", "conforme_nr", "conforme_matriz", "confianca", "assinatura_colaborador", "assinatura_instrutor", "assinatura_responsavel", "parecer_bernhoeft"],
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada (GEMINI_API_KEY ou LOVABLE_API_KEY)");
    }

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
      ? `\n\nMATRIZ UNIFICADA NEOENERGIA (Rev.12 - Atividades em SE e LD):\n${requisitos.map(r =>
          `CURSO: "${r.curso_nome}" | Sinônimos: [${(r.sinonimos || []).join(", ")}] | CH MÍNIMA: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções: [${(r.funcoes_exigidas || []).join(", ")}] | Obs: ${r.descricao || ""}`
        ).join("\n")}\n\nREGRA CRÍTICA DE CH VARIÁVEL: O mesmo curso pode ter CH diferente por função. Ex: POP 00 = 8h (Administrativo) vs 40h (Eletricista). Use a CH correspondente à FUNÇÃO do colaborador selecionado.`
      : "";

    // Fetch other documents being analyzed in this batch (from analises_ia)
    let batchContext = "";
    if (funcionarioId && empresaId) {
      const { data: recentAnalyses } = await supabase
        .from("analises_ia")
        .select("arquivo_nome, ia_metadata, status")
        .eq("empresa_id", empresaId)
        .eq("funcionario_id", funcionarioId)
        .in("status", ["analisado", "confirmado"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (recentAnalyses && recentAnalyses.length > 0) {
        batchContext = `\n\nDOCUMENTOS JÁ ANALISADOS PELA IA PARA ESTE COLABORADOR (use para validação cruzada):\n${recentAnalyses.map((a: any) => {
          const meta = a.ia_metadata || {};
          return `- Arquivo: ${a.arquivo_nome} | Curso: ${meta.curso || "?"} | CH: ${meta.carga_horaria || "?"}h | Realização: ${meta.data_realizacao || "?"} | Validade: ${meta.data_validade || "?"} | NR Conforme: ${meta.conforme_nr} | Status: ${a.status}`;
        }).join("\n")}`;
      }
    }

    const funcionarioContext = funcionarioNome
      ? `\nDADOS DO COLABORADOR SELECIONADO:\nNome: ${funcionarioNome}\nCPF: ${funcionarioCpf || "Não informado"}\nFunção/Cargo: ${funcionarioCargo || "Não informada"}\n\nREGRAS DE IDENTIFICAÇÃO:\n- Use o CPF "${funcionarioCpf || ""}" como CHAVE PRIMÁRIA de identificação infalível.\n- Se o CPF do documento coincidir com "${funcionarioCpf || ""}", o colaborador é o MESMO, independentemente de variações no nome (abreviações, nome do meio, acentos).\n- Só defina alerta_nome=true se AMBOS nome E CPF forem completamente diferentes.${treinamentosExistentes}${batchContext}\n\nREGRA CRÍTICA DE DEPENDÊNCIA MULTIDOCUMENTO:\n- Para validar uma ANUÊNCIA NR-10 (item 10.8.4), você DEVE verificar se o colaborador possui NR-10 Básico (40h) E NR-10 SEP (40h) VIGENTES.\n- Consulte os TREINAMENTOS JÁ CADASTRADOS e os DOCUMENTOS JÁ ANALISADOS acima.\n- Se NR-10 Básico ou SEP estiverem presentes (no sistema OU no lote atual), use esses dados para validar a Anuência.\n- Se NR-10 Básico ou SEP NÃO forem encontrados em NENHUMA fonte, marque: conforme_nr=false e motivo_nr="❌ Pré-requisito ausente: certificado de NR-10 Básico/SEP não localizado no sistema nem no lote atual."\n- A validade da Anuência = data de vencimento do treinamento mais antigo (Básico ou SEP).\n- Se encontrar o NR-10, inclua na descricao_completa: "✅ Certificado de NR-10 identificado e vinculado. Atende à carga horária de 40h exigida pela Matriz Unificada. Anuência validada com base neste treinamento."`
      : "";

    const systemPrompt = buildSystemPrompt(requisitosContext, funcionarioContext);

    console.log("Sending request to AI...");

    // ==================== GEMINI DIRECT API ====================
    const callGeminiDirect = async (): Promise<any> => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const geminiBody = {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: `Analise este documento PDF de segurança do trabalho.
Extraia TODAS as informações de TODAS as páginas (frente e verso), incluindo:
- Conteúdo programático (geralmente na página 2 / verso)
- Nome e registro profissional do instrutor/responsável técnico
- CPF do colaborador
- Datas (converter para YYYY-MM-DD)
- Entidade/Instituição emissora
- Carga horária
- Equipamento/máquina mencionado (se for NR-12)
Identifique primeiro se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL e para qual NR.` },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
        tools: [{
          functionDeclarations: [{
            name: toolSchema.function.name,
            description: toolSchema.function.description,
            parameters: toolSchema.function.parameters,
          }],
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["analyze_certificate"],
          },
        },
      };

      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Gemini API error ${resp.status}: ${errText}`);
        throw new Error(`Gemini API error: ${resp.status}`);
      }

      const geminiResult = await resp.json();
      console.log("Gemini direct response received");

      // Extract from Gemini native format
      const candidate = geminiResult.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      
      for (const part of parts) {
        if (part.functionCall) {
          console.log("Parsed from Gemini functionCall successfully");
          return part.functionCall.args;
        }
      }

      // Fallback: try parsing text content
      for (const part of parts) {
        if (part.text) {
          try {
            const cleaned = part.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
            return JSON.parse(cleaned);
          } catch {
            return {
              curso: "Não identificado",
              descricao_completa: part.text || "IA não conseguiu analisar o documento",
              confianca: 0.3,
              conforme_nr: false,
              conforme_matriz: false,
              carga_horaria: 0,
              nome_certificado: "",
              assinatura_colaborador: false,
              assinatura_instrutor: false,
              assinatura_responsavel: false,
              parecer_bernhoeft: "REPROVADO",
            };
          }
        }
      }

      throw new Error("Gemini returned no usable content");
    };

    // ==================== LOVABLE GATEWAY (FALLBACK) ====================
    const callLovableGateway = async (): Promise<any> => {
      const messages = [
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
      ];

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Lovable gateway error ${resp.status}: ${errText}`);
        throw new Error(`Lovable gateway error: ${resp.status}`);
      }

      const aiResult = await resp.json();
      return extractAnalysis(aiResult);
    };

    // ==================== EXECUTION FLOW ====================
    let parsed: any;
    let provider = "gemini_direct";

    if (GEMINI_API_KEY) {
      // PRIMARY: Google Gemini Direct API (free/low cost)
      try {
        console.log("Using Gemini Direct API (primary)...");
        parsed = await callGeminiDirect();
      } catch (geminiErr) {
        console.error("Gemini Direct failed:", geminiErr);
        // FALLBACK: Lovable Gateway
        if (LOVABLE_API_KEY) {
          try {
            console.log("Falling back to Lovable AI Gateway...");
            provider = "lovable_gateway";
            parsed = await callLovableGateway();
          } catch (lovableErr) {
            console.error("Lovable Gateway also failed:", lovableErr);
            // QUEUE: save as pending
            if (funcionarioId && empresaId) {
              const { data: row } = await supabase.from("analises_ia").insert({
                empresa_id: empresaId,
                funcionario_id: funcionarioId,
                arquivo_nome: file.name,
                ia_metadata: {},
                status: "pending_credit",
              }).select("id").single();
              return new Response(JSON.stringify({
                error: "Ambos provedores falharam. Documento salvo na fila.",
                status: "pending_credit",
                analysisId: row?.id || null,
              }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            throw lovableErr;
          }
        } else {
          throw geminiErr;
        }
      }
    } else {
      // No Gemini key, use Lovable directly
      console.log("No GEMINI_API_KEY, using Lovable AI Gateway...");
      provider = "lovable_gateway";
      try {
        parsed = await callLovableGateway();
      } catch (err: any) {
        if (funcionarioId && empresaId) {
          const { data: row } = await supabase.from("analises_ia").insert({
            empresa_id: empresaId,
            funcionario_id: funcionarioId,
            arquivo_nome: file.name,
            ia_metadata: {},
            status: "pending_credit",
          }).select("id").single();
          return new Response(JSON.stringify({
            error: "Créditos insuficientes. Documento salvo na fila.",
            status: "pending_credit",
            analysisId: row?.id || null,
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw err;
      }
    }

    console.log(`Analysis complete via ${provider}: curso=${parsed.curso}, confianca=${parsed.confianca}`);

    // Persist analysis to analises_ia table
    let analysisId: string | null = null;
    if (funcionarioId && empresaId) {
      try {
        const { data: insertedRow } = await supabase.from("analises_ia").insert({
          empresa_id: empresaId,
          funcionario_id: funcionarioId,
          arquivo_nome: file.name,
          ia_metadata: { ...parsed, _provider: provider },
          status: "analisado",
        }).select("id").single();
        analysisId = insertedRow?.id || null;
        console.log("Analysis persisted, id:", analysisId);
      } catch (e) {
        console.error("Failed to persist analysis:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis: parsed, analysisId, provider }), {
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
