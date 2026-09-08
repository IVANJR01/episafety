import { describe, expect, it } from "vitest";
import { avaliarValidade, DIAS_DE_AVISO } from "./validadeCertificado";

const AGORA = new Date("2026-09-08T12:00:00Z");

/** Data ISO daqui a `dias` dias (negativo = passado). */
function daquiA(dias: number, horas = 0): string {
  return new Date(AGORA.getTime() + dias * 86_400_000 + horas * 3_600_000).toISOString();
}

describe("avaliarValidade", () => {
  it("fica calado quando o vencimento ainda está longe", () => {
    expect(avaliarValidade(daquiA(200), AGORA)).toBeNull();
  });

  it("fica calado no dia seguinte ao limite do aviso", () => {
    // Fronteira: 31 dias não avisa, 30 avisa. Sem isso o teste passaria com
    // qualquer prazo, inclusive um que avisasse o ano inteiro.
    expect(avaliarValidade(daquiA(DIAS_DE_AVISO + 1), AGORA)).toBeNull();
    expect(avaliarValidade(daquiA(DIAS_DE_AVISO), AGORA)?.nivel).toBe("aviso");
  });

  it("avisa com a contagem de dias e a data", () => {
    const a = avaliarValidade(daquiA(12), AGORA);
    expect(a?.nivel).toBe("aviso");
    expect(a?.dias).toBe(12);
    expect(a?.mensagem).toContain("vence em 12 dias");
    expect(a?.mensagem).toContain("20/09/2026");
  });

  it("usa singular quando falta um dia só", () => {
    const a = avaliarValidade(daquiA(1), AGORA);
    expect(a?.mensagem).toContain("vence em 1 dia");
    expect(a?.mensagem).not.toContain("1 dias");
  });

  it("conta em dias inteiros: 20 horas para vencer é 'vence hoje'", () => {
    const a = avaliarValidade(daquiA(0, 20), AGORA);
    expect(a?.dias).toBe(0);
    expect(a?.mensagem).toContain("vence hoje");
  });

  it("marca como vencido depois da data e diz há quantos dias", () => {
    const a = avaliarValidade(daquiA(-5), AGORA);
    expect(a?.nivel).toBe("vencido");
    expect(a?.dias).toBe(-5);
    expect(a?.mensagem).toContain("há 5 dias");
    expect(a?.mensagem).toContain("não será aceita no validar.iti.gov.br");
  });

  it("não inventa aviso quando a data não veio ou não dá para ler", () => {
    // A função `assinar-pdf` devolve null se não conseguir abrir o .pfx.
    // Mandar renovar por causa disso seria alarme falso.
    expect(avaliarValidade(null, AGORA)).toBeNull();
    expect(avaliarValidade(undefined, AGORA)).toBeNull();
    expect(avaliarValidade("", AGORA)).toBeNull();
    expect(avaliarValidade("nao e data", AGORA)).toBeNull();
  });

  it("aceita um prazo de aviso diferente do padrão", () => {
    expect(avaliarValidade(daquiA(45), AGORA, 60)?.nivel).toBe("aviso");
    expect(avaliarValidade(daquiA(45), AGORA)).toBeNull();
  });
});
