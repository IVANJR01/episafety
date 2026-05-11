import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sincroniza o escopo da empresa ativa com a query string (?empresa_id=...).
 *
 * - Lê empresa_id da URL e propaga para o contexto (setActiveEmpresaId)
 * - Quando o empresaId do contexto muda (ex.: trocou pelo seletor do header),
 *   reflete na URL para que links/refresh preservem o escopo.
 * - Invalida o cache do TanStack Query quando o escopo muda.
 */
export default function EmpresaQuerySync() {
  const [params, setParams] = useSearchParams();
  const { empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId } = useAuth();
  const queryClient = useQueryClient();
  const lastApplied = useRef<string | null>(null);

  // URL -> contexto
  useEffect(() => {
    const qs = params.get("empresa_id");
    if (!qs) return;
    if (qs === empresaId) return;
    // Só aceita se o usuário tem permissão (super admin) ou pertence à empresa
    if (!isSuperAdmin && !empresasIds.includes(qs)) return;
    if (lastApplied.current === qs) return;
    lastApplied.current = qs;
    setActiveEmpresaId(qs);
    queryClient.invalidateQueries();
  }, [params, empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId, queryClient]);

  // Contexto -> URL (mantém a query string em dia ao navegar pelo app)
  useEffect(() => {
    if (!empresaId) return;
    const qs = params.get("empresa_id");
    if (qs === empresaId) return;
    const next = new URLSearchParams(params);
    next.set("empresa_id", empresaId);
    setParams(next, { replace: true });
  }, [empresaId, params, setParams]);

  return null;
}
