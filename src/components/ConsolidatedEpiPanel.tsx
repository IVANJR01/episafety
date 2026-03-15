import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp, DollarSign, Building2, ChevronDown, ChevronUp } from "lucide-react";
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

export default function ConsolidatedEpiPanel() {
  const [data, setData] = useState<FilialStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: result } = await supabase.rpc("get_consolidated_epi_stock");
      if (result && Array.isArray(result)) setData(result as FilialStock[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (data.length <= 1) return null; // Only show for multi-branch

  const totals = data.reduce(
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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Estoque Consolidado — {data.length} Filiais</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-7 px-2 text-xs">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Recolher" : "Ver por filial"}
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
            <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Valor Total</p>
              <p className="font-bold text-sm">R$ {totals.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
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
        {expanded && (
          <div className="border-t pt-3 space-y-2">
            {data.map((f) => (
              <div key={f.empresa_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-background/60 text-xs">
                <span className="font-medium min-w-[120px]">{f.empresa_nome}</span>
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
}
