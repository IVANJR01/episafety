import { useState, useEffect } from "react";
import logoEpiSafety from "@/assets/logo-episafety.png";
import { supabase } from "@/integrations/supabase/client";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import InstallBanner from "@/components/InstallBanner";

type AuthMode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as any;
      promptEvent.prompt();
      promptEvent.userChoice.then(() => {});
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
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
          <img alt="EPISafety" className="mx-auto w-16 h-16 object-contain" src="/lovable-uploads/8df588ff-740d-4376-9653-dc6f07556c80.png" />
          <div>
            <CardTitle className="text-2xl">EPISafety</CardTitle>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ?
              "Aguarde..." :
              mode === "login" ?
              "Entrar" :
              mode === "signup" ?
              "Criar Conta" :
              "Enviar Link de Recuperação"}
            </Button>
          </form>
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

        </CardContent>
      </Card>
      <InstallBanner autoTrigger={true} />
    </div>);

}