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
export const ESPERA_PELA_RECARGA_MS = 8_000;
/** Tela que não chegou neste tempo: em vez de girar para sempre, avisa e oferece tentar de novo. */
export const LIMITE_PARA_CARREGAR_MS = 20_000;

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
      // A página vai recarregar. Mas se em 8 s não recarregou (aconteceu no
      // iPhone com o app na tela inicial), desiste com erro — esperar para
      // sempre deixava o círculo girando sem fim no lugar da tela.
      return new Promise<T>((_, rejeitar) =>
        setTimeout(() => rejeitar(erro), ESPERA_PELA_RECARGA_MS));
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

/** A tela não chegou: diz isso e deixa tentar de novo, em vez do círculo girando. */
function TelaDemorou() {
  return createElement("div", { className: "mx-auto max-w-xl rounded-xl border bg-muted/40 p-6 text-sm", role: "alert" },
    createElement("h2", { className: "mb-2 text-lg font-bold text-foreground" }, "Esta tela está demorando para carregar"),
    createElement("p", { className: "mb-4 text-muted-foreground" },
      "A internet pode estar fraca. Entregas, EPIs e Funcionários continuam funcionando — use o menu de baixo."),
    createElement("button", {
      type: "button",
      onClick: () => window.location.reload(),
      className: "rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground",
    }, "Tentar de novo"),
  );
}

/**
 * O que mostrar quando o arquivo da tela não vem. Separado para ser testado:
 * sem internet → "ainda não está guardada"; demorou ou falhou → "tentar de
 * novo". Erro que não é de arquivo (defeito da tela) continua subindo.
 */
export async function carregarComLimite<T>(
  importar: () => Promise<{ default: T }>,
  opcoes: { limiteMs?: number; online?: () => boolean } = {},
): Promise<{ default: T }> {
  const limite = opcoes.limiteMs ?? LIMITE_PARA_CARREGAR_MS;
  const online = opcoes.online ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const demorou = new Promise<"demorou">((ok) => { relogio = setTimeout(() => ok("demorou"), limite); });
  try {
    const r = await Promise.race([importarComRecarga(importar), demorou]);
    if (r === "demorou") return { default: TelaDemorou as unknown as T };
    return r;
  } catch (erro) {
    if (!ehFalhaDeArquivoDaVersaoAntiga(erro)) throw erro;
    return { default: (online() ? TelaDemorou : TelaNaoGuardada) as unknown as T };
  } finally {
    clearTimeout(relogio);
  }
}

export function carregarPagina<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  return lazy(() => carregarComLimite(importar));
}
