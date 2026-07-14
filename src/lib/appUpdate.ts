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

const APP_SERVICE_WORKER_PATHS = ["/sw.js", "/service-worker.js"];

function isAppCache(name: string) {
  return APP_CACHE_NAME_PATTERNS.some((pattern) => pattern.test(name));
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

export async function forceAppUpdate() {
  localStorage.setItem(APP_CACHE_PURGE_VERSION_KEY, APP_VERSION);
  sessionStorage.setItem(APP_CACHE_PURGE_RELOAD_KEY, APP_VERSION);
  await purgeAppCaches();
  await unregisterAppServiceWorkers();
  await purgeAppCaches();

  const url = new URL(window.location.href);
  url.searchParams.set("v", APP_VERSION);
  url.searchParams.set("sw", "off");
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
    url.searchParams.set("sw", "off");
    window.location.replace(url.toString());
  }
}