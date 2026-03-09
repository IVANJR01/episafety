import { useState, useEffect } from "react";
import { Smartphone, Download, Share, MoreVertical, PlusSquare, ArrowLeft, CheckCircle2, Chrome, Globe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "iphone">("android");

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) setActiveTab("iphone");

    // Se após 1s não tiver o prompt, mostra instruções manuais
    const timeout = setTimeout(() => {
      setShowManual(true);
    }, 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  // Auto-trigger install prompt as soon as available
  useEffect(() => {
    if (deferredPrompt && !installed) {
      handleInstall();
    }
  }, [deferredPrompt]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <a href="/login" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <span className="font-semibold text-sm">Instalar EPISafety</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* App info card */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <img
              alt="EPISafety"
              className="w-20 h-20 rounded-2xl object-contain shadow-lg border border-border"
              src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold">EPISafety</h1>
            <p className="text-sm text-muted-foreground mt-1">Segurança do Trabalho</p>
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

        {/* Success state */}
        {installed ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-lg font-bold">Instalado com sucesso!</h2>
              <p className="text-sm text-muted-foreground">
                Procure o ícone <strong>EPISafety</strong> na sua tela inicial.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          /* Direct install button */
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-bold">Toque para instalar!</h2>
              </div>
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="w-5 h-5 mr-2" />
                Instalar EPISafety
              </Button>
            </CardContent>
          </Card>
        ) : !showManual ? (
          /* Loading / waiting for prompt */
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Preparando instalação...</p>
            </CardContent>
          </Card>
        ) : (
          /* Manual install instructions (fallback for iOS / unsupported browsers) */
          <>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Seu navegador não suporta instalação automática. Siga as instruções abaixo:
                </p>
              </CardContent>
            </Card>

            {/* Tab selector */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab("android")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "android"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🤖 Android
              </button>
              <button
                onClick={() => setActiveTab("iphone")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "iphone"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🍎 iPhone / iPad
              </button>
            </div>

            {activeTab === "android" ? (
              <div className="space-y-3">
                {/* Step 1 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        1
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Abra no Chrome</p>
                        <p className="text-xs text-muted-foreground">
                          Acesse <strong className="text-foreground">episafety.lovable.app</strong> usando o navegador <strong className="text-foreground">Google Chrome</strong>.
                        </p>
                        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs">
                          <Chrome className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-muted-foreground">Importante: use o Chrome, não outro navegador</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        2
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Toque no menu</p>
                        <p className="text-xs text-muted-foreground">
                          Toque nos <strong className="text-foreground">3 pontinhos</strong> no canto superior direito do Chrome.
                        </p>
                        <div className="flex items-center justify-center bg-muted rounded-lg py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <MoreVertical className="w-6 h-6 text-foreground" />
                            <span className="text-[10px] text-muted-foreground">Menu</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 3 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        3
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Instalar aplicativo</p>
                        <p className="text-xs text-muted-foreground">
                          Selecione a opção <strong className="text-foreground">"Instalar aplicativo"</strong> ou <strong className="text-foreground">"Adicionar à tela inicial"</strong>.
                        </p>
                        <div className="bg-muted rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 text-sm">
                            <Download className="w-4 h-4 text-muted-foreground" />
                            <span>Instalar aplicativo</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 4 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        ✓
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold text-sm">Pronto!</p>
                        <p className="text-xs text-muted-foreground">
                          Confirme a instalação e o app aparecerá na sua tela inicial. <strong className="text-foreground">Não precisa baixar pela Play Store</strong>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Step 1 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        1
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Abra no Safari</p>
                        <p className="text-xs text-muted-foreground">
                          Acesse <strong className="text-foreground">episafety.lovable.app</strong> usando o navegador <strong className="text-foreground">Safari</strong>.
                        </p>
                        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs">
                          <Globe className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-muted-foreground">Importante: use o Safari, não Chrome</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        2
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Toque em Compartilhar</p>
                        <p className="text-xs text-muted-foreground">
                          Toque no ícone de <strong className="text-foreground">compartilhar</strong> na barra inferior do Safari (quadrado com seta para cima).
                        </p>
                        <div className="flex items-center justify-center bg-muted rounded-lg py-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <Share className="w-6 h-6 text-primary" />
                            <span className="text-[10px] text-muted-foreground">Compartilhar</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 3 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        3
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm">Adicionar à Tela de Início</p>
                        <p className="text-xs text-muted-foreground">
                          Role para baixo e toque em <strong className="text-foreground">"Adicionar à Tela de Início"</strong>.
                        </p>
                        <div className="bg-muted rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 text-sm">
                            <PlusSquare className="w-4 h-4 text-muted-foreground" />
                            <span>Adicionar à Tela de Início</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 4 */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        ✓
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold text-sm">Pronto!</p>
                        <p className="text-xs text-muted-foreground">
                          Toque em <strong className="text-foreground">"Adicionar"</strong> e o app aparecerá na sua tela inicial como um app nativo.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Info box */}
        <div className="bg-muted/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground">💡 Por que instalar como PWA?</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Funciona <strong className="text-foreground">sem internet</strong> após a primeira vez</li>
            <li>• Abre em <strong className="text-foreground">tela cheia</strong>, como um app nativo</li>
            <li>• <strong className="text-foreground">Sem downloads pesados</strong> nem permissões invasivas</li>
            <li>• Sempre <strong className="text-foreground">atualizado automaticamente</strong></li>
          </ul>
        </div>

        {/* Back link */}
        <div className="text-center pb-4">
          <a href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </a>
        </div>
      </div>
    </div>
  );
}
