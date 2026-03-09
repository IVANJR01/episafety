import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, type Acao } from "@/lib/permissions";

/**
 * Hook to check permissions for a specific module.
 * Returns helpers: canView, canEdit, canDelete
 */
export function usePermissions(moduleKey: string) {
  const { modulosPermitidos, isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return { canView: true, canEdit: true, canDelete: true };
  }

  return {
    canView: hasPermission(modulosPermitidos, moduleKey, "view"),
    canEdit: hasPermission(modulosPermitidos, moduleKey, "edit"),
    canDelete: hasPermission(modulosPermitidos, moduleKey, "delete"),
  };
}
