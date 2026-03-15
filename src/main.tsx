import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker with auto-update — reloads immediately when new version is available
const updateSW = registerSW({
  onNeedRefresh() {
    // Automatically reload when a new version is detected
    updateSW(true);
  },
  onOfflineReady() {
    console.log("PWA pronto para uso offline");
  },
  // Check for updates every 60 seconds
  immediate: true,
});

// Also check for updates periodically (every 60s) so installed app stays fresh
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
