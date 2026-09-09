import { describe, expect, it } from "vitest";
import { precisaReatarStream } from "./scannerCamera";

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
