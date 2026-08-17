import { APP_VERSION } from "@/lib/version";

export const APP_CACHE_PURGE_VERSION_KEY = "app-cache-purge-version";
export const APP_CACHE_PURGE_RELOAD_KEY = "app-cache-purge-reloaded";

const APP_CACHE_NAME_PATTERNS = [
  /workbox/i,
  /precache/i,
  /runtime/i,
  /googleAnalytics/i,
  /vite-pwa/i,
  /app-shell/i,
];

/*
 * Service workers ANTIGOS, que devem mesmo ser desregistrados.
 *
 * `/sw.js` saiu desta lista de propósito: esse endereço agora é o service
 * worker que guarda a cópia offline do aplicativo (src/sw/servicoOffline.js).
 * Enquanto ele estava aqui, o botão "Atualizar" do menu apagava justamente a
 * cópia que permite abrir sem internet — o usuário clicaria em "Atualizar" e,
 * sem perceber, perderia o modo offline até a próxima abertura com sinal.
 *
 * Versão nova não se resolve mais desregistrando: resolve-se mandando o
 * service worker assumir a versão nova, que é o que `pedirTrocaDeVersao` faz.
 */
const APP_SERVICE_WORKER_PATHS = ["/service-worker.js"];

/** O service worker que guarda a cópia offline. Este NÃO se desregistra. */
export const CAMINHO_SW_OFFLINE = "/sw.js";

function isAppCache(name: string) {
  if (ehCacheOffline(name)) return false;
  return APP_CACHE_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * A cópia offline do aplicativo não é lixo de versão antiga: é o que faz o
 * sistema abrir sem internet. Quem apaga cópia velha é o próprio service
 * worker, ao ativar a versão nova.
 */
export function ehCacheOffline(name: string) {
  return name.startsWith("episafety-app-");
}

function getRegistrationScriptUrls(registration: ServiceWorkerRegistration) {
  return [
    registration.active?.scriptURL,
    registration.waiting?.scriptURL,
    registration.installing?.scriptURL,
  ].filter(Boolean) as string[];
}

function isAppServiceWorkerRegistration(registration: ServiceWorkerRegistration) {
  return getRegistrationScriptUrls(registration).some((scriptURL) => {
    try {
      const url = new URL(scriptURL);
      return url.origin === window.location.origin && APP_SERVICE_WORKER_PATHS.includes(url.pathname);
    } catch {
      return APP_SERVICE_WORKER_PATHS.some((path) => scriptURL.includes(path));
    }
  });
}

async function requestImmediateActivation(registration: ServiceWorkerRegistration) {
  await registration.update().catch(() => undefined);

  const workers = [registration.waiting, registration.installing, registration.active].filter(Boolean) as ServiceWorker[];
  workers.forEach((worker) => {
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // Ignore workers that are already gone.
    }
  });
}

export async function purgeAppCaches() {
  if (!("caches" in window)) return [];

  const cacheNames = await caches.keys();
  const appCacheNames = cacheNames.filter(isAppCache);
  await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));

  // Temporary diagnostic required for the stuck desktop bundle issue.
  // eslint-disable-next-line no-console
  console.log("[SW] caches limpos para versão", APP_VERSION, appCacheNames);
  return appCacheNames;
}

export async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return [];

  const registrations = await navigator.serviceWorker.getRegistrations();
  const appRegistrations = registrations.filter(isAppServiceWorkerRegistration);

  await Promise.allSettled(
    appRegistrations.map(async (registration) => {
      await requestImmediateActivation(registration);
      await registration.unregister();
    }),
  );
  return appRegistrations;
}

/**
 * Manda o service worker offline buscar a versão nova e assumi-la na hora.
 *
 * É o substituto de "desregistrar para forçar atualização": desregistrar
 * levaria junto a cópia que permite abrir sem internet.
 */
export async function pedirTrocaDeVersao() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registro = await navigator.serviceWorker.getRegistration(CAMINHO_SW_OFFLINE);
    if (!registro) return;
    await registro.update().catch(() => undefined);
    [registro.waiting, registro.installing].forEach((w) => {
      try { w?.postMessage({ type: "SKIP_WAITING" }); } catch { /* já foi embora */ }
    });
  } catch {
    // Sem service worker o recarregamento abaixo já resolve.
  }
}

export async function forceAppUpdate() {
  localStorage.setItem(APP_CACHE_PURGE_VERSION_KEY, APP_VERSION);
  sessionStorage.setItem(APP_CACHE_PURGE_RELOAD_KEY, APP_VERSION);
  await purgeAppCaches();
  await unregisterAppServiceWorkers();
  await pedirTrocaDeVersao();

  const url = new URL(window.location.href);
  url.searchParams.set("v", APP_VERSION);
  url.searchParams.set("t", Date.now().toString());
  window.location.replace(url.toString());
}

export async function purgeOnVersionChange() {
  const lastPurgedVersion = localStorage.getItem(APP_CACHE_PURGE_VERSION_KEY);

  // Temporary diagnostic required for the stuck desktop bundle issue.
  // eslint-disable-next-line no-console
  console.log("[APP VERSION]", APP_VERSION);

  if (lastPurgedVersion === APP_VERSION) return;

  localStorage.setItem(APP_CACHE_PURGE_VERSION_KEY, APP_VERSION);
  await purgeAppCaches();
  await unregisterAppServiceWorkers();

  if (sessionStorage.getItem(APP_CACHE_PURGE_RELOAD_KEY) !== APP_VERSION) {
    sessionStorage.setItem(APP_CACHE_PURGE_RELOAD_KEY, APP_VERSION);
    const url = new URL(window.location.href);
    url.searchParams.set("v", APP_VERSION);
    // O antigo `sw=off` saiu daqui e do `forceAppUpdate`: era um marcador da
    // época em que o objetivo era desligar o service worker. Ninguém lia esse
    // parâmetro, e hoje ele diria o contrário do que o sistema faz.
    window.location.replace(url.toString());
  }
}