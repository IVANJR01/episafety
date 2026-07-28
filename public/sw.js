// Temporary app-shell Service Worker kill-switch.
// It clears stale Workbox/app caches, takes control, reloads open pages once,
// then unregisters itself so the browser fetches the newest bundle from network.
function isWorkboxCacheForThisRegistration(name) {
  return /(^|-)precache-v\d+|(^|-)runtime|(^|-)googleAnalytics|workbox|vite-pwa|app-shell/i.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCacheNames = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();

        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => {
            const url = new URL(client.url);
            url.searchParams.set("v", "1.6.1");
            url.searchParams.set("sw", "off");
            url.searchParams.set("t", Date.now().toString());
            return client.navigate(url.toString());
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
