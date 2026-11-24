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

import { carregarComLimite } from "./carregarPagina";

describe("a tela nunca fica girando para sempre", () => {
  it("arquivo que não chega no limite vira o aviso discreto com 'Recarregar'", async () => {
    vi.useFakeTimers();
    const p = carregarComLimite(() => new Promise(() => {}), { limiteMs: 20_000 });
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await p;
    expect((r.default as any).name).toBe("PaginaComFalha");
    vi.useRealTimers();
  });
  it("chegou a tempo: usa a tela de verdade", async () => {
    const Tela = () => null;
    const r = await carregarComLimite(() => Promise.resolve({ default: Tela }), { limiteMs: 1000 });
    expect(r.default).toBe(Tela);
  });
  it("sem internet e sem o arquivo: aviso de tela não guardada", async () => {
    sessionStorage.setItem("episafety:recarregou-por-pagina-nova", "1");
    const r = await carregarComLimite(() => Promise.reject(new TypeError("Importing a module script failed.")), { online: () => false });
    expect((r.default as any).name).toBe("PaginaSemConexao");
    sessionStorage.clear();
  });
  it("com internet, arquivo falhou mesmo depois de recarregar: 'Recarregar', não tela branca", async () => {
    sessionStorage.setItem("episafety:recarregou-por-pagina-nova", "1");
    const r = await carregarComLimite(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: x")), { online: () => true });
    expect((r.default as any).name).toBe("PaginaComFalha");
    sessionStorage.clear();
  });
  it("defeito da tela (não é arquivo) continua aparecendo como erro", async () => {
    await expect(carregarComLimite(() => Promise.reject(new Error("x is not defined")))).rejects.toThrow("x is not defined");
  });
  it("pediu recarga e o celular não recarregou: desiste em 8 s em vez de esperar para sempre", async () => {
    vi.useFakeTimers();
    const amb = { sessao: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, recarregar: vi.fn(), online: () => true };
    const p = importarComRecarga(() => Promise.reject(new TypeError("Importing a module script failed.")), amb);
    const verificado = expect(p).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(8_000);
    await verificado;
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

import { preCarregarTelas } from "./carregarPagina";

describe("telas pré-carregadas depois do login", () => {
  it("carrega todas, no máximo três ao mesmo tempo, e não para numa que falha", async () => {
    const ordem: string[] = [];
    let aoMesmoTempo = 0, maximo = 0;
    const tela = (nome: string, falha = false) => async () => {
      aoMesmoTempo++; maximo = Math.max(maximo, aoMesmoTempo);
      await new Promise((r) => setTimeout(r, 5));
      aoMesmoTempo--; ordem.push(nome);
      if (falha) throw new Error("sem sinal");
    };
    await preCarregarTelas([tela("a"), tela("b", true), tela("c"), tela("d"), tela("e")]);
    expect([...ordem].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(maximo).toBe(3);
  });
  it("roda uma vez só", async () => {
    const carregar = vi.fn(async () => {});
    await preCarregarTelas([carregar]);
    expect(carregar).not.toHaveBeenCalled();
  });
});
