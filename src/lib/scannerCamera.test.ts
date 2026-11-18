import { describe, expect, it } from "vitest";
import { precisaReatarStream, encaixarNaArea, videoParaTela } from "./scannerCamera";

const stream = { id: "stream-da-camera" };

describe("precisaReatarStream", () => {
  it("reata quando o vídeo volta à tela zerado com a câmera ainda ligada", () => {
    // É o bug: sair do passo de ajuste monta um <video> novo, sem fonte,
    // enquanto o stream continua no ar. A prévia ficava preta e o Capturar
    // continuava habilitado.
    expect(precisaReatarStream({ srcObject: null }, stream, false)).toBe(true);
  });

  it("não reata o que já está reatado", () => {
    // Reatribuir a mesma fonte reinicia a reprodução à toa.
    expect(precisaReatarStream({ srcObject: stream }, stream, false)).toBe(false);
  });

  it("não mexe em nada durante o passo de ajuste", () => {
    // Ali o <video> nem existe; qualquer tentativa seria sobre o elemento
    // antigo, já desmontado.
    expect(precisaReatarStream({ srcObject: null }, stream, true)).toBe(false);
  });

  it("não tenta reatar sem câmera aberta", () => {
    // Câmera negada ou ainda abrindo: quem avisa é a mensagem na tela.
    expect(precisaReatarStream({ srcObject: null }, null, false)).toBe(false);
    expect(precisaReatarStream({ srcObject: null }, undefined, false)).toBe(false);
  });

  it("não estoura sem elemento de vídeo", () => {
    expect(precisaReatarStream(null, stream, false)).toBe(false);
    expect(precisaReatarStream(undefined, stream, false)).toBe(false);
  });

  it("troca a fonte quando o stream é outro", () => {
    // "Tentar de novo" abre um stream novo; o vídeo tem que acompanhar.
    expect(precisaReatarStream({ srcObject: { id: "antigo" } }, stream, false)).toBe(true);
  });
});

describe("encaixar a foto na área de ajuste", () => {
  it("foto 3:4 num celular comprido: ocupa a largura, centrada na altura", () => {
    /* 390 x 700 de área, foto 3024 x 4032: 390 x 520, com 90 em cima e embaixo. */
    const e = encaixarNaArea(390, 700, 3024, 4032);
    expect(e.largura).toBeCloseTo(390);
    expect(e.altura).toBeCloseTo(520);
    expect(e.topo).toBeCloseTo(90);
    expect(e.esquerda).toBeCloseTo(0);
  });

  it("mantém o formato da foto — nada é esticado", () => {
    const e = encaixarNaArea(1200, 700, 4032, 3024);
    expect(e.largura / e.altura).toBeCloseTo(4032 / 3024);
  });

  it("sempre cabe na área", () => {
    for (const [aL, aA, iL, iA] of [[390, 700, 3024, 4032], [1200, 700, 1080, 1920], [500, 500, 100, 900]]) {
      const e = encaixarNaArea(aL, aA, iL, iA);
      expect(e.largura).toBeLessThanOrEqual(aL + 1e-6);
      expect(e.altura).toBeLessThanOrEqual(aA + 1e-6);
    }
  });

  it("área ainda sem tamanho não quebra", () => {
    expect(encaixarNaArea(0, 0, 100, 100)).toEqual({ largura: 0, altura: 0, esquerda: 0, topo: 0 });
  });
});

describe("contorno ao vivo sobre a prévia da câmera", () => {
  it("vídeo 1920x1080 deitado numa tela em pé: amplia pela altura e corta as laterais", () => {
    /* Tela 390x700: escala 700/1080; o vídeo fica com 1244 de largura, 427 cortados de cada lado. */
    const centro = videoParaTela({ x: 960, y: 540 }, 1920, 1080, 390, 700);
    expect(centro.x).toBeCloseTo(195);
    expect(centro.y).toBeCloseTo(350);
    const topoEsq = videoParaTela({ x: 0, y: 0 }, 1920, 1080, 390, 700);
    expect(topoEsq.y).toBeCloseTo(0);
    expect(topoEsq.x).toBeLessThan(0); // fora da tela: é a parte cortada
  });

  it("vídeo com o mesmo formato da tela: só escala, sem deslocar", () => {
    /* Vídeo com o dobro do tamanho da tela: tudo pela metade, sem corte. */
    expect(videoParaTela({ x: 540, y: 960 }, 1080, 1920, 540, 960)).toEqual({ x: 270, y: 480 });
    expect(videoParaTela({ x: 0, y: 0 }, 1080, 1920, 540, 960)).toEqual({ x: 0, y: 0 });
  });
});
