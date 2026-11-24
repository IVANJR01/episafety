import { describe, it, expect, vi } from "vitest";
import { importarComRecarga, ehFalhaDeArquivoDaVersaoAntiga } from "./carregarPagina";

function ambiente() {
  const dados = new Map<string, string>();
  return {
    sessao: { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v), removeItem: (k: string) => void dados.delete(k) },
    recarregar: vi.fn(),
  };
}
const falhaDeVersao = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/Entregas-abc.js"));

describe("carregar página sob demanda", () => {
  it("arquivo da versão antiga sumiu: recarrega uma vez", async () => {
    const amb = ambiente();
    void importarComRecarga(falhaDeVersao, amb);
    await new Promise((r) => setTimeout(r, 0));
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
  });
  it("se falhar de novo depois da recarga, mostra o erro em vez de recarregar sem fim", async () => {
    const amb = ambiente();
    void importarComRecarga(falhaDeVersao, amb);
    await new Promise((r) => setTimeout(r, 0));
    await expect(importarComRecarga(falhaDeVersao, amb)).rejects.toThrow();
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
  });
  it("deu certo: limpa a marca, e a próxima publicação pode recarregar de novo", async () => {
    const amb = ambiente();
    void importarComRecarga(falhaDeVersao, amb);
    await new Promise((r) => setTimeout(r, 0));
    await importarComRecarga(() => Promise.resolve({ default: 1 }), amb);
    void importarComRecarga(falhaDeVersao, amb);
    await new Promise((r) => setTimeout(r, 0));
    expect(amb.recarregar).toHaveBeenCalledTimes(2);
  });
  it("sem internet não recarrega: só faria a tela piscar", async () => {
    const amb = { ...ambiente(), online: () => false };
    await expect(importarComRecarga(falhaDeVersao, amb)).rejects.toThrow();
    expect(amb.recarregar).not.toHaveBeenCalled();
  });
  it("outro erro (bug na página) não recarrega", async () => {
    const amb = ambiente();
    await expect(importarComRecarga(() => Promise.reject(new Error("x is not defined")), amb)).rejects.toThrow("x is not defined");
    expect(amb.recarregar).not.toHaveBeenCalled();
  });
  it("reconhece a mensagem de cada navegador", () => {
    expect(ehFalhaDeArquivoDaVersaoAntiga(new Error("Importing a module script failed."))).toBe(true); // Safari
    expect(ehFalhaDeArquivoDaVersaoAntiga(new Error("error loading dynamically imported module"))).toBe(true); // Firefox
    expect(ehFalhaDeArquivoDaVersaoAntiga(new Error("Failed to fetch dynamically imported module: x"))).toBe(true); // Chrome
  });
});
