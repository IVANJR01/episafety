import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

const isNativeApp = Capacitor.isNativePlatform();

if (typeof window !== "undefined" && "caches" in window) {
  void caches
    .open("supabase-storage-cache")
    .then(async (cache) => {
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((request) => request.url.includes("/videos-treinamento/"))
          .map((request) => cache.delete(request))
      );
    })
    .catch(() => {});
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

if (!isNativeApp) {
  updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(
        new CustomEvent("sw-update-available", {
          detail: (reloadPage?: boolean) => updateSW?.(reloadPage),
        })
      );
    },
    onOfflineReady() {
      console.log("PWA pronto para uso offline");
    },
    immediate: true,
  });

  window.setInterval(() => {
    void updateSW?.();
  }, 60 * 1000);
}

if (isNativeApp) {
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: Style.Light });
      StatusBar.setOverlaysWebView({ overlay: true });
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
