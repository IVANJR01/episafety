import { describe, it, expect } from "vitest";
import { recadoDeErro } from "./recadoDaAssinaturaRemota";

/**
 * O caso que deu origem a isto: faltava uma função no banco, e a página
 * mostrou ao trabalhador "Could not find the function
 * public.consultar_entregas_pendentes_publico(p_funcionario_id) in the
 * schema cache". Em inglês, com nome de função de banco, no celular de
 * quem só queria assinar o recebimento da luva.
 */

const ERRO_DO_BANCO = {
  message:
    "Could not find the function public.consultar_entregas_pendentes_publico(p_funcionario_id) in the schema cache",
  code: "PGRST202",
};

describe("erro técnico nunca vai para a tela", () => {
  it("o nome da função do banco não aparece para o trabalhador", () => {
    const r = recadoDeErro({ acao: "carregar", falhaTecnica: ERRO_DO_BANCO });
    expect(r.mensagem).not.toMatch(/function|schema cache|public\./i);
    expect(r.mensagem).not.toMatch(/consultar_entregas_pendentes_publico/);
  });

  it("mas continua disponível para quem dá suporte", () => {
    /* Esconder do trabalhador não é perder: o console precisa ter. */
    const r = recadoDeErro({ acao: "carregar", falhaTecnica: ERRO_DO_BANCO });
    expect(r.tecnico).toContain("schema cache");
  });

  it("o recado diz o que fazer e com quem falar", () => {
    const r = recadoDeErro({ acao: "carregar", falhaTecnica: ERRO_DO_BANCO });
    expect(r.mensagem).toMatch(/tente de novo/i);
    expect(r.mensagem, "não disse a quem recorrer").toMatch(/respons[áa]vel/i);
  });

  it("carregar e assinar falam de coisas diferentes", () => {
    const carregar = recadoDeErro({ acao: "carregar", falhaTecnica: ERRO_DO_BANCO });
    const assinar = recadoDeErro({ acao: "assinar", falhaTecnica: ERRO_DO_BANCO });
    expect(assinar.mensagem).toMatch(/assinatura/i);
    expect(carregar.mensagem).not.toBe(assinar.mensagem);
  });

  it("erro sem mensagem nenhuma ainda produz recado", () => {
    for (const vazio of [null, undefined, {}, ""]) {
      const r = recadoDeErro({ acao: "assinar", falhaTecnica: vazio });
      expect(r.mensagem.length).toBeGreaterThan(20);
    }
  });
});

describe("o motivo que o próprio sistema deu", () => {
  it("é mostrado como está, porque já foi escrito para o trabalhador", () => {
    const r = recadoDeErro({
      acao: "assinar",
      recusaDoServidor: "Não há entregas pendentes de assinatura.",
    });
    expect(r.mensagem).toBe("Não há entregas pendentes de assinatura.");
    expect(r.tecnico).toBeNull();
  });

  it("tem prioridade sobre a falha técnica", () => {
    /*
     * Quando os dois chegam juntos, o do servidor explica o caso concreto
     * e o técnico é só ruído.
     */
    const r = recadoDeErro({
      acao: "assinar",
      recusaDoServidor: "Link inválido ou expirado.",
      falhaTecnica: ERRO_DO_BANCO,
    });
    expect(r.mensagem).toBe("Link inválido ou expirado.");
  });

  it("recusa em branco não vira mensagem vazia na tela", () => {
    const r = recadoDeErro({ acao: "carregar", recusaDoServidor: "   " });
    expect(r.mensagem.length).toBeGreaterThan(20);
  });
});

describe("celular sem sinal", () => {
  it("diz que é falta de internet, não erro do sistema", () => {
    /*
     * O trabalhador abre esse link na obra. Mandar ele procurar o técnico
     * de segurança quando o problema é o 4G faz todo mundo perder tempo.
     */
    const r = recadoDeErro({
      acao: "carregar",
      falhaTecnica: new TypeError("Failed to fetch"),
    });
    expect(r.mensagem).toMatch(/internet|sinal/i);
  });

  it("reconhece o aparelho declarado offline", () => {
    const r = recadoDeErro({ acao: "assinar", comInternet: false });
    expect(r.mensagem).toMatch(/internet|sinal/i);
  });

  it("falha comum do servidor não é confundida com falta de sinal", () => {
    const r = recadoDeErro({ acao: "carregar", falhaTecnica: ERRO_DO_BANCO });
    expect(r.mensagem).not.toMatch(/sinal do seu celular/i);
  });
});
