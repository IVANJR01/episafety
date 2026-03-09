import { useState, useEffect } from "react";
import { Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img alt="EPISafety" className="mx-auto w-16 h-16 object-contain" src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png" />
          <div>
            <CardTitle className="text-2xl">Baixar EPISafety</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Instale o app no seu celular</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {installed ? (
            <div className="text-center py-4 space-y-2">
              <div className="text-4xl">✅</div>
              <p className="font-medium">App instalado com sucesso!</p>
              <p className="text-sm text-muted-foreground">Procure o ícone EPISafety na sua tela inicial.</p>
            </div>
          ) : deferredPrompt ? (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Instalar EPISafety
            </Button>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Como instalar
              </h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="font-medium text-sm">🍎 iPhone / iPad</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Abra este site no <strong>Safari</strong></li>
                    <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
                    <li>Selecione <strong>"Adicionar à Tela de Início"</strong></li>
                    <li>Toque em <strong>"Adicionar"</strong></li>
                  </ol>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="font-medium text-sm">🤖 Android</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Abra este site no <strong>Chrome</strong></li>
                    <li>Toque nos <strong>3 pontinhos</strong> (menu)</li>
                    <li>Selecione <strong>"Instalar aplicativo"</strong></li>
                    <li>Confirme a instalação</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <a href="/login" className="text-sm text-primary hover:underline">
              ← Voltar ao login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
