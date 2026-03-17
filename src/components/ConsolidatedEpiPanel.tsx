import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp, DollarSign, Building2, ChevronDown, ChevronUp, GitBranch, ArrowRightLeft, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

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

interface FilialEpi {
  id: string;
  nome: string;
  ca: string | null;
  categoria: string | null;
  estoque: number;
  estoque_minimo: number;
  valor: number | null;
}

export default function ConsolidatedEpiPanel() {
  const [data, setData] = useState<ParentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [sourceEmpresaId, setSourceEmpresaId] = useState("");
  const [destEmpresaId, setDestEmpresaId] = useState("");
  const [sourceEpis, setSourceEpis] = useState<FilialEpi[]>([]);
  const [loadingEpis, setLoadingEpis] = useState(false);
  const [selectedEpiId, setSelectedEpiId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    const { data: result } = await supabase.rpc("get_consolidated_epi_stock");
    if (result && Array.isArray(result)) setData(result as unknown as ParentCompany[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // All available units (parent + filiais) for transfer selects
  const allUnits = data.flatMap(p => {
    const units: { id: string; nome: string }[] = [{ id: p.empresa_id, nome: p.empresa_nome + " (Matriz)" }];
    p.filiais?.forEach(f => units.push({ id: f.empresa_id, nome: f.empresa_nome }));
    return units;
  });

  // Load EPIs when source changes
  useEffect(() => {
    if (!sourceEmpresaId) { setSourceEpis([]); return; }
    (async () => {
      setLoadingEpis(true);
      setSelectedEpiId("");
      const { data: result } = await supabase.rpc("get_filial_epis", { _filial_id: sourceEmpresaId });
      if (result && Array.isArray(result)) setSourceEpis(result as unknown as FilialEpi[]);
      else setSourceEpis([]);
      setLoadingEpis(false);
    })();
  }, [sourceEmpresaId]);

  const selectedEpi = sourceEpis.find(e => e.id === selectedEpiId);

  const handleTransfer = async () => {
    if (!sourceEmpresaId || !destEmpresaId || !selectedEpiId || quantidade <= 0) return;
    if (sourceEmpresaId === destEmpresaId) {
      toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" });
      return;
    }
    setTransferring(true);
    try {
      const { data: result } = await supabase.rpc("transfer_epi_stock", {
        _source_empresa_id: sourceEmpresaId,
        _dest_empresa_id: destEmpresaId,
        _source_epi_id: selectedEpiId,
        _quantidade: quantidade,
      });
      const res = result as any;
      if (res?.success) {
        toast({ title: "Transferência realizada!", description: `${quantidade} un. transferidas com sucesso.` });
        setTransferOpen(false);
        resetTransferForm();
        await loadData();
      } else {
        toast({ title: "Erro na transferência", description: res?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  const resetTransferForm = () => {
    setSourceEmpresaId("");
    setDestEmpresaId("");
    setSelectedEpiId("");
    setQuantidade(1);
    setSourceEpis([]);
  };

  if (loading) return null;
  if (data.length === 0) return null;

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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">{parent.empresa_nome}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                    <GitBranch className="w-3 h-3" />
                    {parent.filiais.length} {parent.filiais.length === 1 ? "filial" : "filiais"}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { resetTransferForm(); setTransferOpen(true); }}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transferir Estoque
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleParent(parent.empresa_id)} className="h-7 px-2 text-xs">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? "Recolher" : "Detalhar"}
                  </Button>
                </div>
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

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Transferir Estoque entre Unidades
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Unidade de Origem</Label>
              <Select value={sourceEmpresaId} onValueChange={setSourceEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                <SelectContent>
                  {allUnits.map(u => (
                    <SelectItem key={u.id} value={u.id} disabled={u.id === destEmpresaId}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>EPI a Transferir</Label>
              {loadingEpis ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando EPIs...
                </div>
              ) : sourceEpis.length === 0 && sourceEmpresaId ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum EPI encontrado nesta unidade</p>
              ) : (
                <Select value={selectedEpiId} onValueChange={setSelectedEpiId} disabled={!sourceEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                  <SelectContent>
                    {sourceEpis.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome} {e.ca ? `(CA: ${e.ca})` : ""} — Estoque: {e.estoque}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedEpi && (
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível: <span className="font-semibold">{selectedEpi.estoque} un.</span>
                  {selectedEpi.valor ? ` · R$ ${Number(selectedEpi.valor).toFixed(2)}/un.` : ""}
                </p>
              )}
            </div>

            <div>
              <Label>Unidade de Destino</Label>
              <Select value={destEmpresaId} onValueChange={setDestEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione o destino" /></SelectTrigger>
                <SelectContent>
                  {allUnits.map(u => (
                    <SelectItem key={u.id} value={u.id} disabled={u.id === sourceEmpresaId}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={selectedEpi?.estoque || 999}
                value={quantidade}
                onChange={e => setQuantidade(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleTransfer}
              disabled={transferring || !sourceEmpresaId || !destEmpresaId || !selectedEpiId || quantidade <= 0}
            >
              {transferring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
