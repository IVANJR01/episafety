import { describe, expect, it } from "vitest";
import { podeCapturar, temQuadro } from "./scannerCamera";

describe("temQuadro", () => {
  it("reconhece um vídeo com dimensão", () => {
    expect(temQuadro({ videoWidth: 1920, videoHeight: 1080 })).toBe(true);
  });

  it("recusa o vídeo recém-montado, que ainda mede 0x0", () => {
    // É a janela entre atribuir o stream e o navegador ler os metadados.
    // Capturar aqui copiava um quadro vazio.
    expect(temQuadro({ videoWidth: 0, videoHeight: 0 })).toBe(false);
    expect(temQuadro({ videoWidth: 1920, videoHeight: 0 })).toBe(false);
    expect(temQuadro({ videoWidth: 0, videoHeight: 1080 })).toBe(false);
  });

  it("não estoura sem elemento", () => {
    expect(temQuadro(null)).toBe(false);
    expect(temQuadro(undefined)).toBe(false);
    expect(temQuadro({})).toBe(false);
  });
});

describe("podeCapturar", () => {
  it("libera com câmera ligada, prévia pronta e nada em andamento", () => {
    expect(podeCapturar(true, true, false)).toBe(true);
  });

  it("segura enquanto a prévia não tem dimensão", () => {
    // Este é o caso que quebrava a segunda página: voltando do passo de
    // cantos, a câmera segue ligada mas o <video> é outro e começa zerado.
    expect(podeCapturar(true, false, false)).toBe(false);
  });

  it("segura sem câmera", () => {
    expect(podeCapturar(false, true, false)).toBe(false);
  });

  it("segura enquanto gera o PDF", () => {
    expect(podeCapturar(true, true, true)).toBe(false);
  });
});
