import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { pedirInstalacao } from "@/lib/instalarPwa";

const DISMISSED_KEY = "pwa-install-banner-dismissed";

/*
 * A prop `autoTrigger` saiu junto com a chamada automática: ela existia só
 * para ligar aquele comportamento, que o navegador nunca permitiu. Quem
 * passava `autoTrigger` (a tela de login) agora recebe o mesmo convite das
 * outras telas.
 */
export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
      /*
       * Aqui NÃO se chama prompt().
       *
       * Este evento dispara ao carregar a página, sem gesto do usuário, e o
       * navegador recusa a instalação nessa situação por regra — não é
       * contornável. A chamada automática que existia aqui (autoTrigger)
       * quebrava em toda abertura da tela de login e, sem tratamento, a recusa
       * aparecia como erro de sistema em cima do formulário.
       *
       * O que dá para fazer é mostrar o convite. Instalar continua a um
       * clique de distância — a diferença é que agora o clique existe.
       */
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS fallback: show banner with instructions (Safari doesn't fire beforeinstallprompt)
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

  const handleInstallClick = async () => {
    if (!installEvent) return;
    const resultado = await pedirInstalacao(installEvent);
    // O evento vale por uma chamada só: a segunda é recusada do mesmo jeito.
    setInstallEvent(null);
    if (resultado === "aceito") setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
      <div className="max-w-lg mx-auto bg-primary text-primary-foreground rounded-xl shadow-lg p-3 flex items-center gap-3">
        <img
          src="/marca/8df588ff-740d-4376-9653-dc6f07556c80.png"
          alt="SafetySoluções"
          className="w-10 h-10 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={installEvent ? handleInstallClick : undefined}>
          <p className="text-sm font-semibold">Instalar SafetySoluções</p>
          <p className="text-xs opacity-80">
            {isIOS
              ? "Toque em Compartilhar → Adicionar à Tela de Início"
              : installEvent
                ? "Toque aqui para instalar o app"
                : "Acesse pelo navegador Chrome para instalar"}
          </p>
        </div>
        {installEvent && (
          <button
            onClick={handleInstallClick}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors text-xs font-semibold"
          >
            Instalar
          </button>
        )}
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
