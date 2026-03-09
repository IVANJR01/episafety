import { Smartphone, Apple, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Install() {
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
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Como instalar
            </h3>
            
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  🍎 iPhone / iPad
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra este site no Safari</li>
                  <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta)</li>
                  <li>Selecione <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Toque em <strong>"Adicionar"</strong></li>
                </ol>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  🤖 Android
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra este site no Chrome</li>
                  <li>Toque nos <strong>3 pontinhos</strong> (menu)</li>
                  <li>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
                  <li>Confirme a instalação</li>
                </ol>
              </div>
            </div>
          </div>

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
