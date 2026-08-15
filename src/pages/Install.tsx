import { useState, useEffect } from "react";
import { Smartphone, Download, Share, ArrowLeft, CheckCircle2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pedirInstalacao } from "@/lib/instalarPwa";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [promptReady, setPromptReady] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPromptReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  /*
   * A chamada automática saiu daqui também.
   *
   * Era um efeito disparando prompt() assim que o evento chegava — sem gesto
   * do usuário, portanto recusado pelo navegador, e com a rejeição sem
   * tratamento. O botão abaixo faz a mesma coisa, na hora certa.
   */
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    const resultado = await pedirInstalacao(deferredPrompt);
    // O evento serve para uma chamada só.
    setDeferredPrompt(null);
    if (resultado === "aceito") setInstalled(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <a href="/login" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <span className="font-semibold text-sm">Instalar SafetySoluções</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-sm w-full space-y-6">
          {/* App icon + name */}
          <div className="text-center space-y-3">
            <img
              alt="SafetySoluções"
              className="w-20 h-20 rounded-2xl object-contain shadow-lg border border-border mx-auto"
              src="/marca/8df588ff-740d-4376-9653-dc6f07556c80.png"
            />
            <div>
              <h1 className="text-xl font-bold">SafetySoluções</h1>
              <p className="text-sm text-muted-foreground">Segurança do Trabalho</p>
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Funciona offline</span>
              </div>
              <span className="text-border">•</span>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Sem loja de apps</span>
              </div>
            </div>
          </div>

          {/* States */}
          {installed ? (
            <Card>
              <CardContent className="py-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-lg font-bold">Instalado com sucesso!</h2>
                <p className="text-sm text-muted-foreground">
                  Procure o ícone <strong>SafetySoluções</strong> na sua tela inicial.
                </p>
              </CardContent>
            </Card>
          ) : isIOS ? (
            /* iOS: single compact instruction */
            <Card>
              <CardContent className="py-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Share className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="font-bold text-base">Instale em 2 toques</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No <strong className="text-foreground">Safari</strong>, toque em{" "}
                    <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-medium text-foreground">
                      <Share className="w-3 h-3" /> Compartilhar
                    </span>{" "}
                    e depois em{" "}
                    <strong className="text-foreground">"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Android/Desktop: one-click install */
            <Card>
              <CardContent className="py-6 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Download className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="font-bold text-base">
                    {promptReady ? "Pronto para instalar!" : "Preparando instalação..."}
                  </h2>
                </div>
                <Button
                  onClick={handleInstall}
                  className="w-full text-base"
                  size="lg"
                  disabled={!deferredPrompt}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Instalar SafetySoluções
                </Button>
                {!promptReady && (
                  <p className="text-xs text-muted-foreground text-center">
                    Se o prompt não aparecer, abra este link no <strong>Google Chrome</strong>.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Back */}
          <div className="text-center">
            <a href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
