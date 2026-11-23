import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, podeAcaoFina } from "@/lib/permissions";

/**
 * Hook to check permissions for a specific module.
 * Returns helpers: canView, canCreate, canEdit, canDelete
 */
export function usePermissions(moduleKey: string) {
  const { modulosPermitidos, isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true, pode: (_acao: string) => true };
  }

  return {
    canView: hasPermission(modulosPermitidos, moduleKey, "view"),
    canCreate: hasPermission(modulosPermitidos, moduleKey, "create"),
    canEdit: hasPermission(modulosPermitidos, moduleKey, "edit"),
    canDelete: hasPermission(modulosPermitidos, moduleKey, "delete"),
    /** Ação fina do módulo (ver ACOES_FINAS): liberada salvo bloqueio. */
    pode: (acao: string) => podeAcaoFina(modulosPermitidos, moduleKey, acao),
  };
}
