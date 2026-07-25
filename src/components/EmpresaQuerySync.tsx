import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sincroniza o escopo da empresa ativa com a query string (?empresa_id=...).
 *
 * Utiliza trava por ref (isSyncingRef) para evitar loops de re-renderização/flicker
 * entre as atualizações do contexto e os redirecionamentos da URL.
 */
export default function EmpresaQuerySync() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId } = useAuth();
  const isSyncingRef = useRef(false);

  // 1. Contexto -> URL: Mantém a URL sincronizada com o empresaId ativo no contexto
  useEffect(() => {
    if (!empresaId) return;
    const search = new URLSearchParams(location.search);
    const currentQs = search.get("empresa_id");

    if (currentQs !== empresaId) {
      isSyncingRef.current = true;
      search.set("empresa_id", empresaId);
      navigate(
        { pathname: location.pathname, search: `?${search.toString()}`, hash: location.hash },
        { replace: true },
      );
      // Libera a trava após o ciclo de navegação ser concluído
      const timer = setTimeout(() => {
        isSyncingRef.current = false;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [empresaId, location.pathname, location.search, location.hash, navigate]);

  // 2. URL -> Contexto: Aplica a empresa da URL somente se fornecida externamente
  useEffect(() => {
    if (isSyncingRef.current) return;
    const search = new URLSearchParams(location.search);
    const qs = search.get("empresa_id");
    if (!qs || qs === empresaId) return;
    if (!isSuperAdmin && !empresasIds.includes(qs)) return;

    setActiveEmpresaId(qs);
  }, [location.search, empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId]);

  return null;
}
