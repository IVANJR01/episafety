import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";

/**
 * Hook to check permissions for a specific module.
 * Returns helpers: canView, canCreate, canEdit, canDelete
 */
export function usePermissions(moduleKey: string) {
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();

  if (isSuperAdmin || isPrincipal) {
    return { canView: true, canCreate: true, canEdit: true, canDelete: true };
  }

  return {
    canView: hasPermission(modulosPermitidos, moduleKey, "view"),
    canCreate: hasPermission(modulosPermitidos, moduleKey, "create"),
    canEdit: hasPermission(modulosPermitidos, moduleKey, "edit"),
    canDelete: hasPermission(modulosPermitidos, moduleKey, "delete"),
  };
}
