import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import { supabase } from "@/integrations/supabase/client";
import "./index.css";

// Handle Android back button in native app
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then(({ App: CapApp }) => {
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    });
  }).catch(() => {});
}

const isNativeApp = Capacitor.isNativePlatform();

// One-time hard cache purge per app version (forces stuck notebooks to pick up new bundle)
if (typeof window !== "undefined") {
  void (async () => {
    try {
      const { APP_VERSION } = await import("@/lib/version");
      const key = "app-cache-purge-version";
      const last = localStorage.getItem(key);
      if (last !== APP_VERSION) {
        localStorage.setItem(key, APP_VERSION);
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.allSettled(names.map((n) => caches.delete(n)));
        }
      }
    } catch {}
  })();
}

// Purge stale media caches from older releases (keep app/offline data intact)
if (typeof window !== "undefined" && "caches" in window) {
  void (async () => {
    await Promise.allSettled([
      caches.delete("gdrive-thumbnails"),
      caches.delete("gdrive-proxy-images"),
    ]);

    const storageCache = await caches.open("supabase-storage-cache");
    const requests = await storageCache.keys();
    await Promise.all(
      requests
        .filter((r) => r.url.includes("/videos-treinamento/"))
        .map((r) => storageCache.delete(r))
    );
  })().catch(() => {});
}


let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

if (!isNativeApp) {
  updateSW = registerSW({
    onNeedRefresh() {
      // Fully automatic update: reload immediately without user interaction
      void updateSW?.(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Poll the SW for updates every 20s
      setInterval(() => {
        registration.update().catch(() => {});
      }, 20 * 1000);
    },
    onOfflineReady() {
      console.log("PWA pronto para uso offline");
    },
    immediate: true,
  });

  // Reload the page as soon as a new SW takes control
  if ("serviceWorker" in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  // Check for updates every 30 seconds instead of 60
  window.setInterval(() => {
    void updateSW?.();
  }, 30 * 1000);

  // Also check for updates whenever the app comes back to the foreground
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void updateSW?.();
    }
  });
}

if (isNativeApp) {
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: Style.Light });
      StatusBar.setOverlaysWebView({ overlay: true });
    })
    .catch(() => {});
}

async function bootstrap() {
  try {
    await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
  } catch {}

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
