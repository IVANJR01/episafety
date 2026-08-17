import { describe, it, expect, beforeAll } from "vitest";

/**
 * O service worker é um arquivo JS comum (não pode ter `export`, senão o
 * navegador recusa registrá-lo como script clássico). Ele publica as funções
 * de decisão em `self` justamente para poder ser testado aqui — o teste roda
 * sobre o MESMO arquivo que vai para o aparelho, não sobre uma cópia.
 */

type Estrategia = "ignorar" | "rede-apenas" | "rede-primeiro" | "cache-primeiro";
type Pedido = { url: string; method?: string; mode?: string };

let estrategiaPara: (p: Pedido, origem: string) => Estrategia;
let ehCacheParaApagar: (nome: string) => boolean;

const APP = "https://safetysolucoes.com";

beforeAll(async () => {
  await import("./servicoOffline.js");
  estrategiaPara = (globalThis as never as Record<string, never>)["__estrategiaPara"];
  ehCacheParaApagar = (globalThis as never as Record<string, never>)["__ehCacheParaApagar"];
});

describe("estrategiaPara", () => {
  it("navegação vai à REDE primeiro — é o que impede o defeito antigo de voltar", () => {
    /*
     * O service worker anterior foi desligado porque guardava o index.html e o
     * entregava velho depois de publicar. O index.html velho aponta para
     * /assets/algo-HASH.js que já não existe: 404, nada monta, tela branca.
     * Enquanto navegação for rede-primeiro, com sinal o index.html vem sempre
     * do servidor e não há como ficar velho.
     */
    expect(estrategiaPara({ url: `${APP}/entregas`, mode: "navigate" }, APP)).toBe("rede-primeiro");
    expect(estrategiaPara({ url: `${APP}/`, mode: "navigate" }, APP)).toBe("rede-primeiro");
  });

  it("arquivo com hash no nome pode vir do cache — o conteúdo daquele nome nunca muda", () => {
    expect(estrategiaPara({ url: `${APP}/assets/index-BboNIf48.js` }, APP)).toBe("cache-primeiro");
    expect(estrategiaPara({ url: `${APP}/assets/index-abc123.css` }, APP)).toBe("cache-primeiro");
  });

  it("NUNCA guarda resposta do Supabase — cache do navegador não conhece empresa nem usuário", () => {
    // Guardar isto entregaria dado de uma empresa para outra no mesmo aparelho.
    expect(estrategiaPara({ url: "https://estmuducawmftvpbeutm.supabase.co/rest/v1/funcionarios" }, APP))
      .toBe("ignorar");
    expect(estrategiaPara({ url: "https://estmuducawmftvpbeutm.supabase.co/auth/v1/token" }, APP))
      .toBe("ignorar");
  });

  it("não guarda nada de outros domínios (Google Drive, fontes, APIs)", () => {
    expect(estrategiaPara({ url: "https://www.googleapis.com/drive/v3/files/abc" }, APP)).toBe("ignorar");
    expect(estrategiaPara({ url: "https://fonts.googleapis.com/css2?family=X" }, APP)).toBe("ignorar");
  });

  it("version.json nunca vem do cache — seria perguntar ao cache se o cache está velho", () => {
    expect(estrategiaPara({ url: `${APP}/version.json` }, APP)).toBe("rede-apenas");
    expect(estrategiaPara({ url: `${APP}/version.json?t=123` }, APP)).toBe("rede-apenas");
  });

  it("gravação não passa por cache — quem cuida disso é a fila de sincronização", () => {
    for (const method of ["POST", "PATCH", "DELETE", "PUT"]) {
      expect(estrategiaPara({ url: `${APP}/qualquer`, method }, APP)).toBe("ignorar");
    }
  });

  it("ícone e manifesto: rede primeiro, com o cache de reserva", () => {
    expect(estrategiaPara({ url: `${APP}/manifest.json` }, APP)).toBe("rede-primeiro");
    expect(estrategiaPara({ url: `${APP}/favicon.png` }, APP)).toBe("rede-primeiro");
  });

  it("url inválida não derruba o service worker", () => {
    expect(estrategiaPara({ url: "isto-nao-e-url::" }, "origem-invalida")).toBe("ignorar");
  });
});

describe("ehCacheParaApagar", () => {
  it("apaga a cópia das versões anteriores do aplicativo", () => {
    expect(ehCacheParaApagar("episafety-app-abc123-antigo")).toBe(true);
  });

  it("NÃO apaga a cópia da versão atual", () => {
    // O nome atual sai do build; em teste o padrão é "desenvolvimento".
    expect(ehCacheParaApagar("episafety-app-desenvolvimento")).toBe(false);
  });

  it("apaga o que sobrou do service worker antigo (Workbox/vite-pwa)", () => {
    expect(ehCacheParaApagar("workbox-precache-v2-https://x/")).toBe(true);
    expect(ehCacheParaApagar("vite-pwa-cache")).toBe(true);
    expect(ehCacheParaApagar("app-shell-v1")).toBe(true);
  });

  it("NÃO apaga o cache de imagens do sistema — as fotos das inspeções vivem ali", () => {
    // Este é o teste que impede a limpeza de virar perda de foto offline.
    expect(ehCacheParaApagar("supabase-storage-cache")).toBe(false);
    expect(ehCacheParaApagar("gdrive-thumbnails")).toBe(false);
  });
});
