import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "pwa-install-banner-dismissed";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Don't show if user already dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS fallback: show banner after 2s
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    let timeout: ReturnType<typeof setTimeout>;
    if (isIOS) {
      timeout = setTimeout(() => setVisible(true), 2000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
    } else {
      // iOS: redirect to install page
      window.location.href = "/install";
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (!visible || isStandalone) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
      <div className="max-w-lg mx-auto bg-primary text-primary-foreground rounded-xl shadow-lg p-3 flex items-center gap-3">
        <img
          src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png"
          alt="EPISafety"
          className="w-10 h-10 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Instalar EPISafety</p>
          <p className="text-xs opacity-80">Acesse rápido pela tela inicial</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-primary-foreground text-primary text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-primary-foreground/20 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
