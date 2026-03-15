import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp, DollarSign, Building2, ChevronDown, ChevronUp, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilialStock {
  empresa_id: string;
  empresa_nome: string;
  total_itens: number;
  estoque_total: number;
  valor_total: number;
  itens_baixo_estoque: number;
  consumo_medio_mensal: number;
  custo_medio_mensal: number;
}

interface ParentCompany {
  empresa_id: string;
  empresa_nome: string;
  filiais: FilialStock[];
}

export default function ConsolidatedEpiPanel() {
  const [data, setData] = useState<ParentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: result } = await supabase.rpc("get_consolidated_epi_stock");
      if (result && Array.isArray(result)) setData(result as unknown as ParentCompany[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (data.length === 0) return null;

  // Check if there are any filiais at all
  const totalFiliais = data.reduce((sum, p) => sum + (p.filiais?.length || 0), 0);
  if (totalFiliais === 0) return null;

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {data.map((parent) => {
        if (!parent.filiais || parent.filiais.length === 0) return null;

        const totals = parent.filiais.reduce(
          (acc, f) => ({
            itens: acc.itens + f.total_itens,
            estoque: acc.estoque + f.estoque_total,
            valor: acc.valor + f.valor_total,
            baixo: acc.baixo + f.itens_baixo_estoque,
            consumo: acc.consumo + f.consumo_medio_mensal,
            custo: acc.custo + f.custo_medio_mensal,
          }),
          { itens: 0, estoque: 0, valor: 0, baixo: 0, consumo: 0, custo: 0 }
        );

        const isExpanded = expandedParents.has(parent.empresa_id);

        return (
          <Card key={parent.empresa_id} className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">{parent.empresa_nome}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                    <GitBranch className="w-3 h-3" />
                    {parent.filiais.length} {parent.filiais.length === 1 ? "filial" : "filiais"}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleParent(parent.empresa_id)} className="h-7 px-2 text-xs">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isExpanded ? "Recolher" : "Detalhar"}
                </Button>
              </div>

              {/* Totals summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Estoque Total</p>
                    <p className="font-bold text-sm">{totals.estoque.toLocaleString("pt-BR")} un.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Valor Total</p>
                    <p className="font-bold text-sm">R$ {totals.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Consumo Médio/Mês</p>
                    <p className="font-bold text-sm">{totals.consumo} un. · R$ {totals.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${totals.baixo > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-[11px] text-muted-foreground">Itens Baixo Estoque</p>
                    <p className={`font-bold text-sm ${totals.baixo > 0 ? "text-destructive" : ""}`}>{totals.baixo}</p>
                  </div>
                </div>
              </div>

              {/* Per-branch breakdown */}
              {isExpanded && (
                <div className="border-t pt-3 space-y-2">
                  {parent.filiais.map((f) => (
                    <div key={f.empresa_id} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-background/60 text-xs">
                      <span className="font-medium min-w-[140px] flex items-center gap-1.5">
                        <GitBranch className="w-3 h-3 text-muted-foreground" />
                        {f.empresa_nome}
                      </span>
                      <div className="flex flex-wrap gap-3">
                        <span><span className="text-muted-foreground">Itens:</span> {f.total_itens}</span>
                        <span><span className="text-muted-foreground">Estoque:</span> {f.estoque_total}</span>
                        <span><span className="text-muted-foreground">Valor:</span> R$ {f.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span><span className="text-muted-foreground">Consumo/mês:</span> {f.consumo_medio_mensal} un.</span>
                        {f.itens_baixo_estoque > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{f.itens_baixo_estoque} baixo</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
