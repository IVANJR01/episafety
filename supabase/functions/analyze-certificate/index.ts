import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(requisitosContext: string, funcionarioContext: string): string {
  return `=== PERSONAGEM ===
Atue como um Engenheiro de Qualidade e Auditor de Conformidade de SST padrão Bernhoeft — a maior empresa de auditoria de documentação de SST do Brasil. Sua missão é validar certificados de treinamento para a contratante Neoenergia com TOLERÂNCIA ZERO para erros.

Se esse funcionário sofrer um acidente HOJE, este papel protege a empresa no tribunal?

=== PROTOCOLOS DE AUDITORIA (OS 4 PILARES) ===

PILAR 1 — INTEGRIDADE E ORIGEM:
- Verificar se o certificado possui Conteúdo Programático (OBRIGATÓRIO).
- Validar se a instituição de treinamento é reconhecida ou se possui CNPJ válido.
- REPROVAR se houver rasuras ou informações ilegíveis.
- Se o documento parecer cortado, parcial ou sem verso com conteúdo programático → REPROVE IMEDIATAMENTE com "REPROVADO - Documento Incompleto".

PILAR 2 — ASSINATURAS (CRÍTICO — TOLERÂNCIA ZERO):
- Exigir assinatura do Instrutor com registro profissional (CREA/CFT/MTE).
- Exigir assinatura do Responsável Técnico da empresa de treinamento.
- Exigir assinatura do Treinado (Colaborador).
- Documento sem assinatura = APÓCRIFO = INVÁLIDO JURIDICAMENTE.
- Se a assinatura parece recortada/colada digitalmente, marcar como "SUSPEITO DE FRAUDE".
- Para Anuências: OBRIGATÓRIO ter assinatura E carimbo do Engenheiro com CREA visível.
- Nota: Para treinamentos de Primeiros Socorros, aceitar registro de Bombeiro Militar.

PILAR 3 — VIGÊNCIA E REGRAS ESPECIAIS:
- Se o documento for Ficha de EPI, CTPS, Comprovante de Escolaridade, Ficha de Registro, Regras de Ouro, Contrato de Trabalho, CNH, Edital ou ASO Admissional → definir validade como "9999-12-31" (Documento Permanente/Longa Duração). Na descricao_completa, indique: "📋 Documento de Carga Única — sem vencimento."
- Para NRs, cruzar a data de emissão com a periodicidade da Matriz Rev.12.
- NÃO aceite documentos no limite do vencimento.
- Se a reciclagem for necessária em 30 dias ou menos → "⚠️ RISCO DE BLOQUEIO: Documento vence em [X] dias. Providenciar reciclagem URGENTE."
- Se já vencido → "❌ DOCUMENTO VENCIDO. Colaborador NÃO PODE atuar até reciclagem."
- Calcule SEMPRE a distância em dias até o vencimento.

PILAR 4 — CRUZAMENTO COM MATRIZ NEOENERGIA (Rev.12 — 24.09.2024):
- Carga Horária (CH): Compare a CH do certificado com a CH exigida na Matriz para a FUNÇÃO ESPECÍFICA do colaborador.
  → Se a CH for inferior ao mínimo exigido, REPROVE IMEDIATAMENTE. A Bernhoeft NÃO aceita aproximações (39h quando a Matriz exige 40h = REPROVADO).
- Correspondência de cursos: Aceitar "Trabalho em Altura" para NR-35, mas ser RIGOROSO com cursos específicos da Neoenergia como POP 00, POP 05 e Guardião da Vida.
- Se o conteúdo programático não citar tópicos obrigatórios da NR (ex: "Análise de Risco/APR" para NR-10), considere o treinamento INCOMPLETO.

=== BASE DE CONHECIMENTO NORMATIVA (NRs vigentes — MTE) ===

NR-01 (Disposições Gerais):
- Treinamento de integração obrigatório ANTES do início das atividades.
- Item 1.6.1: Documentos digitais DEVEM possuir assinatura eletrônica que garanta integridade e autenticidade.
  → Se assinatura for apenas imagem colada sem certificado digital (ICP-Brasil): "⚠️ RISCO DE VALIDADE - Item 1.6.1 NR-01"
- Item 1.7: O empregador deve manter documentação comprobatória.

NR-05 (CIPA): CH mínima 20h | Validade: mandato 1 ano.
  → Aceitar denominação "CIPA e de Assédio" (atualização outubro/2024).

NR-06 (EPI):
- Item 6.6.1: Somente EPI aprovado pelo órgão competente.
- Ficha de EPI deve conter: descrição do EPI, CA (Certificado de Aprovação), data de entrega e assinatura do trabalhador.
- Se Ficha de EPI NÃO contiver CA válido ou assinatura → REPROVE.

NR-10 (Eletricidade):
- Básico 40h (2 anos) | SEP 40h (2 anos) | PRÉ-REQUISITO: SEP exige Básico vigente.
- Item 10.8 (Autorização): Documento DEVE citar "Autorizado" ou "Habilitado" conforme 10.8.1/10.8.4.
  → Se NÃO constar: "❌ Violação Item 10.8 NR-10 — Falta de Autorização Formal."
- Item 10.2.9 (EPI para Eletricidade): Para eletricistas, fichas devem incluir proteção contra arco elétrico.

NR-11 (Transporte/Empilhadeira):
- Treinamento específico obrigatório com reciclagem periódica.
- Certificado deve especificar o TIPO de equipamento.

NR-12 (Máquinas e Equipamentos):
- Operação apenas por trabalhador habilitado/autorizado.
- Item 12.16.1: Capacitação quanto a riscos, medidas de proteção e modos seguros.
- Anuência vinculada ao equipamento ESPECÍFICO.

NR-18 (Construção Civil):
- Admissional 6h | Periódico: 12 meses.

NR-20 (Inflamáveis e Combustíveis):
- Básico 8h | Intermediário 16h | Avançado I 24h | Avançado II 32h | Validade: 3 anos.
- Reciclagem: Básico/Intermediário 4h | Avançado I 8h | Avançado II 8h.

NR-23 (Proteção Contra Incêndios):
- Treinamento obrigatório, periodicidade anual.
- Deve incluir: utilização de extintores, rotas de fuga, alarme.

NR-33 (Espaços Confinados):
- Trabalhadores 16h | Supervisores de Entrada 40h | Validade: anual.
- PRÉ-REQUISITO: NR-33 exige Primeiros Socorros válido.

NR-35 (Trabalho em Altura):
- CH mínima 8h | Validade: 2 anos.
- Item 35.3.2: Deve incluir normas, análise de risco, procedimentos de emergência.
- PRÉ-REQUISITO: ASO apto para trabalho em altura.

=== REFERÊNCIA LEGAL NAS REPROVAÇÕES ===

REGRA OBRIGATÓRIA: Sempre que reprovar ou emitir ressalva, inclua na descricao_completa:
1. O NÚMERO DO ITEM da NR violada (ex: "Item 10.8.4 da NR-10")
2. O LINK oficial do Gov.br da NR correspondente
3. A CONSEQUÊNCIA prática (ex: "Colaborador INAPTO para atividade elétrica até regularização")

Links de referência:
- NR-01: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-1-nr-1
- NR-06: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-6-nr-6
- NR-10: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-10-nr-10
- NR-12: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-12-nr-12
- NR-20: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-20-nr-20
- NR-33: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-33-nr-33
- NR-35: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-paritaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35

=== REGRAS ANTI-ALUCINAÇÃO ===

- Se um dado NÃO estiver explícito no documento, marque como "NÃO IDENTIFICADO". NUNCA invente datas, nomes ou números de itens.
- Se NÃO tem certeza do sub-item específico da NR, cite a NR e a seção geral (ex: "NR-10, Seção 10.8"). Indique: "Verificar sub-item específico na NR vigente."

=== REGRAS DE FUZZY MATCHING PARA CURSOS ===

Normalize nomes: "NR10 Básico", "NR-10 Básico", "NR 10 Básico", "Segurança em Instalações Elétricas" → "NR 10"
"NR10 SEP", "NR-10 SEP", "Sistema Elétrico de Potência" → "NR 10 SEP"
"NR35", "NR-35", "Trabalho em Altura" → "NR 35"
"NR33", "NR-33", "Espaço Confinado", "Espaços Confinados" → "NR 33"
"NR20", "NR-20", "Inflamáveis e Combustíveis" → "NR 20"
"NR12", "NR-12", "Segurança em Máquinas" → "NR 12"
Anuências: "Anuência NR 10", "Anuência NR 12 - [EQUIPAMENTO]"
Use SEMPRE o formato "NR XX" (com espaço).

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

=== CAMPOS DE AUDITORIA OBRIGATÓRIOS ===

Retorne OBRIGATORIAMENTE os seguintes campos booleanos:
- assinatura_colaborador: true se detectou assinatura manuscrita do colaborador
- assinatura_instrutor: true se detectou assinatura manuscrita do instrutor
- assinatura_responsavel: true se detectou assinatura/carimbo do responsável técnico (CREA)
- parecer_bernhoeft: "APROVADO" | "REPROVADO" | "COM_RESSALVA"
- motivo_reprovacao_bernhoeft: texto explicando por que a Bernhoeft reprovaria (vazio se aprovado)
- dias_para_vencimento: número de dias até o vencimento (negativo se já vencido)

=== VALIDAÇÃO CONTRATUAL (Matriz Unificada Neoenergia Rev.12 — 24.09.2024) ===

- Compare carga horária EXCLUSIVAMENTE com o mínimo listado nos REQUISITOS ESPECÍFICOS PARA A FUNÇÃO do colaborador abaixo.
- NUNCA invente ou assuma valores de CH. Use SOMENTE os valores fornecidos nos dados abaixo.
- Se um curso NÃO aparece nos requisitos para esta função, ele NÃO é exigido — aprove automaticamente com conforme_matriz=true.
- Se encontrar no conteúdo programático itens que NÃO constam na grade obrigatória da NR, registrar como "Conteúdo Extra" (não penalizar).
- Se FALTAR item obrigatório do conteúdo programático, REPROVAR.
${requisitosContext}
${funcionarioContext}

=== TAREFA ===

Analise o documento PDF enviado. O documento pode ser:
1) Um CERTIFICADO de treinamento/curso
2) Uma ANUÊNCIA/AUTORIZAÇÃO FORMAL para NR-10 (item 10.8.4) ou NR-12 (item 12.16.1) ou outra NR
3) Outro documento de segurança do trabalho (ASO, Ficha de EPI, etc.)

Primeiro, IDENTIFIQUE O TIPO DE DOCUMENTO e a NR correspondente, depois aplique a validação dos 4 Pilares.

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
      assinatura_colaborador: false,
      assinatura_instrutor: false,
      assinatura_responsavel: false,
      parecer_bernhoeft: "REPROVADO" as const,
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

    // Fetch existing trainings for this employee (cross-validation & dependency check)
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

    // Filter requisitos by collaborator's function for precise CH matching
    const cargoNorm = (funcionarioCargo || "").toUpperCase().trim();
    const requisitosParaFuncao = cargoNorm
      ? requisitos.filter(r => {
          const funcoes = (r.funcoes_exigidas || []) as string[];
          return funcoes.length === 0 || funcoes.some((f: string) => {
            const fNorm = f.toUpperCase().trim();
            return cargoNorm.includes(fNorm) || fNorm.includes(cargoNorm);
          });
        })
      : requisitos;

    const requisitosContext = requisitos.length > 0
      ? `\n\nREQUISITOS ESPECÍFICOS PARA A FUNÇÃO "${funcionarioCargo || "Não informada"}" (USE ESTES VALORES DE CH):\n${requisitosParaFuncao.map(r =>
          `CURSO: "${r.curso_nome}" | CH MÍNIMA EXIGIDA: ${r.carga_horaria_minima}h | Validade: ${r.validade_meses} meses | Funções: [${(r.funcoes_exigidas || []).join(", ")}] | Sinônimos: [${(r.sinonimos || []).join(", ")}]`
        ).join("\n")}\n\n⚠️ REGRA ABSOLUTA: Use SOMENTE os valores de CH listados acima para a função "${funcionarioCargo || ""}". NÃO use valores de CH de outras funções. Se o curso não aparece na lista acima, ele NÃO é exigido para esta função — marque conforme_matriz=true e requisito_atendido="Curso não exigido para esta função".`
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
      ? `\nDADOS DO COLABORADOR SELECIONADO:\nNome: ${funcionarioNome}\nCPF: ${funcionarioCpf || "Não informado"}\nFunção/Cargo: ${funcionarioCargo || "Não informada"}\n\nREGRAS DE IDENTIFICAÇÃO:\n- Use o CPF "${funcionarioCpf || ""}" como CHAVE PRIMÁRIA de identificação infalível.\n- Se o CPF do documento coincidir com "${funcionarioCpf || ""}", o colaborador é o MESMO, independentemente de variações no nome (abreviações, nome do meio, acentos).\n- Só defina alerta_nome=true se AMBOS nome E CPF forem completamente diferentes.${treinamentosExistentes}${batchContext}\n\nREGRA CRÍTICA DE DEPENDÊNCIA MULTIDOCUMENTO:\n- Para validar uma ANUÊNCIA NR-10 (item 10.8.4), você DEVE verificar se o colaborador possui NR-10 Básico (40h) E NR-10 SEP (40h) VIGENTES.\n- Para validar NR-33, verifique se o colaborador possui Primeiros Socorros VIGENTE.\n- Para validar NR-35, verifique se o colaborador possui ASO apto para trabalho em altura.\n- Para validar NR-10 SEP, verifique se o colaborador possui NR-10 Básico VIGENTE.\n- Consulte os TREINAMENTOS JÁ CADASTRADOS e os DOCUMENTOS JÁ ANALISADOS acima.\n- Se o pré-requisito estiver presente (no sistema OU no lote atual), valide normalmente.\n- Se o pré-requisito NÃO for encontrado em NENHUMA fonte, marque: conforme_nr=false e motivo_nr="❌ Pré-requisito ausente: [detalhe do pré-requisito] não localizado no sistema nem no lote atual."\n- A validade da Anuência = data de vencimento do treinamento mais antigo (Básico ou SEP).\n- Se encontrar o pré-requisito, inclua na descricao_completa: "✅ Pré-requisito identificado e vinculado."`
      : "";

    const systemPrompt = buildSystemPrompt(requisitosContext, funcionarioContext);

    console.log("Sending request to AI...");

    const userPrompt = `Analise este documento PDF de segurança do trabalho.
Extraia TODAS as informações de TODAS as páginas (frente e verso), incluindo:
- Conteúdo programático (geralmente na página 2 / verso)
- Nome e registro profissional do instrutor/responsável técnico
- CPF do colaborador
- Datas (converter para YYYY-MM-DD)
- Entidade/Instituição emissora
- Carga horária
- Equipamento/máquina mencionado (se for NR-12)
Identifique primeiro se é um CERTIFICADO ou uma ANUÊNCIA/AUTORIZAÇÃO FORMAL e para qual NR.`;

    // ==================== GEMINI DIRECT API ====================
    const callGeminiDirect = async (): Promise<any> => {
      // Use gemini-2.5-flash for better accuracy
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const geminiBody = {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: userPrompt },
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
          maxOutputTokens: 8192,
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
            { type: "text", text: userPrompt },
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
        if (resp.status === 429) {
          throw new Error("Rate limit excedido. Tente novamente em alguns segundos.");
        }
        if (resp.status === 402) {
          throw new Error("Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage.");
        }
        throw new Error(`Lovable gateway error: ${resp.status}`);
      }

      const aiResult = await resp.json();
      return extractAnalysis(aiResult);
    };

    // ==================== EXECUTION FLOW ====================
    let parsed: any;
    let provider = "gemini_direct";

    if (GEMINI_API_KEY) {
      try {
        console.log("Using Gemini Direct API (primary)...");
        parsed = await callGeminiDirect();
      } catch (geminiErr) {
        console.error("Gemini Direct failed:", geminiErr);
        if (LOVABLE_API_KEY) {
          try {
            console.log("Falling back to Lovable AI Gateway...");
            provider = "lovable_gateway";
            parsed = await callLovableGateway();
          } catch (lovableErr) {
            console.error("Lovable Gateway also failed:", lovableErr);
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
            error: err.message || "Créditos insuficientes. Documento salvo na fila.",
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
