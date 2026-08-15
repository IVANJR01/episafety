import { describe, it, expect, vi, afterEach } from "vitest";
import { pedirInstalacao, estaInstalado } from "./instalarPwa";

/**
 * O erro real, visto na tela de login:
 *
 *   Failed to execute 'prompt' on 'BeforeInstallPromptEvent':
 *   The prompt() method must be called with a user gesture
 *   (promessa sem tratamento)
 *
 * A recusa do navegador é legítima e frequente. O que não pode é ela subir sem
 * tratamento e virar aviso de erro por cima do formulário de entrada.
 */

const recusaDoNavegador = () =>
  new DOMException(
    "Failed to execute 'prompt' on 'BeforeInstallPromptEvent': The prompt() method must be called with a user gesture",
    "NotAllowedError",
  );

afterEach(() => vi.restoreAllMocks());

describe("pedirInstalacao", () => {
  it("devolve 'aceito' quando o usuário instala", async () => {
    const evento = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    expect(await pedirInstalacao(evento)).toBe("aceito");
    expect(evento.prompt).toHaveBeenCalledTimes(1);
  });

  it("devolve 'recusado' quando o usuário cancela", async () => {
    const evento = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    };
    expect(await pedirInstalacao(evento)).toBe("recusado");
  });

  it("NÃO deixa a recusa do navegador vazar — era o defeito", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const evento = {
      prompt: vi.fn().mockRejectedValue(recusaDoNavegador()),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    // Sem rejeitar: antes isso subia como "promessa sem tratamento".
    await expect(pedirInstalacao(evento)).resolves.toBe("indisponivel");
  });

  it("trata também o navegador antigo, que lança em vez de rejeitar", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const evento = {
      prompt: vi.fn(() => { throw recusaDoNavegador(); }),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    };
    await expect(pedirInstalacao(evento)).resolves.toBe("indisponivel");
  });

  it("evento ausente ou inválido não quebra nada", async () => {
    expect(await pedirInstalacao(null)).toBe("indisponivel");
    expect(await pedirInstalacao(undefined)).toBe("indisponivel");
    expect(await pedirInstalacao({})).toBe("indisponivel");
  });

  it("falha na escolha do usuário também é contida", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const evento = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.reject(new Error("canal fechado")),
    };
    await expect(pedirInstalacao(evento)).resolves.toBe("indisponivel");
  });
});

describe("estaInstalado", () => {
  it("reconhece a janela do aplicativo instalado", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(estaInstalado()).toBe(true);
  });

  it("no navegador comum devolve falso", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    expect(estaInstalado()).toBe(false);
  });
});
