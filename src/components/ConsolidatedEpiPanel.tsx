import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, TrendingUp, DollarSign, Building2, ChevronDown, ChevronUp, GitBranch, ArrowRightLeft, Loader2, Eye, FileText, Users, Plus, X } from "lucide-react";
import ContratoConsumoChart from "@/components/ContratoConsumoChart";
import ContratoEstoquePanel from "@/components/ContratoEstoquePanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

interface EpiContrato {
  contrato_id: string;
  contrato_nome: string;
  qtd_entregue: number;
}

interface FilialEpi {
  id: string;
  nome: string;
  ca: string | null;
  categoria: string | null;
  estoque: number;
  estoque_minimo: number;
  valor: number | null;
  contratos: EpiContrato[];
}

interface FilialContrato {
  id: string;
  nome: string;
}

interface ContratoResponsavel {
  id: string;
  contrato_id: string;
  funcionario_id: string;
  funcionario_nome?: string;
}

export default function ConsolidatedEpiPanel() {
  const [data, setData] = useState<ParentCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [expandedFilialId, setExpandedFilialId] = useState<string | null>(null);
  const [filialEpis, setFilialEpis] = useState<FilialEpi[]>([]);
  const [filialContratos, setFilialContratos] = useState<FilialContrato[]>([]);
  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null);
  const [loadingFilialEpis, setLoadingFilialEpis] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [sourceEmpresaId, setSourceEmpresaId] = useState("");
  const [destEmpresaId, setDestEmpresaId] = useState("");
  const [sourceEpis, setSourceEpis] = useState<FilialEpi[]>([]);
  const [loadingEpis, setLoadingEpis] = useState(false);
  const [selectedEpiId, setSelectedEpiId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  // Responsáveis por contrato
  const [responsaveisMap, setResponsaveisMap] = useState<Record<string, ContratoResponsavel[]>>({});
  const [filialFuncionarios, setFilialFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  const [addingResp, setAddingResp] = useState<string | null>(null);
  const [newRespFuncId, setNewRespFuncId] = useState("");
  const { toast } = useToast();

  const toggleFilialDetail = async (filialId: string) => {
    if (expandedFilialId === filialId) {
      setExpandedFilialId(null);
      setFilialEpis([]);
      setFilialContratos([]);
      setSelectedContratoId(null);
      setResponsaveisMap({});
      setFilialFuncionarios([]);
      return;
    }
    setExpandedFilialId(filialId);
    setSelectedContratoId(null);
    setLoadingFilialEpis(true);

    const [episRes, contratosRes, funcsRes] = await Promise.all([
      supabase.rpc("get_filial_epis", { _filial_id: filialId }),
      supabase.from("contratos").select("id, nome").eq("unidade_id", filialId).order("nome"),
      supabase.from("funcionarios").select("id, nome").eq("empresa_id", filialId).order("nome"),
    ]);

    if (episRes.data && Array.isArray(episRes.data)) setFilialEpis(episRes.data as unknown as FilialEpi[]);
    else setFilialEpis([]);

    const contratos = contratosRes.data || [];
    setFilialContratos(contratos);
    setFilialFuncionarios(funcsRes.data || []);

    // Load responsáveis for all contracts in this unit
    if (contratos.length > 0) {
      const contratoIds = contratos.map(c => c.id);
      const { data: resps } = await supabase
        .from("contrato_responsaveis")
        .select("id, contrato_id, funcionario_id")
        .in("contrato_id", contratoIds);
      
      const map: Record<string, ContratoResponsavel[]> = {};
      (resps || []).forEach((r: any) => {
        const func = (funcsRes.data || []).find((f: any) => f.id === r.funcionario_id);
        const entry = { ...r, funcionario_nome: func?.nome || "Desconhecido" };
        if (!map[r.contrato_id]) map[r.contrato_id] = [];
        map[r.contrato_id].push(entry);
      });
      setResponsaveisMap(map);
    } else {
      setResponsaveisMap({});
    }

    setLoadingFilialEpis(false);
  };

  const addResponsavel = async (contratoId: string) => {
    if (!newRespFuncId || !expandedFilialId) return;
    const existing = responsaveisMap[contratoId]?.find(r => r.funcionario_id === newRespFuncId);
    if (existing) {
      toast({ title: "Funcionário já é responsável", variant: "destructive" });
      return;
    }
    const { data: inserted, error } = await supabase.from("contrato_responsaveis").insert({
      contrato_id: contratoId,
      funcionario_id: newRespFuncId,
      empresa_id: expandedFilialId,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }).select("id, contrato_id, funcionario_id").single();

    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    const func = filialFuncionarios.find(f => f.id === newRespFuncId);
    const newEntry: ContratoResponsavel = { ...inserted, funcionario_nome: func?.nome || "" };
    setResponsaveisMap(prev => ({
      ...prev,
      [contratoId]: [...(prev[contratoId] || []), newEntry],
    }));
    setNewRespFuncId("");
    setAddingResp(null);
    toast({ title: "Responsável adicionado!" });
  };

  const removeResponsavel = async (contratoId: string, respId: string) => {
    const { error } = await supabase.from("contrato_responsaveis").delete().eq("id", respId);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setResponsaveisMap(prev => ({
      ...prev,
      [contratoId]: (prev[contratoId] || []).filter(r => r.id !== respId),
    }));
    toast({ title: "Responsável removido" });
  };

  // Filter EPIs by selected contract
  const filteredEpis = selectedContratoId
    ? filialEpis.filter(epi => epi.contratos?.some(c => c.contrato_id === selectedContratoId))
    : filialEpis;

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
                    <div key={f.empresa_id}>
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-background/60 text-xs cursor-pointer hover:bg-background/80 transition-colors"
                        onClick={() => toggleFilialDetail(f.empresa_id)}
                      >
                        <span className="font-medium min-w-[140px] flex items-center gap-1.5">
                          <GitBranch className="w-3 h-3 text-muted-foreground" />
                          {f.empresa_nome}
                          <Eye className="w-3 h-3 text-muted-foreground/60" />
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
                      {/* Detail: items in this unit */}
                      {expandedFilialId === f.empresa_id && (
                         <div className="ml-4 mt-1 mb-2 border rounded-md overflow-hidden">
                          {loadingFilialEpis ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando itens...
                            </div>
                          ) : filialEpis.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-3">Nenhum EPI cadastrado nesta unidade.</p>
                          ) : (
                            <div>
                              {/* Contract filter tabs */}
                              {filialContratos.length > 0 && (
                                <div className="border-b bg-muted/30 p-2 space-y-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-[11px] text-muted-foreground font-medium mr-1">Contrato:</span>
                                    <Button
                                      variant={selectedContratoId === null ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 px-2 text-[11px] rounded-full"
                                      onClick={() => setSelectedContratoId(null)}
                                    >
                                      Todos ({filialEpis.length})
                                    </Button>
                                    {filialContratos.map(ct => {
                                      const count = filialEpis.filter(epi => epi.contratos?.some(c => c.contrato_id === ct.id)).length;
                                      const resps = responsaveisMap[ct.id] || [];
                                      return (
                                        <Popover key={ct.id}>
                                          <div className="flex items-center gap-0.5">
                                            <Button
                                              variant={selectedContratoId === ct.id ? "default" : "outline"}
                                              size="sm"
                                              className="h-6 px-2 text-[11px] rounded-full rounded-r-none"
                                              onClick={() => setSelectedContratoId(ct.id)}
                                            >
                                              {ct.nome} ({count})
                                            </Button>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant={selectedContratoId === ct.id ? "default" : "outline"}
                                                size="sm"
                                                className="h-6 w-6 p-0 text-[11px] rounded-full rounded-l-none border-l-0"
                                              >
                                                <Users className="w-3 h-3" />
                                              </Button>
                                            </PopoverTrigger>
                                          </div>
                                          <PopoverContent className="w-64 p-3" align="start">
                                            <div className="space-y-2">
                                              <p className="text-xs font-semibold flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-primary" />
                                                Responsáveis — {ct.nome}
                                              </p>
                                              {resps.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground">Nenhum responsável atribuído.</p>
                                              ) : (
                                                <div className="space-y-1">
                                                  {resps.map(r => (
                                                    <div key={r.id} className="flex items-center justify-between gap-1 py-0.5">
                                                      <span className="text-xs truncate">{r.funcionario_nome}</span>
                                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => removeResponsavel(ct.id, r.id)}>
                                                        <X className="w-3 h-3 text-destructive" />
                                                      </Button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="border-t pt-2 mt-1">
                                                {addingResp === ct.id ? (
                                                  <div className="space-y-1.5">
                                                    <Select value={newRespFuncId} onValueChange={setNewRespFuncId}>
                                                      <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue placeholder="Selecionar funcionário" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {filialFuncionarios
                                                          .filter(f => !resps.some(r => r.funcionario_id === f.id))
                                                          .map(f => (
                                                            <SelectItem key={f.id} value={f.id} className="text-xs">{f.nome}</SelectItem>
                                                          ))}
                                                      </SelectContent>
                                                    </Select>
                                                    <div className="flex gap-1">
                                                      <Button size="sm" className="h-6 text-[11px] flex-1" disabled={!newRespFuncId} onClick={() => addResponsavel(ct.id)}>
                                                        Confirmar
                                                      </Button>
                                                      <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { setAddingResp(null); setNewRespFuncId(""); }}>
                                                        Cancelar
                                                      </Button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <Button variant="outline" size="sm" className="h-6 text-[11px] w-full gap-1" onClick={() => setAddingResp(ct.id)}>
                                                    <Plus className="w-3 h-3" /> Adicionar Responsável
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })}
                                  </div>
                                  {/* Show selected contract responsáveis inline */}
                                  {selectedContratoId && (responsaveisMap[selectedContratoId] || []).length > 0 && (
                                    <div className="flex items-center gap-1.5 pl-5">
                                      <Users className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-[10px] text-muted-foreground">Responsáveis:</span>
                                      {(responsaveisMap[selectedContratoId] || []).map(r => (
                                        <Badge key={r.id} variant="secondary" className="text-[10px] px-1.5 py-0">{r.funcionario_nome}</Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Contract stock summary panel */}
                              {selectedContratoId && (() => {
                                const contratoEpis = filialEpis.filter(epi => epi.contratos?.some(c => c.contrato_id === selectedContratoId));
                                const contratoTotals = contratoEpis.reduce((acc, epi) => {
                                  const cInfo = epi.contratos?.find(c => c.contrato_id === selectedContratoId);
                                  return {
                                    itens: acc.itens + 1,
                                    estoque: acc.estoque + epi.estoque,
                                    valor: acc.valor + (epi.estoque * (Number(epi.valor) || 0)),
                                    baixo: acc.baixo + (epi.estoque <= epi.estoque_minimo ? 1 : 0),
                                    entregues: acc.entregues + (cInfo?.qtd_entregue || 0),
                                  };
                                }, { itens: 0, estoque: 0, valor: 0, baixo: 0, entregues: 0 });
                                const contratoNome = filialContratos.find(c => c.id === selectedContratoId)?.nome || "";

                                return (
                                  <div className="border-b bg-muted/20 px-3 py-2.5">
                                    <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-primary" />
                                      Resumo — {contratoNome}
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                      <div className="flex items-center gap-1.5 bg-background rounded px-2 py-1.5">
                                        <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Itens</p>
                                          <p className="font-bold text-xs">{contratoTotals.itens}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-background rounded px-2 py-1.5">
                                        <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Estoque</p>
                                          <p className="font-bold text-xs">{contratoTotals.estoque} un.</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-background rounded px-2 py-1.5">
                                        <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Valor Estoque</p>
                                          <p className="font-bold text-xs">R$ {contratoTotals.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-background rounded px-2 py-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Entregues</p>
                                          <p className="font-bold text-xs">{contratoTotals.entregues} un.</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-background rounded px-2 py-1.5">
                                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${contratoTotals.baixo > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                                        <div>
                                          <p className="text-[10px] text-muted-foreground">Baixo Estoque</p>
                                          <p className={`font-bold text-xs ${contratoTotals.baixo > 0 ? "text-destructive" : ""}`}>{contratoTotals.baixo}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {selectedContratoId && expandedFilialId && (
                                <ContratoConsumoChart
                                  filialId={expandedFilialId}
                                  contratoId={selectedContratoId}
                                  contratoNome={filialContratos.find(c => c.id === selectedContratoId)?.nome || ""}
                                />
                              )}

                              {selectedContratoId && expandedFilialId && (
                                <ContratoEstoquePanel
                                  filialId={expandedFilialId}
                                  contratoId={selectedContratoId}
                                  contratoNome={filialContratos.find(c => c.id === selectedContratoId)?.nome || ""}
                                />
                              )}

                              {filteredEpis.length === 0 ? (
                                <p className="text-xs text-muted-foreground p-3">Nenhum EPI vinculado a este contrato.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs py-1.5">EPI</TableHead>
                                      <TableHead className="text-xs py-1.5">CA</TableHead>
                                      <TableHead className="text-xs py-1.5">Categoria</TableHead>
                                      <TableHead className="text-xs py-1.5">Contratos</TableHead>
                                      <TableHead className="text-xs py-1.5 text-right">Estoque</TableHead>
                                      <TableHead className="text-xs py-1.5 text-right">Mínimo</TableHead>
                                      <TableHead className="text-xs py-1.5 text-right">Valor un.</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {filteredEpis.map(epi => (
                                      <TableRow key={epi.id} className={epi.estoque <= epi.estoque_minimo ? "bg-destructive/5" : ""}>
                                        <TableCell className="text-xs py-1.5 font-medium">{epi.nome}</TableCell>
                                        <TableCell className="text-xs py-1.5">{epi.ca || "—"}</TableCell>
                                        <TableCell className="text-xs py-1.5">{epi.categoria || "—"}</TableCell>
                                        <TableCell className="text-xs py-1.5">
                                          {epi.contratos && epi.contratos.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {epi.contratos.map(c => (
                                                <Badge key={c.contrato_id} variant={selectedContratoId === c.contrato_id ? "default" : "outline"} className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                                                  {c.contrato_nome} ({c.qtd_entregue} ent.)
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs py-1.5 text-right font-semibold">{epi.estoque}</TableCell>
                                        <TableCell className="text-xs py-1.5 text-right">{epi.estoque_minimo}</TableCell>
                                        <TableCell className="text-xs py-1.5 text-right">
                                          {epi.valor ? `R$ ${Number(epi.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
