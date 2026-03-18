import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2, ChevronDown, ChevronUp, Package, Users, Plus, Minus,
  TrendingUp, History, Loader2, FileText, BarChart3, AlertTriangle, ArrowRightLeft
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contrato {
  id: string;
  nome: string;
  unidade_id: string;
  empresa_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
  tipo: string;
  empresa_pai_id: string | null;
}

interface ContratoEpi {
  id: string;
  contrato_id: string;
  epi_id: string;
  estoque: number;
  empresa_id: string | null;
  epi_nome?: string;
  epi_ca?: string;
  epi_categoria?: string;
  epi_valor?: number;
}

interface Responsavel {
  id: string;
  contrato_id: string;
  funcionario_id: string;
  funcionario_nome?: string;
}

interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  responsavel_nome: string | null;
  created_at: string;
  epi_nome?: string;
}

interface ConsumoMensal {
  mes: string;
  entrega: number;
  troca: number;
  substituicao: number;
  devolucao: number;
  perda: number;
  dano: number;
  custo: number;
}

export default function ContratoStockPanel() {
  const { empresaId, contratoId: userContratoId, isSuperAdmin, isPrincipal, modulosPermitidos } = useAuth();
  // Global stock management (Rafaela-type: sees ALL units/contracts)
  const hasGestaoEstoque = isSuperAdmin || isPrincipal || modulosPermitidos.includes("epis:gestao_estoque");
  // Per-contract stock permission (technician-type: sees only their unit/contract)
  const hasEstoqueContrato = modulosPermitidos.includes("estoque_contrato") || modulosPermitidos.some(p => p.startsWith("estoque_contrato:"));
  // Contract-bound user: has contract ID and is NOT a global manager
  const isContratoUser = !!userContratoId && !hasGestaoEstoque;
  // Can access the panel at all
  const canAccessPanel = hasGestaoEstoque || hasEstoqueContrato || isContratoUser;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [expandedUnidades, setExpandedUnidades] = useState<Set<string>>(new Set());
  const [expandedContratos, setExpandedContratos] = useState<Set<string>>(new Set());

  // Per-contract data caches
  const [contratoEpis, setContratoEpis] = useState<Record<string, ContratoEpi[]>>({});
  const [contratoResponsaveis, setContratoResponsaveis] = useState<Record<string, Responsavel[]>>({});
  const [contratoMovimentacoes, setContratoMovimentacoes] = useState<Record<string, Movimentacao[]>>({});
  const [contratoConsumo, setContratoConsumo] = useState<Record<string, ConsumoMensal[]>>({});
  const [loadingContrato, setLoadingContrato] = useState<Set<string>>(new Set());

  // Stock update dialog
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateContratoId, setUpdateContratoId] = useState("");
  const [updateEmpresaId, setUpdateEmpresaId] = useState("");
  const [updateEpiId, setUpdateEpiId] = useState("");
  const [updateContratoEpiId, setUpdateContratoEpiId] = useState("");
  const [updateTipo, setUpdateTipo] = useState<"entrada" | "saida">("entrada");
  const [updateQtd, setUpdateQtd] = useState(1);
  const [updateMotivo, setUpdateMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyContratoId, setHistoryContratoId] = useState("");

  // Available EPIs for the unit (to add new ones to contract)
  const [availableEpis, setAvailableEpis] = useState<{ id: string; nome: string; ca: string | null }[]>([]);
  const [addEpiOpen, setAddEpiOpen] = useState(false);
  const [addContratoId, setAddContratoId] = useState("");
  const [addEmpresaId, setAddEmpresaId] = useState("");
  const [addEpiId, setAddEpiId] = useState("");
  const [addEstoque, setAddEstoque] = useState(0);

  // Transfer from unit stock to contract
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUnidadeId, setTransferUnidadeId] = useState("");
  const [transferContratoId, setTransferContratoId] = useState("");
  const [transferEpiId, setTransferEpiId] = useState("");
  const [transferQtd, setTransferQtd] = useState(1);
  const [transferring, setTransferring] = useState(false);
  const [transferEpis, setTransferEpis] = useState<{ id: string; nome: string; ca: string | null; estoque: number }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: unidadesData } = await supabase.from("empresa_config").select("id, nome, tipo, empresa_pai_id");
    const { data: contratosData } = await supabase.from("contratos").select("id, nome, unidade_id, empresa_id");

    if (unidadesData) setUnidades(unidadesData as Unidade[]);
    if (contratosData) setContratos(contratosData as Contrato[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-expand for contract-bound users
  const [autoExpanded, setAutoExpanded] = useState(false);
  useEffect(() => {
    if (autoExpanded || !userContratoId || contratos.length === 0) return;
    const userContrato = contratos.find(c => c.id === userContratoId);
    if (userContrato) {
      setExpandedUnidades(new Set([userContrato.unidade_id]));
      setExpandedContratos(new Set([userContratoId]));
      loadContratoDetails(userContratoId, userContrato.empresa_id);
      setAutoExpanded(true);
    }
  }, [userContratoId, contratos, autoExpanded]);

  const loadContratoDetails = useCallback(async (contratoId: string, empresaId: string | null) => {
    setLoadingContrato(prev => new Set(prev).add(contratoId));

    // Load EPIs for this contract
    const { data: episData } = await supabase
      .from("contrato_epis")
      .select("id, contrato_id, epi_id, estoque, empresa_id")
      .eq("contrato_id", contratoId);

    // Enrich with EPI names
    let enrichedEpis: ContratoEpi[] = [];
    if (episData && episData.length > 0) {
      const epiIds = episData.map(e => e.epi_id);
      const { data: episInfo } = await supabase.from("epis").select("id, nome, ca, categoria, valor").in("id", epiIds);
      const episMap = new Map((episInfo || []).map(e => [e.id, e]));
      enrichedEpis = episData.map(ce => ({
        ...ce,
        epi_nome: episMap.get(ce.epi_id)?.nome || "—",
        epi_ca: episMap.get(ce.epi_id)?.ca || null,
        epi_categoria: episMap.get(ce.epi_id)?.categoria || null,
        epi_valor: episMap.get(ce.epi_id)?.valor || null,
      }));
    }

    // Load responsáveis
    const { data: respData } = await supabase
      .from("contrato_responsaveis")
      .select("id, contrato_id, funcionario_id")
      .eq("contrato_id", contratoId);

    let enrichedResp: Responsavel[] = [];
    if (respData && respData.length > 0) {
      const funcIds = respData.map(r => r.funcionario_id);
      const { data: funcsInfo } = await supabase.from("funcionarios").select("id, nome").in("id", funcIds);
      const funcsMap = new Map((funcsInfo || []).map(f => [f.id, f]));
      enrichedResp = respData.map(r => ({
        ...r,
        funcionario_nome: funcsMap.get(r.funcionario_id)?.nome || "—",
      }));
    }

    // Load movimentações (last 50)
    const { data: movData } = await supabase
      .from("contrato_epis_movimentacoes")
      .select("id, tipo, quantidade, motivo, responsavel_nome, created_at, epi_id")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false })
      .limit(50);

    let enrichedMov: Movimentacao[] = [];
    if (movData && movData.length > 0) {
      const epiIds = [...new Set(movData.map(m => m.epi_id))];
      const { data: episInfo } = await supabase.from("epis").select("id, nome").in("id", epiIds);
      const episMap = new Map((episInfo || []).map(e => [e.id, e]));
      enrichedMov = movData.map(m => ({
        ...m,
        epi_nome: episMap.get(m.epi_id)?.nome || "—",
      }));
    }

    // Load consumption data (entregas for employees in this contract)
    const { data: funcContratoData } = await supabase
      .from("funcionarios")
      .select("id")
      .eq("contrato_id", contratoId);

    let consumoData: ConsumoMensal[] = [];
    if (funcContratoData && funcContratoData.length > 0) {
      const funcIds = funcContratoData.map(f => f.id);
      const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
      const { data: entregasData } = await supabase
        .from("entregas")
        .select("data, quantidade, epi_id, tipo")
        .in("funcionario_id", funcIds)
        .gte("data", sixMonthsAgo)
        .order("data");

      if (entregasData && entregasData.length > 0) {
        const epiIds = [...new Set(entregasData.map(e => e.epi_id))];
        const { data: episInfo } = await supabase.from("epis").select("id, valor").in("id", epiIds);
        const valMap = new Map((episInfo || []).map(e => [e.id, e.valor || 0]));

        const emptyMonth = () => ({ entrega: 0, troca: 0, substituicao: 0, devolucao: 0, perda: 0, dano: 0, custo: 0 });
        const monthMap = new Map<string, ReturnType<typeof emptyMonth>>();
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const key = format(startOfMonth(d), "yyyy-MM");
          monthMap.set(key, emptyMonth());
        }

        entregasData.forEach(e => {
          const key = e.data.substring(0, 7);
          const existing = monthMap.get(key);
          if (existing) {
            const tipo = e.tipo as keyof typeof existing;
            if (tipo in existing && tipo !== "custo") {
              (existing as any)[tipo] += e.quantidade;
            }
            existing.custo += e.quantidade * (valMap.get(e.epi_id) || 0);
          }
        });

        consumoData = Array.from(monthMap.entries()).map(([key, val]) => ({
          mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
          ...val,
          custo: Number(val.custo.toFixed(2)),
        }));
      }
    }

    setContratoEpis(prev => ({ ...prev, [contratoId]: enrichedEpis }));
    setContratoResponsaveis(prev => ({ ...prev, [contratoId]: enrichedResp }));
    setContratoMovimentacoes(prev => ({ ...prev, [contratoId]: enrichedMov }));
    setContratoConsumo(prev => ({ ...prev, [contratoId]: consumoData }));
    setLoadingContrato(prev => { const n = new Set(prev); n.delete(contratoId); return n; });
  }, []);

  const toggleUnidade = (id: string) => {
    setExpandedUnidades(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleContrato = (contrato: Contrato) => {
    const id = contrato.id;
    setExpandedContratos(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        // Load details if not loaded yet
        if (!contratoEpis[id]) {
          loadContratoDetails(id, contrato.empresa_id);
        }
      }
      return n;
    });
  };

  const openStockUpdate = (contratoId: string, empresaId: string, contratoEpiId: string, epiId: string) => {
    setUpdateContratoId(contratoId);
    setUpdateEmpresaId(empresaId);
    setUpdateContratoEpiId(contratoEpiId);
    setUpdateEpiId(epiId);
    setUpdateTipo("entrada");
    setUpdateQtd(1);
    setUpdateMotivo("");
    setUpdateOpen(true);
  };

  const handleStockUpdate = async () => {
    if (updateQtd <= 0) return;
    setSaving(true);

    try {
      // Get current user profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      // Update contrato_epis stock
      const currentEpis = contratoEpis[updateContratoId] || [];
      const currentItem = currentEpis.find(e => e.id === updateContratoEpiId);
      if (!currentItem) throw new Error("EPI não encontrado");

      const newStock = updateTipo === "entrada"
        ? currentItem.estoque + updateQtd
        : Math.max(0, currentItem.estoque - updateQtd);

      const { error: updateError } = await supabase
        .from("contrato_epis")
        .update({ estoque: newStock })
        .eq("id", updateContratoEpiId);

      if (updateError) throw updateError;

      // Record movimentação
      const { error: movError } = await supabase
        .from("contrato_epis_movimentacoes")
        .insert({
          contrato_epi_id: updateContratoEpiId,
          contrato_id: updateContratoId,
          epi_id: updateEpiId,
          empresa_id: updateEmpresaId,
          tipo: updateTipo,
          quantidade: updateQtd,
          motivo: updateMotivo || null,
          responsavel_nome: profile?.nome || "Desconhecido",
          created_by: (await supabase.auth.getUser()).data.user?.id || null,
        });

      if (movError) throw movError;

      toast({ title: `${updateTipo === "entrada" ? "Entrada" : "Saída"} registrada`, description: `${updateQtd} un. — Novo estoque: ${newStock}` });
      setUpdateOpen(false);

      // Reload contract details
      await loadContratoDetails(updateContratoId, updateEmpresaId);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openAddEpi = async (contratoId: string, empresaId: string, unidadeId: string) => {
    setAddContratoId(contratoId);
    setAddEmpresaId(empresaId);
    setAddEpiId("");
    setAddEstoque(0);

    // Load available EPIs from the unit
    const { data: epis } = await supabase
      .from("epis")
      .select("id, nome, ca")
      .eq("empresa_id", unidadeId)
      .order("nome");

    // Filter out EPIs already in this contract
    const existingIds = (contratoEpis[contratoId] || []).map(e => e.epi_id);
    setAvailableEpis((epis || []).filter(e => !existingIds.includes(e.id)));
    setAddEpiOpen(true);
  };

  const handleAddEpi = async () => {
    if (!addEpiId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contrato_epis").insert({
        contrato_id: addContratoId,
        epi_id: addEpiId,
        estoque: addEstoque,
        empresa_id: addEmpresaId,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      });
      if (error) throw error;
      toast({ title: "EPI adicionado ao contrato!" });
      setAddEpiOpen(false);
      await loadContratoDetails(addContratoId, addEmpresaId);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Load EPIs when transfer unit changes
  useEffect(() => {
    if (!transferUnidadeId) { setTransferEpis([]); return; }
    (async () => {
      const { data: epis } = await supabase
        .from("epis")
        .select("id, nome, ca, estoque")
        .eq("empresa_id", transferUnidadeId)
        .gt("estoque", 0)
        .order("nome");
      setTransferEpis((epis || []) as { id: string; nome: string; ca: string | null; estoque: number }[]);
      setTransferEpiId("");
    })();
  }, [transferUnidadeId]);

  const handleTransferToContract = async () => {
    if (!transferUnidadeId || !transferContratoId || !transferEpiId || transferQtd <= 0) return;
    setTransferring(true);
    try {
      const { data: result } = await supabase.rpc("transfer_epi_to_contract" as any, {
        _source_empresa_id: transferUnidadeId,
        _contrato_id: transferContratoId,
        _epi_id: transferEpiId,
        _quantidade: transferQtd,
      });
      const res = result as any;
      if (res?.success) {
        toast({ title: "Transferência realizada!", description: `${transferQtd} un. transferidas para o contrato.` });
        setTransferOpen(false);
        setTransferUnidadeId("");
        setTransferContratoId("");
        setTransferEpiId("");
        setTransferQtd(1);
        // Reload contract details if expanded
        if (expandedContratos.has(transferContratoId)) {
          const contrato = contratos.find(c => c.id === transferContratoId);
          if (contrato) await loadContratoDetails(transferContratoId, contrato.empresa_id);
        }
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  // Build hierarchy: group contratos by unidade
  const filiais = unidades.filter(u => u.empresa_pai_id);
  const matrizId = unidades.find(u => !u.empresa_pai_id)?.id;
  const allUnits = matrizId ? [unidades.find(u => u.id === matrizId)!, ...filiais] : filiais;

  // Filter contratos: global managers see all, contract-bound users see only theirs
  const visibleContratos = (isContratoUser || (hasEstoqueContrato && !hasGestaoEstoque && userContratoId))
    ? contratos.filter(c => c.id === userContratoId)
    : contratos;

  if (allUnits.length === 0 || visibleContratos.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-base sm:text-lg">Controle de Estoque por Contrato</h2>
        </div>
        {hasGestaoEstoque && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transferir para Contrato
          </Button>
        )}
      </div>

      {allUnits.map(unidade => {
        if (!unidade) return null;
        const unitContratos = visibleContratos.filter(c => c.unidade_id === unidade.id);
        if (unitContratos.length === 0) return null;

        const isUnitExpanded = expandedUnidades.has(unidade.id);

        return (
          <Card key={unidade.id} className="border-secondary/30">
            <CardContent className="p-4 space-y-3">
              {/* Unit header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-secondary-foreground" />
                  <span className="font-semibold text-sm">{unidade.nome}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{unidade.tipo}</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {unitContratos.length} contrato{unitContratos.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleUnidade(unidade.id)} className="h-7 px-2 text-xs">
                  {isUnitExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isUnitExpanded ? "Recolher" : "Expandir"}
                </Button>
              </div>

              {isUnitExpanded && (
                <div className="space-y-3 border-t pt-3">
                  {unitContratos.map(contrato => {
                    const isContratoExpanded = expandedContratos.has(contrato.id);
                    const isLoading = loadingContrato.has(contrato.id);
                    const epis = contratoEpis[contrato.id] || [];
                    const responsaveis = contratoResponsaveis[contrato.id] || [];
                    const consumo = contratoConsumo[contrato.id] || [];
                    const movimentacoes = contratoMovimentacoes[contrato.id] || [];

                    const totalEstoque = epis.reduce((s, e) => s + e.estoque, 0);
                    const totalValor = epis.reduce((s, e) => s + e.estoque * (e.epi_valor || 0), 0);
                    const itensBaixos = epis.filter(e => e.estoque <= 0).length;

                    return (
                      <Card key={contrato.id} className="bg-muted/30">
                        <CardContent className="p-3 space-y-3">
                          {/* Contrato header */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="font-medium text-sm">{contrato.nome}</span>
                              {responsaveis.length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                                  <Users className="w-3 h-3" />
                                  {responsaveis.map(r => r.funcionario_nome).join(", ")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isContratoExpanded && (
                                <>
                                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                    onClick={() => openAddEpi(contrato.id, unidade.id, unidade.id)}>
                                    <Plus className="w-3 h-3" />EPI
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                    onClick={() => { setHistoryContratoId(contrato.id); setHistoryOpen(true); }}>
                                    <History className="w-3 h-3" />Histórico
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => toggleContrato(contrato)} className="h-6 px-2 text-[10px]">
                                {isContratoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>

                          {isContratoExpanded && (
                            <>
                              {isLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do contrato...
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Summary cards */}
                                  {(() => {
                                    const mesesComDados = consumo.filter(c => c.entrega > 0 || c.troca > 0 || c.substituicao > 0 || c.perda > 0 || c.dano > 0).length;
                                    const totalGasto = consumo.reduce((s, c) => s + c.custo, 0);
                                    const mediaMensal = mesesComDados > 0 ? totalGasto / mesesComDados : 0;
                                    return (
                                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        <div className="rounded-md border p-2 bg-background">
                                          <p className="text-[10px] text-muted-foreground">EPIs no Contrato</p>
                                          <p className="font-bold text-sm">{epis.length}</p>
                                        </div>
                                        <div className="rounded-md border p-2 bg-background">
                                          <p className="text-[10px] text-muted-foreground">Estoque Atual</p>
                                          <p className="font-bold text-sm">{totalEstoque} un.</p>
                                        </div>
                                        <div className="rounded-md border p-2 bg-background">
                                          <p className="text-[10px] text-muted-foreground">Valor em Estoque</p>
                                          <p className="font-bold text-sm">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="rounded-md border p-2 bg-background">
                                          <p className="text-[10px] text-muted-foreground">Gasto Mensal (Média)</p>
                                          <p className="font-bold text-sm">R$ {mediaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="rounded-md border p-2 bg-background">
                                          <p className="text-[10px] text-muted-foreground">Sem Estoque</p>
                                          <p className={`font-bold text-sm ${itensBaixos > 0 ? "text-destructive" : ""}`}>{itensBaixos}</p>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* EPI Table */}
                                  {epis.length > 0 ? (
                                    <div className="rounded-md border overflow-auto bg-background">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">EPI</TableHead>
                                            <TableHead className="text-xs">CA</TableHead>
                                            <TableHead className="text-xs">Categoria</TableHead>
                                            <TableHead className="text-xs text-right">Estoque</TableHead>
                                            <TableHead className="text-xs text-right">Valor Unit.</TableHead>
                                            <TableHead className="text-xs text-right">Valor Total</TableHead>
                                            <TableHead className="text-xs text-right">Média Gasto/Mês</TableHead>
                                            <TableHead className="text-xs w-20"></TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {epis.map(epi => {
                                            const valorTotal = epi.estoque * (epi.epi_valor || 0);
                                            return (
                                            <TableRow key={epi.id}>
                                              <TableCell className="text-xs font-medium">{epi.epi_nome}</TableCell>
                                              <TableCell className="text-xs font-mono">{epi.epi_ca || "—"}</TableCell>
                                              <TableCell className="text-xs">{epi.epi_categoria || "—"}</TableCell>
                                              <TableCell className="text-xs text-right">
                                                <span className={epi.estoque <= 0 ? "text-destructive font-semibold" : "font-semibold"}>
                                                  {epi.estoque}
                                                </span>
                                              </TableCell>
                                              <TableCell className="text-xs text-right font-mono">
                                                {epi.epi_valor ? `R$ ${Number(epi.epi_valor).toFixed(2)}` : "—"}
                                              </TableCell>
                                              <TableCell className="text-xs text-right font-mono font-semibold">
                                                {valorTotal > 0 ? `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                                              </TableCell>
                                              <TableCell className="text-xs">
                                                <div className="flex gap-0.5 justify-end">
                                                  <Button variant="ghost" size="icon" className="h-6 w-6"
                                                    onClick={() => openStockUpdate(contrato.id, unidade.id, epi.id, epi.epi_id)}
                                                    title="Atualizar estoque">
                                                    <Package className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum EPI vinculado a este contrato</p>
                                  )}

                                  {/* Consumption chart */}
                                  {consumo.length > 0 && consumo.some(c => c.entrega > 0 || c.troca > 0 || c.substituicao > 0 || c.devolucao > 0 || c.perda > 0 || c.dano > 0) && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-1.5">
                                        <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-xs font-semibold">Movimentações Mensais por Tipo</span>
                                      </div>
                                      <div className="h-[220px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={consumo} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                                            <YAxis yAxisId="qty" tick={{ fontSize: 10 }} width={30} />
                                            <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 9 }} width={50} tickFormatter={v => `R$${v}`} />
                                            <Tooltip
                                              contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                              formatter={(value: number, name: string) => [
                                                name === "Custo (R$)" ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `${value} un.`,
                                                name
                                              ]}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                            {consumo.some(c => c.entrega > 0) && <Bar yAxisId="qty" dataKey="entrega" name="Entrega" stackId="tipo" fill="hsl(199, 89%, 48%)" radius={[0, 0, 0, 0]} />}
                                            {consumo.some(c => c.troca > 0) && <Bar yAxisId="qty" dataKey="troca" name="Troca" stackId="tipo" fill="hsl(25, 95%, 53%)" radius={[0, 0, 0, 0]} />}
                                            {consumo.some(c => c.substituicao > 0) && <Bar yAxisId="qty" dataKey="substituicao" name="Substituição" stackId="tipo" fill="hsl(262, 83%, 58%)" radius={[0, 0, 0, 0]} />}
                                            {consumo.some(c => c.devolucao > 0) && <Bar yAxisId="qty" dataKey="devolucao" name="Devolução" stackId="tipo" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />}
                                            {consumo.some(c => c.perda > 0) && <Bar yAxisId="qty" dataKey="perda" name="Perda" stackId="tipo" fill="hsl(346, 77%, 50%)" radius={[0, 0, 0, 0]} />}
                                            {consumo.some(c => c.dano > 0) && <Bar yAxisId="qty" dataKey="dano" name="Dano" stackId="tipo" fill="hsl(47, 95%, 53%)" radius={[0, 0, 0, 0]} />}
                                            <Bar yAxisId="cost" dataKey="custo" name="Custo (R$)" fill="hsl(var(--chart-2, var(--secondary)))" radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                  )}

                                  {/* Recent movements (last 5) */}
                                  {movimentacoes.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-xs font-semibold">Últimas Movimentações</span>
                                      </div>
                                      <div className="space-y-1">
                                        {movimentacoes.slice(0, 5).map(m => (
                                          <div key={m.id} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded bg-background">
                                            {m.tipo === "entrada" ? (
                                              <Plus className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                                            ) : (
                                              <Minus className="w-3 h-3 text-destructive shrink-0" />
                                            )}
                                            <span className="font-medium">{m.epi_nome}</span>
                                            <span className={m.tipo === "entrada" ? "text-emerald-500 dark:text-emerald-400 font-mono" : "text-destructive font-mono"}>
                                              {m.tipo === "entrada" ? "+" : "-"}{m.quantidade}
                                            </span>
                                            {m.motivo && <span className="text-muted-foreground truncate">— {m.motivo}</span>}
                                            <span className="ml-auto text-muted-foreground shrink-0">
                                              {m.responsavel_nome} · {format(new Date(m.created_at), "dd/MM/yy")}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Stock Update Dialog */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Atualizar Estoque do Contrato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Button type="button" className="flex-1" size="sm"
                variant={updateTipo === "entrada" ? "default" : "outline"}
                onClick={() => setUpdateTipo("entrada")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Entrada
              </Button>
              <Button type="button" className="flex-1" size="sm"
                variant={updateTipo === "saida" ? "destructive" : "outline"}
                onClick={() => setUpdateTipo("saida")}>
                <Minus className="w-3.5 h-3.5 mr-1" /> Saída
              </Button>
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} value={updateQtd} onChange={e => setUpdateQtd(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Input value={updateMotivo} onChange={e => setUpdateMotivo(e.target.value)}
                placeholder={updateTipo === "entrada" ? "Ex: Reposição de estoque" : "Ex: Uso em campo"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUpdateOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleStockUpdate} disabled={saving || updateQtd <= 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add EPI to Contract Dialog */}
      <Dialog open={addEpiOpen} onOpenChange={setAddEpiOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Adicionar EPI ao Contrato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">EPI</Label>
              <Select value={addEpiId} onValueChange={setAddEpiId}>
                <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                <SelectContent>
                  {availableEpis.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} {e.ca ? `(CA: ${e.ca})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableEpis.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Todos os EPIs da unidade já estão vinculados</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Estoque Inicial</Label>
              <Input type="number" min={0} value={addEstoque} onChange={e => setAddEstoque(Math.max(0, Number(e.target.value)))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddEpiOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAddEpi} disabled={saving || !addEpiId}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Histórico de Movimentações
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {(contratoMovimentacoes[historyContratoId] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada</p>
            ) : (
              (contratoMovimentacoes[historyContratoId] || []).map(m => (
                <div key={m.id} className="flex items-center gap-2 text-xs py-2 px-3 rounded border bg-background">
                  {m.tipo === "entrada" ? (
                    <Plus className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.epi_nome}</span>
                      <span className={`font-mono ${m.tipo === "entrada" ? "text-emerald-500 dark:text-emerald-400" : "text-destructive"}`}>
                        {m.tipo === "entrada" ? "+" : "-"}{m.quantidade} un.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                      {m.motivo && <span>{m.motivo}</span>}
                      <span>— {m.responsavel_nome}</span>
                      <span>· {format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer to Contract Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Transferir EPI para Contrato
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Unidade (Origem)</Label>
              <Select value={transferUnidadeId} onValueChange={v => { setTransferUnidadeId(v); setTransferContratoId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {allUnits.filter(Boolean).map(u => (
                    <SelectItem key={u!.id} value={u!.id}>{u!.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contrato (Destino)</Label>
              {contratos.length === 0 ? (
                <p className="text-xs text-muted-foreground border rounded-md p-2">Nenhum contrato disponível</p>
              ) : (
                <Select value={transferContratoId} onValueChange={setTransferContratoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                  <SelectContent>
                    {contratos.map(c => {
                      const unidadeNome = unidades.find(u => u.id === c.unidade_id)?.nome;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}{unidadeNome ? ` (${unidadeNome})` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-xs">EPI</Label>
              <Select value={transferEpiId} onValueChange={setTransferEpiId}>
                <SelectTrigger><SelectValue placeholder={transferUnidadeId ? "Selecione o EPI" : "Selecione a unidade primeiro"} /></SelectTrigger>
                <SelectContent>
                  {transferEpis.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome} {e.ca ? `(CA: ${e.ca})` : ""} — Disp: {e.estoque}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferUnidadeId && transferEpis.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhum EPI com estoque disponível nesta unidade</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={transferEpis.find(e => e.id === transferEpiId)?.estoque || 999}
                value={transferQtd}
                onChange={e => setTransferQtd(Math.max(1, Number(e.target.value)))}
              />
              {transferEpiId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Disponível: {transferEpis.find(e => e.id === transferEpiId)?.estoque || 0} un.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleTransferToContract}
              disabled={transferring || !transferUnidadeId || !transferContratoId || !transferEpiId || transferQtd <= 0}>
              {transferring ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
