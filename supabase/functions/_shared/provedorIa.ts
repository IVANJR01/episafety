/**
 * Qual IA atende a chamada.
 *
 * As funções deste projeto já falavam o formato de mensagens da OpenAI —
 * `messages`, `tools`, `tool_choice`, `Authorization: Bearer` —, porque o
 * Gemini era chamado pelo endpoint compatível dele
 * (generativelanguage.googleapis.com/v1beta/openai/...). Por isso trocar de
 * provedor é trocar URL, chave e nome do modelo: o corpo da requisição e o
 * formato da resposta continuam os mesmos.
 *
 * A ordem é OpenAI primeiro. Configurada a OPENAI_API_KEY, é ela que responde;
 * sem ela, cai no Gemini, se houver GEMINI_API_KEY. Manter os dois caminhos
 * evita que o botão de IA morra no intervalo entre trocar a chave e o restante
 * do sistema perceber.
 *
 * IMPORTANTE, e vale repetir para quem for configurar: a assinatura do
 * ChatGPT (Plus ou Pro) NÃO dá acesso à API. São cobranças separadas. A chave
 * sai de platform.openai.com, com crédito próprio.
 */

/*
 * O `Deno` global, declarado no mínimo necessário.
 *
 * Este arquivo roda em Deno (Edge Function), mas o teste o importa dentro do
 * projeto da aplicação, que não carrega os tipos do Deno. Sem esta declaração o
 * `npm run typecheck` acusa "Cannot find name 'Deno'" — e um erro de tipo que
 * aparece toda vez ensina a ignorar a saída do typecheck, que é pior do que o
 * erro em si.
 */
declare const Deno: { env: { get(nome: string): string | undefined } };

export interface ProvedorIa {
  nome: "openai" | "gemini";
  url: string;
  chave: string;
  modelo: string;
}

/**
 * O modelo pode ser trocado por variável de ambiente, sem publicar de novo.
 * O padrão é um modelo de custo baixo, que é o adequado para classificar uma
 * situação de inspeção em poucas linhas.
 */
const MODELO_OPENAI_PADRAO = "gpt-4o-mini";
const MODELO_GEMINI_PADRAO = "gemini-2.5-flash";

export function resolverProvedorIa(): ProvedorIa | null {
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) {
    return {
      nome: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      chave: openai,
      modelo: Deno.env.get("OPENAI_MODEL") || MODELO_OPENAI_PADRAO,
    };
  }

  const gemini = Deno.env.get("GEMINI_API_KEY");
  if (gemini) {
    return {
      nome: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      chave: gemini,
      modelo: Deno.env.get("GEMINI_MODEL") || MODELO_GEMINI_PADRAO,
    };
  }

  return null;
}

/** Mensagem para quem vai configurar, não para o usuário final. */
export const SEM_PROVEDOR =
  "Nenhuma chave de IA configurada. Defina OPENAI_API_KEY (recomendado) ou GEMINI_API_KEY nas variáveis da função.";
