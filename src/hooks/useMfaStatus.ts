import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MfaStatus {
  loading: boolean;
  required: boolean;
  hasMfa: boolean;
  isAal2: boolean;
  enforced: boolean;
  graceDaysRemaining: number;
  graceUntil: string | null;
}

const DEFAULT: MfaStatus = {
  loading: true,
  required: false,
  hasMfa: false,
  isAal2: false,
  enforced: false,
  graceDaysRemaining: 0,
  graceUntil: null,
};

/**
 * Server-truth MFA status for the current user.
 * - `required` comes from server-side role check (super_admin / principal / admin).
 * - `enforced` becomes true after the grace period expires.
 */
export function useMfaStatus(): MfaStatus {
  const { user, session } = useAuth();
  const [state, setState] = useState<MfaStatus>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    if (!user || !session) {
      setState({ ...DEFAULT, loading: false });
      return;
    }

    (async () => {
      try {
        // Kill-switch do enforcement de MFA.
        //
        // DESLIGADO POR PADRÃO (2026-07-27), a pedido, enquanto o sistema está em
        // implantação. Não é apenas o banner: com enforcement ligado, o MfaGate
        // redireciona TODAS as rotas para /setup-mfa assim que o prazo de carência
        // vence, e o MfaActionButton bloqueia publicar/assinar PGR, LTCAT, PPP e
        // eSocial. Remover só o banner deixaria o bloqueio chegar sem aviso.
        //
        // Para religar: defina VITE_MFA_ENFORCEMENT_ENABLED=true no ambiente, ou
        // troque o padrão abaixo de "false" para "true". Nada mais precisa mudar —
        // toda a infraestrutura de MFA continua no lugar.
        const enforcementFlag = (import.meta.env.VITE_MFA_ENFORCEMENT_ENABLED ?? "false")
          .toString()
          .toLowerCase();
        const enforcementEnabled = enforcementFlag !== "false" && enforcementFlag !== "0";

        const [{ data: rpc }, { data: factors }, { data: aal }] = await Promise.all([
          supabase.rpc("mfa_required_for_current_user"),
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);

        if (cancelled) return;
        const required = enforcementEnabled && !!(rpc as any)?.required;
        const enforced = enforcementEnabled && !!(rpc as any)?.enforced;
        const graceUntil = (rpc as any)?.grace_until ?? null;
        const graceDaysRemaining = (rpc as any)?.grace_days_remaining ?? 0;
        const verifiedTotps = (factors?.totp ?? []).filter((f: any) => f.status === "verified");
        const hasMfa = verifiedTotps.length > 0;
        const isAal2 = (aal as any)?.currentLevel === "aal2";

        setState({
          loading: false,
          required,
          hasMfa,
          isAal2,
          enforced,
          graceDaysRemaining,
          graceUntil,
        });
      } catch {
        if (!cancelled) setState({ ...DEFAULT, loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, session?.access_token]);

  return state;
}
