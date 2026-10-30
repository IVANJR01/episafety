import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";

const systemPrompt = `Você é um Engenheiro de Segurança do Trabalho especialista em NR-01 e PGR (Programa de Gerenciamento de Riscos).
Sua missão é ler e interpretar o documento de PGR fornecido (em formato PDF ou texto livre) e extrair os dados de forma estruturada.

Retorne APENAS um JSON estritamente válido, sem texto explicativo antes ou depois, seguindo esta estrutura exata:
{
  "documento": {
    "empresa_nome": "Razão Social ou Nome Fantasia da empresa",
    "cnpj": "CNPJ se encontrado ou null",
    "unidade_nome": "Nome do estabelecimento / unidade",
    "resp_tec_nome": "Nome do Responsável Técnico / Engenheiro / Técnico",
    "resp_tec_registro": "Número de registro no conselho de classe (CREA / MTE)",
    "data_emissao": "YYYY-MM-DD ou data atual se não informada",
    "data_vigencia_inicio": "YYYY-MM-DD",
    "data_vigencia_fim": "YYYY-MM-DD",
    "escopo": "Resumo do escopo de abrangência do documento",
    "metodologia_avaliacao": "Matriz de Risco utilizada (ex: Matriz 5x5, AIHA, BS 8800)"
  },
  "setores": [
    {
      "nome": "Nome do Setor (ex: Administrativo, Produção, Almoxarifado, Manutenção)",
      "descricao_ambiente": "Breve descrição do ambiente físico de trabalho"
    }
  ],
  "ghes": [
    {
      "codigo": "Código do GES/GHE (ex: GES 01, GES 02, 01, etc.)",
      "nome": "Nome descritivo do grupo (ex: Operação de Máquinas, Escritório)",
      "setor": "Nome do setor ao qual o grupo pertence",
      "funcoes": ["Nome do Cargo 1", "Nome do Cargo 2"],
      "descricao": "Atividades e rotinas típicas desempenhadas"
    }
  ],
  "inventario": [
    {
      "setor": "Nome do Setor",
      "ges_codigo": "Código do GES (ex: GES 01)",
      "grupo": "fisico | quimico | biologico | ergonomico | acidente",
      "tipo_agente": "Nome do agente / perigo específico (ex: Ruído contínuo, Postura sentada prolongada, Prensagem de membros)",
      "perigo_descricao": "Descrição detalhada do perigo e situação perigosa",
      "fonte_geradora": "Equipamento, máquina, tarefa ou elemento gerador do risco",
      "lesoes": "Possíveis lesões ou agravos à saúde (ex: PAIR, LER/DORT, Amputação, Fratura)",
      "controles_existentes": [
        "Medida preventiva existente 1 (ex: Protetor auricular tipo concha CA 12345)",
        "Medida preventiva 2 (ex: Treinamento NR-12)"
      ],
      "probabilidade": 3,
      "severidade": 3,
      "plano_acao_sugerido": "Ação recomendada para controle ou monitoramento contínuo"
    }
  ]
}

Regras Obrigatórias:
1. "grupo" DEVE ser obrigatoriamente um destes: "fisico", "quimico", "biologico", "ergonomico" ou "acidente".
2. "probabilidade" deve ser um número inteiro de 1 a 5 (onde 1 é extremamente remota e 5 é muito frequente).
3. "severidade" deve ser um número inteiro de 1 a 5 (onde 1 é leve/desprezível e 5 é crítica/catastrófica).
4. Extraia TODOS os setores, cargos, grupos (GES) e perigos listados no documento.
5. Se o documento contiver um quadro sinóptico ou matriz de riscos, consolide cada linha no array "inventario".
6. Nunca invente dados que não existam no documento; preencha com null ou omita quando não houver menção.
7. Não escreva nada além do JSON válido.`;

serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const __rl_ok = await checkRateLimit({ key: clientKey(req, null, "parse-pgr"), limit: 10, windowSeconds: 60 });
  if (!__rl_ok) {
    return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns instantes." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { texto, pdf_base64, mime_type } = body || {};

    if (!texto && !pdf_base64) {
      return new Response(JSON.stringify({ error: "Envie um arquivo PDF ou texto do PGR para análise." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("Chave GEMINI_API_KEY não configurada no servidor Supabase.");

    let content = "{}";

    if (pdf_base64) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: mime_type || "application/pdf", data: pdf_base64 } },
              { text: "Analise integralmente este documento de PGR e extraia a identificação, setores, funções, grupos homogêneos (GES) e o inventário de riscos completo no JSON especificado." },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: `Falha na IA Gemini: ${resp.status} ${errText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const j = await resp.json();
      content = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "{}";
    } else {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: texto },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: `Falha na IA Gemini: ${resp.status} ${errText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const j = await resp.json();
      content = j?.choices?.[0]?.message?.content || "{}";
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    if (!parsed.setores || !Array.isArray(parsed.setores)) parsed.setores = [];
    if (!parsed.ghes || !Array.isArray(parsed.ghes)) parsed.ghes = [];
    if (!parsed.inventario || !Array.isArray(parsed.inventario)) parsed.inventario = [];

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
