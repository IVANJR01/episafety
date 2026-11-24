/*
 * Service worker do EPISafety — é o que faz o aplicativo ABRIR sem internet.
 *
 * O que foi medido antes desta correção: com a rede desligada, recarregar o
 * aplicativo dava a tela "Sem internet" do próprio navegador. Nenhum service
 * worker registrado, nenhum arquivo do aplicativo guardado. Ou seja: todo o
 * trabalho offline que já existia no sistema (fila de sincronização, cache de
 * tabelas, aviso de "Modo Offline") era inalcançável, porque a pessoa não
 * conseguia sequer chegar na tela para usar.
 *
 * Já houve service worker aqui antes, e ele foi desligado por um motivo real:
 * guardava o index.html e o entregava velho depois de uma publicação nova. O
 * index.html antigo aponta para /assets/algo-HASH.js que a publicação seguinte
 * já apagou — o pedido volta 404, nada monta e a tela fica branca. Os arquivos
 * public/sw.js e public/service-worker.js são os interruptores que apagaram
 * aquele service worker.
 *
 * Por isso a regra central aqui é: NAVEGAÇÃO SEMPRE TENTA A REDE PRIMEIRO.
 * Com sinal, o index.html vem do servidor e nunca fica velho — o defeito antigo
 * não tem como voltar. O cache do index.html só entra em cena quando a rede
 * falha, que é exatamente a situação em que a alternativa seria não abrir nada.
 *
 * Os arquivos em /assets levam hash no nome, então o conteúdo nunca muda para
 * um mesmo nome: esses podem vir do cache direto, sem perguntar à rede.
 *
 * O que este service worker NÃO faz, de propósito: guardar respostas do
 * Supabase ou de qualquer outro domínio. Essas respostas são filtradas por
 * empresa e por usuário; guardá-las num cache compartilhado do navegador
 * arriscaria entregar dado de uma empresa para outra. Dado de tabela já tem o
 * seu próprio caminho offline, escopado por usuário e empresa, em
 * src/lib/offlineStorage.ts.
 */

/* Preenchidos pelo build (ver vite.config.ts). Os valores padrão deixam o
 * arquivo válido para ser lido pelos testes. */
const ARQUIVOS = self.__ARQUIVOS_PRECACHE__ || [];
const VERSAO = self.__VERSAO_BUILD__ || "desenvolvimento";

const NOME_CACHE = `episafety-app-${VERSAO}`;
const PREFIXO_CACHE = "episafety-app-";

/** Quanto esperar a rede numa navegação antes de servir o que está guardado. */
const LIMITE_REDE_MS = 5000;

/**
 * Decide como atender cada pedido. Função pura, sem tocar em cache nem rede,
 * para poder ser testada — é aqui que mora a regra que evita o defeito antigo.
 *
 * @param {{url: string, method?: string, mode?: string}} pedido
 * @param {string} origem  origem do próprio aplicativo (self.location.origin)
 * @returns {"ignorar"|"rede-apenas"|"rede-primeiro"|"cache-primeiro"}
 */
function estrategiaPara(pedido, origem) {
  const metodo = (pedido.method || "GET").toUpperCase();
  // Gravação nunca passa por cache: entra na fila de sincronização do
  // aplicativo, que sabe reordenar e repetir. Aqui só atrapalharia.
  if (metodo !== "GET") return "ignorar";

  let url;
  try {
    url = new URL(pedido.url, origem);
  } catch {
    return "ignorar";
  }

  // Supabase, Google, qualquer outro domínio: passa direto. Resposta com dado
  // de empresa não pode ficar num cache que não conhece usuário nem empresa.
  if (url.origin !== origem) return "ignorar";

  // O arquivo que diz qual versão está publicada. Guardá-lo seria o mesmo que
  // perguntar ao cache se o cache está velho.
  if (url.pathname === "/version.json") return "rede-apenas";

  // Abrir ou recarregar uma tela. Rede primeiro, cache só se a rede falhar.
  if (pedido.mode === "navigate") return "rede-primeiro";

  // Nome com hash: o conteúdo daquele nome nunca muda. Pode vir do cache.
  if (url.pathname.startsWith("/assets/")) return "cache-primeiro";

  return "rede-primeiro";
}

self.__estrategiaPara = estrategiaPara;

async function guardar(pedido, resposta) {
  // `basic` = mesma origem e resposta completa. Erro e resposta parcial (206)
  // não servem de cópia offline.
  if (!resposta || !resposta.ok || resposta.type === "opaque") return resposta;
  try {
    const cache = await caches.open(NOME_CACHE);
    await cache.put(pedido, resposta.clone());
  } catch {
    /* cota cheia: seguir servindo é melhor do que falhar */
  }
  return resposta;
}

async function redePrimeiro(evento) {
  const pedido = evento.request;
  try {
    const daRede = await Promise.race([
      fetch(pedido),
      new Promise((_, rejeitar) =>
        setTimeout(() => rejeitar(new Error("rede demorou demais")), LIMITE_REDE_MS),
      ),
    ]);
    return await guardar(pedido, daRede);
  } catch (erro) {
    const doCache = await caches.match(pedido, BUSCA);
    if (doCache) return doCache;

    // Navegação sem cópia exata: serve o index.html guardado. É o que permite
    // abrir qualquer rota do aplicativo sem sinal — as rotas são resolvidas
    // pelo próprio aplicativo depois que ele sobe.
    if (pedido.mode === "navigate") {
      const raiz = await caches.match("/index.html", BUSCA) || await caches.match("/", BUSCA);
      if (raiz) return raiz;
    }
    throw erro;
  }
}

