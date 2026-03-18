import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker — notify user when update is available instead of auto-reloading
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch event so UpdateBanner can show
    window.dispatchEvent(
      new CustomEvent("sw-update-available", {
        detail: (reloadPage?: boolean) => updateSW(reloadPage),
      })
    );
  },
  onOfflineReady() {
    console.log("PWA pronto para uso offline");
  },
  immediate: true,
});

// Check for updates periodically (every 60s)
setInterval(() => {
  updateSW();
}, 60 * 1000);

// Configure Capacitor Status Bar for iOS
import { Capacitor } from "@capacitor/core";
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setOverlaysWebView({ overlay: true });
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
