import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import { supabase } from "@/integrations/supabase/client";
import { purgeOnVersionChange } from "@/lib/appUpdate";
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

if (typeof window !== "undefined") {
  void purgeOnVersionChange().catch(() => {});
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


/*
 * Cópia do aplicativo no aparelho, para ele ABRIR sem internet.
 *
 * Sem isto, recarregar sem sinal dava a tela "Sem internet" do navegador —
 * medido. E, como a pessoa não conseguia nem chegar na tela, todo o trabalho
 * offline que já existia no sistema (fila de sincronização, cache de tabelas,
 * aviso de "Modo Offline") ficava inalcançável.
 *
 * No aplicativo nativo os arquivos já vêm dentro do pacote instalado, então lá
 * não é preciso.
 */
if (!isNativeApp && "serviceWorker" in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  // Depois do `load` de propósito: instalar o service worker baixa o pacote
  // inteiro do aplicativo, e fazer isso durante a abertura deixaria a primeira
  // tela mais lenta justamente para quem está com internet ruim.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((erro) => {
      // Falhar aqui não impede o sistema de funcionar com internet.
      console.warn("[offline] não foi possível preparar o modo sem internet:", erro);
    });
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

/*
 * Verificação de versão nova, a cada minuto e ao voltar para o aplicativo.
 *
 * No aplicativo nativo quem atualiza é a loja, então lá isto não roda.
 */
if (typeof window !== "undefined" && !isNativeApp) {
  void import("@/lib/verificarAtualizacao").then(({ iniciarVerificacaoDeVersao }) => {
    iniciarVerificacaoDeVersao({ intervaloMs: 60_000 });
  }).catch(() => {});
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