/*
 * ignoreVary: o arquivo guardado na instalação foi pedido sem o cabeçalho
 * Origin; a tela pede os pedaços do aplicativo (import dinâmico) COM ele. Se
 * o servidor responder "Vary: Origin", o navegador considera os dois pedidos
 * diferentes e não usa a cópia — a tela abria em branco sem internet. Arquivo
 * com hash no nome tem um conteúdo só, então a cópia serve para qualquer um.
 */
const BUSCA = { ignoreVary: true };

async function cachePrimeiro(evento) {
  const doCache = await caches.match(evento.request, BUSCA);
  if (doCache) return doCache;
  const daRede = await fetch(evento.request);
  return guardar(evento.request, daRede);
}

/**
 * Arquivos da lista que ainda não estão na cópia desta versão.
 *
 * Desde que cada tela virou um arquivo à parte (carregado só quando abre),
 * a tela que nunca foi aberta com internet SÓ existe no aparelho se veio
 * nesta cópia. Antes, um arquivo que falhasse na instalação (sinal fraco)
 * ficava faltando até a próxima publicação — e aquela tela abria em branco
 * sem internet. Por isso: reaproveitar, tentar de novo e completar depois.
 */
async function faltando(cache) {
  const tem = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  return ARQUIVOS.filter((a) => !tem.has(a));
}

/** Põe um arquivo na cópia: primeiro de uma cópia antiga (sem gastar internet), senão da rede, com 3 tentativas. */
async function guardarArquivo(cache, caminho) {
  // Arquivo com hash no nome que não mudou entre versões é idêntico: copia
  // da cópia antiga em vez de baixar de novo.
  if (caminho.startsWith("/assets/")) {
    const antigo = await caches.match(caminho, BUSCA);
    if (antigo) { await cache.put(caminho, antigo); return true; }
  }
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(caminho, { cache: "reload" });
      if (r.ok) { await cache.put(caminho, r); return true; }
    } catch { /* tenta de novo */ }
    await new Promise((ok) => setTimeout(ok, 500 * tentativa));
  }
  return false;
}

/**
 * O essencial primeiro: a página e os arquivos que ela carrega ao abrir
 * (o arquivo principal já traz todas as telas de EPI). Com isso guardado,
 * o trabalho de EPI funciona sem internet mesmo que o resto da cópia não
 * termine — a pessoa não precisa ficar esperando com o sistema aberto.
 */
async function essenciais(cache) {
  // A página guardada é a DESTA versão: buscar de novo poderia trazer a de
  // uma publicação mais nova, que aponta para arquivos que esta cópia não tem.
  if (!(await cache.match("/index.html")) && !(await guardarArquivo(cache, "/index.html"))) return [];
  const html = await (await cache.match("/index.html")).text();
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
}

async function completarCopia() {
  const cache = await caches.open(NOME_CACHE);
  const primeiro = await essenciais(cache).catch(() => []);
  const jaTem = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  await Promise.all(primeiro.filter((a) => !jaTem.has(a)).map((a) => guardarArquivo(cache, a).catch(() => false)));
  const lista = await faltando(cache);
  // De 6 em 6: rápido sem afogar o 4G.
  for (let i = 0; i < lista.length; i += 6) {
    await Promise.all(lista.slice(i, i + 6).map((a) => guardarArquivo(cache, a).catch(() => false)));
  }
  return (await faltando(cache)).length;
}

self.__faltando = faltando;
self.__guardarArquivo = guardarArquivo;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      await completarCopia();
      await self.skipWaiting();
    })(),
  );
});

/**
 * Sobrou do service worker antigo (Workbox/vite-pwa), o que foi desligado por
 * entregar index.html velho. Aparelho que ficou parado meses ainda pode ter
 * essas cópias guardadas, e elas não têm mais dono para limpá-las.
 */
function ehCacheAntigo(nome) {
  return /precache-v\d+|workbox|vite-pwa|app-shell|(^|-)runtime/i.test(nome);
}

function ehCacheParaApagar(nome) {
  if (nome.startsWith(PREFIXO_CACHE)) return nome !== NOME_CACHE;
  return ehCacheAntigo(nome);
}

self.__ehCacheParaApagar = ehCacheParaApagar;

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      // Some com as cópias das versões anteriores. Sem isto o aparelho vai
      // acumulando um pacote inteiro do aplicativo por publicação.
      await Promise.allSettled(nomes.filter(ehCacheParaApagar).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.type === "SKIP_WAITING") self.skipWaiting();
  // O aplicativo pede isto ao abrir com internet e ao voltar o sinal: baixa
  // o que tiver ficado faltando na instalação.
  if (evento.data && evento.data.type === "COMPLETAR_COPIA") {
    evento.waitUntil(completarCopia().then((resta) => {
      if (evento.source) evento.source.postMessage({ type: "COPIA_OFFLINE", faltando: resta, total: ARQUIVOS.length });
    }));
  }
});

self.addEventListener("fetch", (evento) => {
  const estrategia = estrategiaPara(evento.request, self.location.origin);
  if (estrategia === "ignorar" || estrategia === "rede-apenas") return;
  if (estrategia === "cache-primeiro") {
    evento.respondWith(cachePrimeiro(evento));
    return;
  }
  evento.respondWith(redePrimeiro(evento));
});
