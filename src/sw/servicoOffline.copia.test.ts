import { describe, it, expect, beforeAll, vi } from "vitest";

/*
 * A cópia offline das telas: reaproveitar da cópia antiga, tentar de novo
 * quando a rede falha e descobrir o que ficou faltando. Cache e rede são
 * simulados; o arquivo testado é o mesmo que vai para o aparelho.
 */
const ARQUIVOS = ["/index.html", "/assets/EPIs-aaa.js", "/assets/Entregas-bbb.js"];

class CacheFalso {
  m = new Map<string, Response>();
  async keys() { return [...this.m.keys()].map((u) => new Request(`https://app${u}`)); }
  async put(u: string | Request, r: Response) { this.m.set(typeof u === "string" ? u : new URL(u.url).pathname, r); }
  async match(u: string) { return this.m.get(u); }
}
const antigo = new CacheFalso();
const novo = new CacheFalso();
let faltando: (c: CacheFalso) => Promise<string[]>;
let guardarArquivo: (c: CacheFalso, a: string) => Promise<boolean>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  (globalThis as any).__ARQUIVOS_PRECACHE__ = ARQUIVOS;
  (globalThis as any).caches = { match: async (u: string) => (await novo.match(u)) ?? (await antigo.match(u)) };
  await import("./servicoOffline.js");
  faltando = (globalThis as any).__faltando;
  guardarArquivo = (globalThis as any).__guardarArquivo;
});

describe("cópia offline das telas", () => {
  it("diz o que falta", async () => {
    await novo.put("/index.html", new Response("x"));
    expect(await faltando(novo)).toEqual(["/assets/EPIs-aaa.js", "/assets/Entregas-bbb.js"]);
  });

  it("tela que não mudou vem da cópia antiga, sem gastar internet", async () => {
    await antigo.put("/assets/EPIs-aaa.js", new Response("epis"));
    const rede = vi.fn();
    (globalThis as any).fetch = rede;
    expect(await guardarArquivo(novo, "/assets/EPIs-aaa.js")).toBe(true);
    expect(rede).not.toHaveBeenCalled();
    expect(await (await novo.match("/assets/EPIs-aaa.js"))!.text()).toBe("epis");
  });

  it("sinal fraco: tenta de novo até conseguir", async () => {
    let vezes = 0;
    (globalThis as any).fetch = vi.fn(async () => {
      vezes++;
      if (vezes < 3) throw new TypeError("Failed to fetch");
      return new Response("entregas");
    });
    const p = guardarArquivo(novo, "/assets/Entregas-bbb.js");
    await vi.runAllTimersAsync();
    expect(await p).toBe(true);
    expect(vezes).toBe(3);
    expect(await faltando(novo)).toEqual([]);
  });

  it("sem rede nenhuma: desiste depois de 3 tentativas, sem travar", async () => {
    (globalThis as any).fetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const p = guardarArquivo(new CacheFalso(), "/assets/Outra-ccc.js");
    await vi.runAllTimersAsync();
    expect(await p).toBe(false);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(3);
  });
});
