import { APP_VERSION } from "@/lib/version";

export const APP_CACHE_PURGE_VERSION_KEY = "app-cache-purge-version";
export const APP_CACHE_PURGE_RELOAD_KEY = "app-cache-purge-reloaded";

const APP_CACHE_NAME_PATTERNS = [
  /workbox/i,
  /precache/i,
  /runtime/i,
  /googleAnalytics/i,
  /supabase-api-cache/i,
  /supabase-storage-cache/i,
  /gdrive-thumbnails/i,
  /gdrive-proxy-images/i,
];

function isAppCache(name: string) {
  return APP_CACHE_NAME_PATTERNS.some((pattern) => pattern.test(name));
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
  const appRegistrations = registrations.filter((registration) => {
    const scriptURL = registration.active?.scriptURL
      || registration.waiting?.scriptURL
      || registration.installing?.scriptURL
      || "";

    return scriptURL.endsWith("/sw.js") || scriptURL.endsWith("/service-worker.js");
  });

  await Promise.allSettled(appRegistrations.map((registration) => registration.unregister()));
  return appRegistrations;
}

export async function forceAppUpdate() {
  await purgeAppCaches();
  await unregisterAppServiceWorkers();

  const url = new URL(window.location.href);
  url.searchParams.set("v", APP_VERSION);
  url.searchParams.set("sw", "off");
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