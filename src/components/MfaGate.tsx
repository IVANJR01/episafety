import { Navigate, useLocation } from "react-router-dom";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import type { ReactNode } from "react";

/**
 * Hard-block gate. When MFA is required AND the grace period has expired
 * AND the user has no verified TOTP factor, every protected route is
 * redirected to /setup-mfa until the user enrolls.
 */
export default function MfaGate({ children }: { children: ReactNode }) {
  const status = useMfaStatus();
  const location = useLocation();

  if (status.loading) return <>{children}</>;
  if (!status.required) return <>{children}</>;
  if (status.hasMfa) return <>{children}</>;
  if (!status.enforced) return <>{children}</>;
  if (location.pathname.startsWith("/setup-mfa")) return <>{children}</>;

  return <Navigate to="/setup-mfa" replace />;
}
