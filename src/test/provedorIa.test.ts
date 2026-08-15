import { describe, it, expect, afterEach } from "vitest";
import { resolverProvedorIa, SEM_PROVEDOR } from "../../supabase/functions/_shared/provedorIa";

/**
 * A regra de escolha do provedor de IA vive numa Edge Function (Deno), e o
 * projeto não roda Deno aqui. Mas o arquivo é TypeScript comum: o módulo é
 * importado de verdade e só o `Deno.env` é substituído — ele é lido dentro da
 * função, nunca ao carregar o módulo, então trocar o ambiente entre um teste e
 * outro basta.
 *
 * O que se protege: a chave do Gemini não pode continuar respondendo depois
 * que a da OpenAI entrar — senão a troca "acontece" sem acontecer, e ninguém
 * percebe até a fatura chegar do lado errado.
 */

const comAmbiente = (env: Record<string, string>) => {
  (globalThis as any).Deno = { env: { get: (k: string) => env[k] } };
};

afterEach(() => { delete (globalThis as any).Deno; });

describe("resolverProvedorIa", () => {
  it("usa a OpenAI quando a chave dela existe", () => {
    comAmbiente({ OPENAI_API_KEY: "sk-teste" });
    const p = resolverProvedorIa()!;
    expect(p.nome).toBe("openai");
    expect(p.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(p.chave).toBe("sk-teste");
  });

  it("a OpenAI ganha do Gemini quando as duas chaves existem", () => {
    // É este o ponto da troca: deixar a chave antiga no ambiente não pode
    // fazer o Gemini continuar respondendo.
    comAmbiente({ OPENAI_API_KEY: "sk-teste", GEMINI_API_KEY: "gem-antiga" });
    expect(resolverProvedorIa()!.nome).toBe("openai");
  });

  it("cai no Gemini enquanto a chave da OpenAI não for configurada", () => {
    comAmbiente({ GEMINI_API_KEY: "gem" });
    const p = resolverProvedorIa()!;
    expect(p.nome).toBe("gemini");
    expect(p.url).toContain("generativelanguage.googleapis.com");
  });

  it("devolve nulo sem nenhuma chave — a tela cai na base de palavras-chave", () => {
    comAmbiente({});
    expect(resolverProvedorIa()).toBeNull();
    expect(SEM_PROVEDOR).toMatch(/OPENAI_API_KEY/);
  });

  it("o modelo pode ser trocado por variável, sem publicar de novo", () => {
    comAmbiente({ OPENAI_API_KEY: "sk-teste", OPENAI_MODEL: "gpt-4.1-mini" });
    expect(resolverProvedorIa()!.modelo).toBe("gpt-4.1-mini");
  });

  it("tem modelo padrão quando a variável não é definida", () => {
    comAmbiente({ OPENAI_API_KEY: "sk-teste" });
    expect(resolverProvedorIa()!.modelo).toBeTruthy();
  });
});
