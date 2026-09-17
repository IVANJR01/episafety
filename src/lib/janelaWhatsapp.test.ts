import { describe, it, expect } from "vitest";
import {
  horaDaMensagem,
  janelaAberta,
  juntarNumeros,
  partirNumeros,
  telefoneLegivel,
  tempoRestanteJanela,
} from "./janelaWhatsapp";

/*
 * A janela de 24h decide se o campo de escrita fica liberado. Errar para mais
 * é deixar a pessoa escrever um texto que a Meta vai recusar; errar para menos
 * é travar um atendimento que estava permitido.
 */

const agora = new Date("2026-09-17T12:00:00Z");

describe("janelaAberta", () => {
  it("aberta dentro das 24h", () => {
    expect(janelaAberta("2026-09-17T11:59:00Z", agora)).toBe(true);
    expect(janelaAberta("2026-09-16T12:30:00Z", agora)).toBe(true);
  });

  it("fecha exatamente em 24h", () => {
    expect(janelaAberta("2026-09-16T12:00:00Z", agora)).toBe(false);
  });

  it("contato que nunca escreveu está fora da janela", () => {
    expect(janelaAberta(null, agora)).toBe(false);
    expect(janelaAberta("data torta", agora)).toBe(false);
  });
});

describe("tempoRestanteJanela", () => {
  it("mostra horas quando ainda há folga", () => {
    expect(tempoRestanteJanela("2026-09-17T10:00:00Z", agora)).toBe("22h");
    expect(tempoRestanteJanela("2026-09-16T13:30:00Z", agora)).toBe("1h30");
  });

  it("vira minutos na última hora, que é quando a informação importa", () => {
    expect(tempoRestanteJanela("2026-09-16T12:40:00Z", agora)).toBe("40 min");
  });

  it("devolve null quando já fechou", () => {
    expect(tempoRestanteJanela("2026-09-15T12:00:00Z", agora)).toBeNull();
    expect(tempoRestanteJanela(null, agora)).toBeNull();
  });
});

describe("horaDaMensagem", () => {
  it("só a hora quando é do mesmo dia", () => {
    const hoje = new Date(2026, 8, 17, 14, 30);
    expect(horaDaMensagem(hoje.toISOString(), new Date(2026, 8, 17, 18, 0))).toBe("14:30");
  });

  it("leva a data quando é de outro dia", () => {
    const ontem = new Date(2026, 8, 16, 9, 5);
    expect(horaDaMensagem(ontem.toISOString(), new Date(2026, 8, 17, 18, 0))).toBe("16/09 09:05");
  });
});

describe("telefoneLegivel", () => {
  it("formata celular e fixo, com ou sem o DDI que a Meta manda", () => {
    expect(telefoneLegivel("5585988887777")).toBe("(85) 98888-7777");
    expect(telefoneLegivel("558532221111")).toBe("(85) 3222-1111");
  });

  it("não põe máscara de DDD em número de fora do Brasil", () => {
    // Tem 11 dígitos como um celular daqui; a máscara inventaria um telefone.
    expect(telefoneLegivel("13235551234")).toBe("+13235551234");
  });
});

describe("partirNumeros", () => {
  it("separa por vírgula e põe o DDI que ninguém digita", () => {
    expect(partirNumeros("85 99999-0000, 85 98888-1111")).toEqual(["5585999990000", "5585988881111"]);
  });

  it("não duplica o DDI de quem já digitou", () => {
    expect(partirNumeros("+55 85 99999-0000")).toEqual(["5585999990000"]);
  });

  it("descarta o que não é número de telefone", () => {
    // Virar "5512345" seria um envio aceito que não chega a ninguém.
    expect(partirNumeros("12345, , 85 99999-0000")).toEqual(["5585999990000"]);
    expect(partirNumeros("")).toEqual([]);
  });

  it("volta para a caixa de texto do jeito que dá para reeditar", () => {
    expect(juntarNumeros(["5585999990000", "5585988881111"])).toBe("5585999990000, 5585988881111");
    expect(juntarNumeros(null)).toBe("");
  });
});
