/**
 * Carrega uma página só quando ela é aberta.
 *
 * Antes as 84 páginas entravam todas num arquivo só, de 6 MB: até a tela de
 * login fazia o celular baixar e processar o sistema inteiro — PGR, LTCAT,
 * geradores de PDF, Word e Excel. Agora cada página é um arquivo à parte.
 *
 * O cuidado é a publicação nova. Quem está com o sistema aberto tem a lista
 * de arquivos da versão anterior; depois de publicar, esses arquivos podem
 * não existir mais e abrir uma página daria erro. Nesse caso a página é
 * recarregada uma vez, pegando a versão nova. A marca na sessão impede que
 * um erro de verdade (sem internet, por exemplo) vire recarga sem fim.
 */
import { createElement, lazy, type ComponentType } from "react";

const MARCA = "episafety:recarregou-por-pagina-nova";

export function ehFalhaDeArquivoDaVersaoAntiga(erro: unknown): boolean {
  const msg = String((erro as Error)?.message ?? erro);
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported|ChunkLoadError|Loading chunk/i.test(msg);
}

export async function importarComRecarga<T>(
  importar: () => Promise<T>,
  ambiente: {
    sessao: Pick<Storage, "getItem" | "setItem" | "removeItem">;
    recarregar: () => void;
    /** Sem internet, recarregar não traz arquivo novo: só pisca a tela. */
    online?: () => boolean;
  } = {
    sessao: sessionStorage,
    recarregar: () => window.location.reload(),
    online: () => navigator.onLine,
  },
): Promise<T> {
  try {
    const m = await importar();
    try { ambiente.sessao.removeItem(MARCA); } catch { /* sem armazenamento */ }
    return m;
  } catch (erro) {
    let jaRecarregou = false;
    try { jaRecarregou = ambiente.sessao.getItem(MARCA) === "1"; } catch { /* idem */ }
    const online = ambiente.online ? ambiente.online() : true;
    if (ehFalhaDeArquivoDaVersaoAntiga(erro) && !jaRecarregou && online) {
      try { ambiente.sessao.setItem(MARCA, "1"); } catch { /* idem */ }
      ambiente.recarregar();
      // A página vai recarregar; não resolve, para não piscar a tela de erro.
      return new Promise<T>(() => {});
    }
    throw erro;
  }
}

/**
 * Sem internet e com o arquivo da tela faltando no aparelho: em vez de tela
 * em branco (ou "erro inesperado"), diz o que aconteceu e o que fazer.
 */
function TelaNaoGuardada() {
  return createElement("div", { className: "mx-auto max-w-xl rounded-xl border bg-muted/40 p-6 text-sm", role: "alert" },
    createElement("h2", { className: "mb-2 text-lg font-bold text-foreground" }, "Esta tela ainda não está guardada neste aparelho"),
    createElement("p", { className: "text-muted-foreground" },
      "Para usar sem internet, o aparelho precisa ter baixado esta tela antes. Quando tiver sinal, abra o sistema e espere cerca de 1 minuto: ele guarda todas as telas sozinho. As outras telas que já estão guardadas continuam funcionando."),
  );
}

export function carregarPagina<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  return lazy(() => importarComRecarga(importar).catch((erro) => {
    if (ehFalhaDeArquivoDaVersaoAntiga(erro) && typeof navigator !== "undefined" && !navigator.onLine) {
      return { default: TelaNaoGuardada as unknown as T };
    }
    throw erro;
  }));
}
