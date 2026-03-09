import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Configure Capacitor Status Bar for iOS
import { Capacitor } from "@capacitor/core";
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setOverlaysWebView({ overlay: true });
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
