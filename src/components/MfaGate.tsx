import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

/**
 * Hard-block gate. When MFA is required AND the grace period has expired
 * AND the user has no verified TOTP factor, every protected route is
 * replaced by an enforcement screen. Only /setup-mfa stays reachable.
 */
export default function MfaGate({ children }: { children: ReactNode }) {
  const status = useMfaStatus();
  const { signOut } = useAuth();
  const location = useLocation();

  if (status.loading) return <>{children}</>;
  if (!status.required) return <>{children}</>;
  if (status.hasMfa) return <>{children}</>;
  if (!status.enforced) return <>{children}</>;

  // Allow the setup page itself to render so the user can fix it.
  if (location.pathname.startsWith("/setup-mfa")) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-destructive/30 rounded-lg p-6 text-center space-y-4 shadow-lg">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">Autenticação em duas etapas obrigatória</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil exige 2FA/TOTP e o período de carência de 7 dias expirou.
          Configure agora para continuar usando o sistema.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Navigate to="/setup-mfa" replace />
          <button
            onClick={signOut}
            className="w-full px-4 py-2 rounded-md border border-input text-sm hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
