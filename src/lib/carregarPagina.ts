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
import { lazy, type ComponentType } from "react";

const MARCA = "episafety:recarregou-por-pagina-nova";

export function ehFalhaDeArquivoDaVersaoAntiga(erro: unknown): boolean {
  const msg = String((erro as Error)?.message ?? erro);
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported|ChunkLoadError|Loading chunk/i.test(msg);
}

export async function importarComRecarga<T>(
  importar: () => Promise<T>,
  ambiente: { sessao: Pick<Storage, "getItem" | "setItem" | "removeItem">; recarregar: () => void } = {
    sessao: sessionStorage,
    recarregar: () => window.location.reload(),
  },
): Promise<T> {
  try {
    const m = await importar();
    try { ambiente.sessao.removeItem(MARCA); } catch { /* sem armazenamento */ }
    return m;
  } catch (erro) {
    let jaRecarregou = false;
    try { jaRecarregou = ambiente.sessao.getItem(MARCA) === "1"; } catch { /* idem */ }
    if (ehFalhaDeArquivoDaVersaoAntiga(erro) && !jaRecarregou) {
      try { ambiente.sessao.setItem(MARCA, "1"); } catch { /* idem */ }
      ambiente.recarregar();
      // A página vai recarregar; não resolve, para não piscar a tela de erro.
      return new Promise<T>(() => {});
    }
    throw erro;
  }
}

export function carregarPagina<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  return lazy(() => importarComRecarga(importar));
}
