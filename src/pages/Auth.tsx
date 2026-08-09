import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import logoEpiSafety from "@/assets/logo-episafety.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import InstallBanner from "@/components/InstallBanner";

/*
 * Não existe autocadastro.
 *
 * Quem libera acesso é o administrador da empresa, ou alguém autorizado
 * por ele, pela tela de Usuários Liberados. Por isso o modo "signup" saiu
 * inteiro — e não só o link: deixar `supabase.auth.signUp` no código, sem
 * botão que chegue nele, seria uma porta fechada só por fora.
 *
 * Sobraram entrar e recuperar senha.
 */
type AuthMode = "login" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallButton(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) {
      setShowInstallButton(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      const promptEvent = installPrompt as any;
      promptEvent.prompt();
      promptEvent.userChoice.then((result: any) => {
        if (result.outcome === "accepted") {
          setShowInstallButton(false);
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir a senha."
        });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

    } catch (error: any) {
      const rawMessage = error instanceof Error ? error.message : String(error ?? "");
      const description = /failed to fetch|networkerror|load failed/i.test(rawMessage)
        ? "Não foi possível conectar ao Supabase. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente Preview da Vercel."
        : rawMessage || "Não foi possível concluir a autenticação.";
      console.error("[AUTH_LOGIN_ERROR]", { name: error?.name, message: rawMessage });
      toast({ title: "Erro de conexão", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img alt="SafetySoluções" className="mx-auto w-32 h-32 object-contain" src="/marca/8df588ff-740d-4376-9653-dc6f07556c80.png" />
          <div>
            <CardTitle className="text-2xl">SafetySoluções</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Segurança do Trabalho</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            {mode !== "forgot" &&
            <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            }
            {mode === "login" &&
            <div className="flex justify-end">
                <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-primary hover:underline">
                
                  Esqueci minha senha
                </button>
              </div>
            }
            {/* O aceite dos termos é pedido no primeiro acesso pelo
                TermsAcceptanceBanner, dentro do aplicativo. */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar Link de Recuperação"}
            </Button>

          </form>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (installPrompt) {
                handleInstallClick();
              } else {
                window.location.href = "/install";
              }
            }}
            className="w-full mt-4 gap-2"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </Button>
          <div className="mt-4 text-center">
            {mode === "forgot" ? (
              <button type="button" onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
                Voltar ao login
              </button>
            ) : (
              /* No lugar do "Cadastre-se": quem chega aqui sem conta precisa
                 saber a quem pedir, senão fica sem link e sem saída. */
              <p className="text-xs text-muted-foreground">
                O acesso é liberado pelo administrador da empresa.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-primary hover:underline">Termos de Uso</Link>
            <span>·</span>
            <Link to="/privacidade" className="hover:text-primary hover:underline">Política de Privacidade</Link>
          </div>

        </CardContent>
      </Card>

      <InstallBanner autoTrigger={true} />
    </div>);

}
