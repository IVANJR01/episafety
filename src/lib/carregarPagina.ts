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
import { PaginaComFalha, PaginaSemConexao } from "@/components/CarregamentoDeTela";

const MARCA = "episafety:recarregou-por-pagina-nova";
export const ESPERA_PELA_RECARGA_MS = 8_000;
/** Tela que não chegou neste tempo: em vez de girar para sempre, avisa e oferece tentar de novo. */
export const LIMITE_PARA_CARREGAR_MS = 30_000;

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
    if (r === "demorou") return { default: PaginaComFalha as unknown as T };
    return r;
  } catch (erro) {
    if (!ehFalhaDeArquivoDaVersaoAntiga(erro)) throw erro;
    return { default: (online() ? PaginaComFalha : PaginaSemConexao) as unknown as T };
  } finally {
    clearTimeout(relogio);
  }
}

/** Todas as telas carregadas sob demanda, para o pré-carregamento. */
const carregadores: (() => Promise<unknown>)[] = [];

export function carregarPagina<T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) {
  carregadores.push(importar);
  return lazy(() => carregarComLimite(importar));
}

let preCarregou = false;

/**
 * Depois do login, carrega em segundo plano as telas que vêm à parte, poucas
 * de cada vez e nos intervalos livres do aparelho. Quando a pessoa toca no
 * menu, a tela já está pronta: abre na hora, sem esqueleto nem espera.
 * Não roda em "economia de dados" do celular.
 */
export function preCarregarTelas(lista: (() => Promise<unknown>)[] = carregadores): Promise<void> {
  if (preCarregou) return Promise.resolve();
  preCarregou = true;
  const conexao = (typeof navigator !== "undefined" ? (navigator as any).connection : null) as { saveData?: boolean } | null;
  if (conexao?.saveData) return Promise.resolve();
  const folga = () => new Promise<void>((ok) => {
    const ric = (globalThis as any).requestIdleCallback as undefined | ((f: () => void, o?: object) => void);
    if (ric) ric(() => ok(), { timeout: 300 }); else setTimeout(ok, 50);
  });
  const fila = [...lista];
  // Três de cada vez: rápido o bastante para tudo estar pronto em poucos
  // segundos, sem disputar a internet com os dados da tela aberta.
  const trabalhador = async () => {
    for (let carregar = fila.shift(); carregar; carregar = fila.shift()) {
      await folga();
      try { await carregar(); } catch { /* sem sinal ou versão trocada: a tela carrega quando abrir */ }
    }
  };
  return Promise.all([trabalhador(), trabalhador(), trabalhador()]).then(() => undefined);
}
