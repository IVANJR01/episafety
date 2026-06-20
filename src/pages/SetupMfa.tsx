import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import { ShieldCheck } from "lucide-react";

export default function SetupMfa() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const status = useMfaStatus();
  const [enrolling, setEnrolling] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!status.loading && status.hasMfa && status.isAal2) {
      // Already configured & current session is AAL2 — nothing else to do.
    }
  }, [status]);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      // Remove any unverified factor first
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of [...(existing?.totp ?? []), ...(existing?.all ?? [])]) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `SafetySolucoes-${Date.now()}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e: any) {
      toast({ title: "Erro ao iniciar 2FA", description: e.message, variant: "destructive" });
    } finally {
      setEnrolling(false);
    }
  };

  const verifyCode = async () => {
    if (!factorId || !code) return;
    setVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      toast({ title: "2FA ativado com sucesso!" });
      setTimeout(() => navigate("/"), 800);
    } catch (e: any) {
      toast({ title: "Código inválido", description: e.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <CardTitle>Autenticação em duas etapas (2FA)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Como administrador, você precisa configurar o 2FA para proteger o acesso da empresa.
            {status.required && !status.enforced && (
              <span className="block mt-2 text-amber-600 font-medium">
                Prazo restante: {status.graceDaysRemaining} dia(s)
              </span>
            )}
            {status.enforced && (
              <span className="block mt-2 text-destructive font-medium">
                Prazo expirado — configure agora para continuar usando rotas sensíveis.
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrSvg ? (
            <>
              <p className="text-sm text-muted-foreground">
                Use um app autenticador (Google Authenticator, Authy, 1Password, Microsoft Authenticator).
              </p>
              <Button className="w-full" onClick={startEnroll} disabled={enrolling}>
                {enrolling ? "Gerando QR Code..." : "Configurar 2FA agora"}
              </Button>
              {status.hasMfa && (
                <p className="text-xs text-center text-muted-foreground">
                  Você já tem 2FA. Para sair do login atual e voltar com 2FA, faça logout e login novamente.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
              {secret && (
                <div className="text-xs text-center text-muted-foreground break-all">
                  Ou digite a chave manualmente: <code className="bg-muted px-2 py-1 rounded">{secret}</code>
                </div>
              )}
              <div>
                <Label>Código de 6 dígitos</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                />
              </div>
              <Button className="w-full" onClick={verifyCode} disabled={verifying || code.length !== 6}>
                {verifying ? "Verificando..." : "Confirmar e ativar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
