import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sincroniza o escopo da empresa ativa com a query string (?empresa_id=...).
 *
 * - Lê empresa_id da URL e propaga para o contexto (setActiveEmpresaId)
 *   — setActiveEmpresaId já purga todo cache tenant-scoped (P0 #1).
 * - Em CADA mudança de rota interna, reaplica ?empresa_id=... para que o
 *   filtro nunca se perca ao clicar em links do menu.
 */
export default function EmpresaQuerySync() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId } = useAuth();
  const lastAppliedFromUrl = useRef<string | null>(null);

  // URL -> contexto (quando o usuário entra com ?empresa_id=... ou cola um link)
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const qs = search.get("empresa_id");
    if (!qs) return;
    if (qs === empresaId) return;
    if (!isSuperAdmin && !empresasIds.includes(qs)) return;
    if (lastAppliedFromUrl.current === qs) return;
    lastAppliedFromUrl.current = qs;
    setActiveEmpresaId(qs); // purga caches internamente
  }, [location.search, empresaId, empresasIds, isSuperAdmin, setActiveEmpresaId]);

  // Contexto -> URL: recoloca ?empresa_id=... em toda navegação interna
  // (reage a pathname E search para cobrir cliques em <Link to="/rota"> sem query)
  useEffect(() => {
    if (!empresaId) return;
    const search = new URLSearchParams(location.search);
    if (search.get("empresa_id") === empresaId) return;
    search.set("empresa_id", empresaId);
    navigate(
      { pathname: location.pathname, search: `?${search.toString()}`, hash: location.hash },
      { replace: true },
    );
  }, [empresaId, location.pathname, location.search, location.hash, navigate]);

  return null;
}
