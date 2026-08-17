import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  decidirRecarga, lerEstadoDaTela, buscarVersaoPublicada, iniciarVerificacaoDeVersao, versaoParaMostrar,
} from "./verificarAtualizacao";

/**
 * O caso real: aplicativo instalado no celular preso num pacote antigo. Um
 * cadastro feito nele não aparecia — não porque se perdesse, mas porque aquele
 * pacote era anterior às correções de sincronização.
 *
 * A parte perigosa desta funcionalidade é recarregar na hora errada: no meio
 * de um cadastro, apagaria o que a pessoa digitou. Trocar "dado atrasado" por
 * "dado perdido" seria piorar.
 */

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("decidirRecarga", () => {
  it("aba em segundo plano: recarrega — é o caso do celular e não há o que perder", () => {
    expect(decidirRecarga({ oculta: true, digitando: false })).toBe("recarregar");
  });

  it("aba oculta manda mesmo com campo focado, porque ninguém está digitando ali", () => {
    expect(decidirRecarga({ oculta: true, digitando: true })).toBe("recarregar");
  });

  it("pessoa digitando com a tela na frente: ESPERA", () => {
    // Este é o teste que impede a correção de virar um defeito pior.
    expect(decidirRecarga({ oculta: false, digitando: true })).toBe("esperar");
  });

  it("tela aberta e ninguém digitando: recarrega", () => {
    expect(decidirRecarga({ oculta: false, digitando: false })).toBe("recarregar");
  });
});

describe("versaoParaMostrar", () => {
  it("mostra o commit, não o id inteiro com carimbo de tempo", () => {
    expect(versaoParaMostrar("ac146198-msxkdweo")).toBe("ac146198");
  });

  it("id sem traço aparece como está, em vez de sumir", () => {
    expect(versaoParaMostrar("desenvolvimento")).toBe("desenvolvimento");
  });

  it("nunca devolve vazio — rodapé sem versão nenhuma é pior que versão feia", () => {
    expect(versaoParaMostrar("")).toBe("");
    expect(versaoParaMostrar("-abc")).toBe("-abc");
  });
});

describe("lerEstadoDaTela", () => {
  it("reconhece foco em campo de texto", () => {
    const campo = document.createElement("input");
    document.body.appendChild(campo);
    campo.focus();
    expect(lerEstadoDaTela().digitando).toBe(true);
    campo.remove();
  });

  it("reconhece área editável, não só input", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    div.focus();
    // jsdom nem sempre implementa isContentEditable; quando não implementa, o
    // teste registra isso em vez de fingir cobertura.
    const estado = lerEstadoDaTela();
    expect(typeof estado.digitando).toBe("boolean");
    div.remove();
  });

  it("sem foco em campo, não considera que está digitando", () => {
    (document.activeElement as HTMLElement | null)?.blur();
    expect(lerEstadoDaTela().digitando).toBe(false);
  });
});

describe("buscarVersaoPublicada", () => {
  it("pede sem cache — senão a verificação leria a resposta velha", async () => {
    const fetchFalso = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchFalso);
    expect(await buscarVersaoPublicada()).toBe("abc123");
    const [, opcoes] = fetchFalso.mock.calls[0];
    expect(opcoes.cache).toBe("no-store");
  });

  it("sem rede devolve nulo em vez de estourar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await buscarVersaoPublicada()).toBeNull();
  });

  it("resposta sem o campo esperado devolve nulo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await buscarVersaoPublicada()).toBeNull();
  });
});

describe("iniciarVerificacaoDeVersao", () => {
  const esperar = () => new Promise((r) => setTimeout(r, 0));

  // A trava anti-laço grava em sessionStorage, que sobrevive de um teste para
  // o outro. Sem limpar aqui, um teste que recarrega por "versao-nova" faz o
  // seguinte parecer aprovado por engano — ou, pior, reprovar sem defeito.
  beforeEach(() => sessionStorage.removeItem("versao-ja-recarregada"));

  it("recarrega quando o id publicado difere do que está rodando", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-nova" }),
    }));
    const recarregar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar, intervaloMs: 10_000 });
    await esperar(); await esperar();
    expect(recarregar).toHaveBeenCalledTimes(1);
    parar();
  });

  it("NÃO recarrega quando a versão é a mesma", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "desenvolvimento" }),
    }));
    const recarregar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar, intervaloMs: 10_000 });
    await esperar(); await esperar();
    expect(recarregar).not.toHaveBeenCalled();
    parar();
  });

  it("recarrega uma vez só, não em laço", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-nova" }),
    }));
    const recarregar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar, intervaloMs: 10_000 });
    await esperar(); await esperar();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("focusout"));
    await esperar(); await esperar();
    expect(recarregar).toHaveBeenCalledTimes(1);
    parar();
  });

  it("depois de parar, não recarrega mais", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-nova" }),
    }));
    const recarregar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar, intervaloMs: 10_000 });
    parar();
    window.dispatchEvent(new Event("focus"));
    await esperar(); await esperar();
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("recarrega UMA vez por versão — sem isto vira laço infinito", async () => {
    // Cenário real e traiçoeiro: o servidor anuncia versão nova mas continua
    // entregando o pacote antigo (cache de CDN, publicação pela metade). A
    // página volta, detecta a mesma diferença e recarregaria de novo, para
    // sempre, piscando na mão do usuário.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    sessionStorage.setItem("versao-ja-recarregada", "versao-teimosa");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-teimosa" }),
    }));
    const recarregar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar, intervaloMs: 10_000 });
    await esperar(); await esperar();
    expect(recarregar).not.toHaveBeenCalled();
    sessionStorage.removeItem("versao-ja-recarregada");
    parar();
  });

  it("registra a versão antes de recarregar, para a próxima carga saber", async () => {
    sessionStorage.removeItem("versao-ja-recarregada");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-nova" }),
    }));
    const parar = iniciarVerificacaoDeVersao({ recarregar: () => {}, intervaloMs: 10_000 });
    await esperar(); await esperar();
    expect(sessionStorage.getItem("versao-ja-recarregada")).toBe("versao-nova");
    sessionStorage.removeItem("versao-ja-recarregada");
    parar();
  });

  it("avisa quem quiser saber que há versão nova", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ build: "versao-nova" }),
    }));
    const aoDetectar = vi.fn();
    const parar = iniciarVerificacaoDeVersao({ recarregar: () => {}, aoDetectar, intervaloMs: 10_000 });
    await esperar(); await esperar();
    expect(aoDetectar).toHaveBeenCalledWith("versao-nova");
    parar();
  });
});
