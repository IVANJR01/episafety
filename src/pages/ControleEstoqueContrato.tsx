import { useAuth } from "@/contexts/AuthContext";
import ConsolidatedEpiPanel from "@/components/ConsolidatedEpiPanel";
import ContratoStockPanel from "@/components/ContratoStockPanel";

export default function ControleEstoqueContrato() {
  const { isSuperAdmin, isPrincipal, modulosPermitidos, contratoId: userContratoId } = useAuth();
  const hasGestaoEstoque = isSuperAdmin || isPrincipal || modulosPermitidos.includes("epis:gestao_estoque") || modulosPermitidos.includes("epis");
  const hasContratoAccess = !!userContratoId;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Controle de Estoque por Unidade</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Gerencie o estoque de EPIs vinculado a cada unidade</p>
      </div>
      {hasGestaoEstoque && <ConsolidatedEpiPanel />}
      {(hasGestaoEstoque || hasContratoAccess) && <ContratoStockPanel />}
    </div>
  );
}
