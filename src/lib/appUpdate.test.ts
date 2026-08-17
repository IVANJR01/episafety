import { describe, it, expect, vi, afterEach } from "vitest";
import { ehCacheOffline, purgeAppCaches, unregisterAppServiceWorkers, CAMINHO_SW_OFFLINE } from "./appUpdate";

/**
 * O conflito que estes testes existem para impedir.
 *
 * O botão "Atualizar", no rodapé do menu, chamava `forceAppUpdate`, que
 * desregistrava todo service worker em `/sw.js` e apagava caches por padrão de
 * nome. Depois que `/sw.js` passou a ser o service worker que guarda a cópia
 * offline do aplicativo, esse mesmo botão passaria a APAGAR o modo offline:
 * a pessoa clicaria em "Atualizar" e o sistema deixaria de abrir sem internet,
 * sem nenhum aviso e sem relação aparente com o que ela fez.
 */

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("ehCacheOffline", () => {
  it("reconhece a cópia offline do aplicativo", () => {
    expect(ehCacheOffline("episafety-app-ac146198-msxk")).toBe(true);
  });

  it("não confunde com os caches antigos nem com o de imagens", () => {
    expect(ehCacheOffline("workbox-precache-v2")).toBe(false);
    expect(ehCacheOffline("supabase-storage-cache")).toBe(false);
  });
});

describe("purgeAppCaches", () => {
  it("NÃO apaga a cópia offline — apagá-la é perder o modo sem internet", async () => {
    const apagados: string[] = [];
    vi.stubGlobal("caches", {
      keys: async () => [
        "episafety-app-versao-atual",
        // Nome plausível para esta mesma cópia — "app shell" é justamente o
        // que ela é. Sem a proteção, ele casa com o padrão /app-shell/ da
        // limpeza de caches antigos e a cópia offline seria apagada.
        "episafety-app-shell-versao-atual",
        "workbox-precache-v2-https://x/",
        "supabase-storage-cache",
      ],
      delete: async (nome: string) => { apagados.push(nome); return true; },
    });

    await purgeAppCaches();

    expect(apagados).not.toContain("episafety-app-versao-atual");
    expect(apagados).not.toContain("episafety-app-shell-versao-atual");
    // Limpar o que sobrou do service worker antigo continua sendo o trabalho dele.
    expect(apagados).toContain("workbox-precache-v2-https://x/");
  });
});

describe("unregisterAppServiceWorkers", () => {
  const registroFalso = (scriptURL: string) => {
    const reg = {
      active: { scriptURL, postMessage: vi.fn() },
      waiting: null,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      unregister: vi.fn().mockResolvedValue(true),
    };
    return reg;
  };

  it("NÃO desregistra o service worker offline de /sw.js", async () => {
    const offline = registroFalso(`${window.location.origin}${CAMINHO_SW_OFFLINE}`);
    vi.stubGlobal("navigator", {
      onLine: true,
      serviceWorker: { getRegistrations: async () => [offline] },
    });

    await unregisterAppServiceWorkers();

    expect(offline.unregister).not.toHaveBeenCalled();
  });

  it("continua desregistrando o service worker antigo de /service-worker.js", async () => {
    const antigo = registroFalso(`${window.location.origin}/service-worker.js`);
    vi.stubGlobal("navigator", {
      onLine: true,
      serviceWorker: { getRegistrations: async () => [antigo] },
    });

    await unregisterAppServiceWorkers();

    expect(antigo.unregister).toHaveBeenCalledTimes(1);
  });
});
