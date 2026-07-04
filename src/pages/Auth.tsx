import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import logoEpiSafety from "@/assets/logo-episafety.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import InstallBanner from "@/components/InstallBanner";
import { TERMS_VERSION } from "@/lib/termsConfig";

type AuthMode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!acceptedTerms) {
          throw new Error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        // Registra aceite dos termos (best-effort — não bloqueia se houver sessão pendente de confirmação)
        try {
          const userId = data.user?.id;
          if (userId) {
            await supabase.from("termos_aceites" as any).insert({
              user_id: userId,
              versao_termos: TERMS_VERSION,
              user_agent: navigator.userAgent.slice(0, 500),
            });
          }
        } catch {
          /* silencioso — banner de aceite cobrirá o registro no primeiro login */
        }
        toast({ title: "Conta criada!", description: "Verifique seu email para confirmar o cadastro." });
      }

    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img alt="SafetySoluções" className="mx-auto w-32 h-32 object-contain" src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png" />
          <div>
            <CardTitle className="text-2xl">SafetySoluções</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Segurança do Trabalho</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" &&
            <div>
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" required />
              </div>
            }
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
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(Boolean(v))}
                  className="mt-0.5"
                />
                <span>
                  Li e aceito os{" "}
                  <Link to="/termos" target="_blank" className="text-primary hover:underline">
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                    Política de Privacidade
                  </Link>
                  .
                </span>
              </label>
            )}
            <Button type="submit" className="w-full" disabled={loading || (mode === "signup" && !acceptedTerms)}>
              {loading ?
              "Aguarde..." :
              mode === "login" ?
              "Entrar" :
              mode === "signup" ?
              "Criar Conta" :
              "Enviar Link de Recuperação"}
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
            {mode === "forgot" ?
            <button type="button" onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
                Voltar ao login
              </button> :

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-primary hover:underline">
              
                {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
              </button>
            }
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