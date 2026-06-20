import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useMfaStatus } from "@/hooks/useMfaStatus";

export default function MfaBanner() {
  const status = useMfaStatus();
  if (status.loading) return null;
  if (!status.required) return null;
  if (status.hasMfa && status.isAal2) return null;
  // hasMfa but not aal2: don't nag (the user has it set up; needs to re-login for aal2)
  if (status.hasMfa) return null;

  const enforced = status.enforced;
  return (
    <div className={`w-full px-4 py-2 text-sm flex items-center gap-2 ${enforced ? "bg-destructive text-destructive-foreground" : "bg-amber-500/15 text-amber-700 border-b border-amber-500/30"}`}>
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        {enforced
          ? "Acesso restrito — configure a autenticação em duas etapas (2FA) para continuar."
          : `Configure a autenticação em duas etapas (2FA). Faltam ${status.graceDaysRemaining} dia(s).`}
      </span>
      <Link to="/setup-mfa" className="underline font-medium">Configurar agora</Link>
    </div>
  );
}
