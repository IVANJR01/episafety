import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X } from "lucide-react";
const logoEpiSafety = "/marca/8df588ff-740d-4376-9653-dc6f07556c80.png";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY")) {
        setIsRecovery(true);
      }
      setChecking(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        if (params.get('type') === 'recovery' || hash.includes('type=recovery')) {
          setIsRecovery(true);
        }
        setIsRecovery(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordRules = useMemo(() => [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Letra maiúscula", valid: /[A-Z]/.test(password) },
    { label: "Letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Número", valid: /[0-9]/.test(password) },
    { label: "Caractere especial (!@#$%...)", valid: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  const allRulesValid = passwordRules.every(r => r.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesValid) {
      toast({ title: "A senha não atende todos os requisitos", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check if we have a valid session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ 
          title: "Sessão expirada", 
          description: "Solicite um novo link de recuperação na tela de login.", 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tempo limite excedido. Tente novamente.")), 15000)
      );
      
      const updatePromise = supabase.auth.updateUser({ password });
      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;
      
      if (error) throw error;
      toast({ title: "Senha atualizada com sucesso!" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Verificando link de recuperação...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Link de recuperação inválido ou expirado.</p>
            <p className="text-sm text-muted-foreground">Use o botão "Esqueci minha senha" na tela de login para solicitar um novo link.</p>
            <Button onClick={() => navigate("/")} variant="outline">Voltar ao login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src="https://api.freelovable.com.br/storage/v1/object/public/anexos/a1a944b5-c12a-4422-a110-75aeac37d6ee.png" alt="SafetySoluções" className="mx-auto w-16 h-16 object-contain" />
          <div>
            <CardTitle className="text-2xl">Nova Senha</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Digite sua nova senha</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nova Senha</Label>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className="flex items-center gap-2 text-xs">
                      {rule.valid ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className={rule.valid ? "text-green-600" : "text-muted-foreground"}>
                        {rule.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label>Confirmar Senha</Label>
              <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> As senhas não coincidem
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !allRulesValid || password !== confirmPassword}>
              {loading ? "Atualizando..." : "Atualizar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
