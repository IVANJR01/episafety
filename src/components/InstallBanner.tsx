import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "pwa-install-banner-dismissed";

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      // Auto-trigger install prompt immediately
      const promptEvent = e as any;
      promptEvent.prompt();
      promptEvent.userChoice.then((result: any) => {
        if (result.outcome === "accepted") {
          setVisible(false);
        }
      });
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS fallback: show banner with instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    let timeout: ReturnType<typeof setTimeout>;
    if (isIOS) {
      timeout = setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (!visible || isStandalone) return null;

  // Only shows for iOS (Android auto-prompts above)
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
      <div className="max-w-lg mx-auto bg-primary text-primary-foreground rounded-xl shadow-lg p-3 flex items-center gap-3">
        <img
          src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png"
          alt="EPISafety"
          className="w-10 h-10 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instalar EPISafety</p>
          <p className="text-xs opacity-80">Toque em Compartilhar → Adicionar à Tela de Início</p>
        </div>
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
