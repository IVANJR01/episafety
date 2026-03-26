import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Building2, GitBranch, FileText, Loader2, Package, TrendingUp, TrendingDown,
  AlertTriangle, ChevronRight, History, Users, DollarSign, BarChart3, CalendarIcon, ArrowRightLeft
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import StockBreadcrumb, { BreadcrumbLevel } from "@/components/stock/StockBreadcrumb";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnidadeData {
  id: string;
  nome: string;
  tipo: string;
  empresa_pai_id: string | null;
}

interface ContratoData {
  id: string;
  nome: string;
  unidade_id: string;
}

interface ContratoStockSummary {
  contratoId: string;
  contratoNome: string;
  totalItens: number;
  estoqueTotal: number;
  valorTotal: number;
  alertas: number;
  itens: { epi_nome: string; tamanho: string | null; estoque: number; estoque_minimo: number; valor: number }[];
  movimentos: { data: string; tipo: string; epi_nome: string; destino: string; quantidade: number }[];
  loadedDetails: boolean;
}

interface UnidadeSummary {
  id: string;
  nome: string;
  tipo: string;
  recebidoMatriz: number;
  valorRecebido: number;
  estoqueAtual: number;
  alertas: number;
  contratos: ContratoStockSummary[];
  loaded: boolean;
}

export default function ControleEstoqueContrato() {
  const { isSuperAdmin, isPrincipal, modulosPermitidos, contratoId: userContratoId, empresaId } = useAuth();
  const { toast } = useToast();
  const hasGestaoEstoque = isSuperAdmin || isPrincipal || modulosPermitidos.includes("epis:gestao_estoque") || modulosPermitidos.includes("epis");

  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<UnidadeData[]>([]);
  const [contratos, setContratos] = useState<ContratoData[]>([]);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [matrizNome, setMatrizNome] = useState("Matriz");

  // Refs to avoid stale closures in lazy-load functions
  const unidadesRef = useRef<UnidadeData[]>([]);
  const contratosRef = useRef<ContratoData[]>([]);
  useEffect(() => { unidadesRef.current = unidades; }, [unidades]);
  useEffect(() => { contratosRef.current = contratos; }, [contratos]);

  // Unidade summaries (lazy loaded)
  const [unidadeSummaries, setUnidadeSummaries] = useState<Record<string, UnidadeSummary>>({});
  const unidadeSummariesRef = useRef<Record<string, UnidadeSummary>>({});
  // Keep ref in sync
  useEffect(() => { unidadeSummariesRef.current = unidadeSummaries; }, [unidadeSummaries]);
  const [loadingUnidade, setLoadingUnidade] = useState<string | null>(null);
  const [loadingContrato, setLoadingContrato] = useState<string | null>(null);
  const [movDateFrom, setMovDateFrom] = useState<Date | undefined>(undefined);
  const [movDateTo, setMovDateTo] = useState<Date | undefined>(undefined);

  // Transfer modal state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState<{ contratoId: string; contratoNome: string; unidadeId: string } | null>(null);
  const [transferDestId, setTransferDestId] = useState("");
  const [transferEpiId, setTransferEpiId] = useState("");
  const [transferQtd, setTransferQtd] = useState(1);
  const [transferMotivo, setTransferMotivo] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferEpis, setTransferEpis] = useState<{ id: string; nome: string; tamanho: string | null; estoque: number }[]>([]);

  // Matriz summary
  const [matrizSummary, setMatrizSummary] = useState({ estoqueTotal: 0, valorTotal: 0, totalSaidas: 0, valorSaidas: 0, baixoEstoque: 0 });

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [unidadesRes, contratosRes] = await Promise.all([
      supabase.from("empresa_config").select("id, nome, tipo, empresa_pai_id"),
      supabase.from("contratos").select("id, nome, unidade_id"),
    ]);

    const allUnidades = (unidadesRes.data || []) as UnidadeData[];
    const allContratos = (contratosRes.data || []) as ContratoData[];
    unidadesRef.current = allUnidades;
    contratosRef.current = allContratos;
    setUnidades(allUnidades);
    setContratos(allContratos);

    const matrizes = allUnidades.filter(u => u.empresa_pai_id === null);
    let matriz: UnidadeData | undefined;

    if (empresaId) {
      matriz = matrizes.find(m => m.id === empresaId);
      if (!matriz) {
        const userUnit = allUnidades.find(u => u.id === empresaId);
        if (userUnit?.empresa_pai_id) {
          matriz = matrizes.find(m => m.id === userUnit.empresa_pai_id);
        }
      }
    }
    if (!matriz && matrizes.length === 1) matriz = matrizes[0];
    if (!matriz && matrizes.length > 1) matriz = matrizes[0];

    if (matriz) {
      setMatrizId(matriz.id);
      setMatrizNome(matriz.nome);
      // Load matriz summary
      const { data: episMatriz } = await supabase.from("epis").select("estoque, estoque_minimo, valor").eq("empresa_id", matriz.id);
      const epis = episMatriz || [];
      setMatrizSummary({
        estoqueTotal: epis.reduce((s, e) => s + (e.estoque || 0), 0),
        valorTotal: epis.reduce((s, e) => s + ((e.estoque || 0) * (e.valor || 0)), 0),
        totalSaidas: 0,
        valorSaidas: 0,
        baixoEstoque: epis.filter(e => e.estoque <= e.estoque_minimo).length,
      });
    }

    setLoading(false);
  }, [empresaId]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    if (!userContratoId) return;
    const contrato = contratos.find(c => c.id === userContratoId);
    if (!contrato?.unidade_id) return;

    loadUnidadeData(contrato.unidade_id).then(() => {
      loadContratoDetails(userContratoId, contrato.unidade_id);
    });
  }, [userContratoId, contratos]);

  // Lazy load unidade data when accordion opens
  const loadUnidadeData = async (unidadeId: string) => {
    if (unidadeSummariesRef.current[unidadeId]?.loaded) return;
    setLoadingUnidade(unidadeId);

    const unidadeContratos = contratosRef.current.filter(c => c.unidade_id === unidadeId);
    const contratoIds = unidadeContratos.map(c => c.id);

    const currentUnidades = unidadesRef.current;

    const [recebidosRes, episRes, contratoEpisRes] = await Promise.all([
      supabase.from("estoque_movimentacoes")
        .select("quantidade, valor_unitario")
        .eq("empresa_destino_id", unidadeId),
      supabase.from("epis").select("estoque, estoque_minimo").eq("empresa_id", unidadeId),
      contratoIds.length > 0
        ? supabase.from("contrato_epis").select("estoque, contrato_id, epi_id").in("contrato_id", contratoIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const recebidos = recebidosRes.data || [];
    const episUnidade = episRes.data || [];
    const contratoEpis = contratoEpisRes.data || [];

    const estoqueUnidade = episUnidade.reduce((s, e) => s + (e.estoque || 0), 0);
    const estoqueContratos = contratoEpis.reduce((s: number, e: any) => s + (e.estoque || 0), 0);
    const baixoUnidade = episUnidade.filter(e => e.estoque <= e.estoque_minimo).length;

    // Build contract summaries (without details yet)
    const contratoSummaries: ContratoStockSummary[] = unidadeContratos.map(c => {
      const cEpis = contratoEpis.filter((e: any) => e.contrato_id === c.id);
      return {
        contratoId: c.id,
        contratoNome: c.nome,
        totalItens: cEpis.length,
        estoqueTotal: cEpis.reduce((s: number, e: any) => s + (e.estoque || 0), 0),
        valorTotal: 0,
        alertas: cEpis.filter((e: any) => (e.estoque || 0) === 0).length,
        itens: [],
        movimentos: [],
        loadedDetails: false,
      };
    });

    setUnidadeSummaries(prev => ({
      ...prev,
      [unidadeId]: {
        id: unidadeId,
        nome: currentUnidades.find(u => u.id === unidadeId)?.nome || "",
        tipo: currentUnidades.find(u => u.id === unidadeId)?.tipo || "",
        recebidoMatriz: recebidos.reduce((s, m) => s + (m.quantidade || 0), 0),
        valorRecebido: recebidos.reduce((s, m) => s + ((m.quantidade || 0) * (m.valor_unitario || 0)), 0),
        estoqueAtual: estoqueUnidade + estoqueContratos,
        alertas: baixoUnidade,
        contratos: contratoSummaries,
        loaded: true,
      }
    }));
    setLoadingUnidade(null);
  };

  // Lazy load contract details (stock table + movements)
  const loadContratoDetails = async (contratoId: string, unidadeId: string) => {
    const summary = unidadeSummariesRef.current[unidadeId];
    if (!summary) return;
    const contrato = summary.contratos.find(c => c.contratoId === contratoId);
    if (contrato?.loadedDetails) return;
    setLoadingContrato(contratoId);

    const [cepisRes, movsRes] = await Promise.all([
      supabase.from("contrato_epis").select("estoque, epi_id").eq("contrato_id", contratoId),
      supabase.from("contrato_epis_movimentacoes")
        .select("quantidade, tipo, epi_id, created_at, responsavel_nome, motivo")
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const cepis = cepisRes.data || [];
    const movs = movsRes.data || [];

    // Fetch EPI names + values
    const epiIds = [...new Set([...cepis.map(e => e.epi_id), ...movs.map(m => m.epi_id)])];
    const { data: episData } = epiIds.length > 0
      ? await supabase.from("epis").select("id, nome, valor, estoque_minimo, tamanho").in("id", epiIds)
      : { data: [] };
    const epiMap = Object.fromEntries((episData || []).map(e => [e.id, e]));

    const itens = cepis.map(ce => ({
      epi_nome: epiMap[ce.epi_id]?.nome || "—",
      tamanho: epiMap[ce.epi_id]?.tamanho || null,
      estoque: ce.estoque || 0,
      estoque_minimo: epiMap[ce.epi_id]?.estoque_minimo || 0,
      valor: (ce.estoque || 0) * (epiMap[ce.epi_id]?.valor || 0),
    })).sort((a, b) => a.epi_nome.localeCompare(b.epi_nome));

    const movimentos = movs.map(m => ({
      data: m.created_at,
      tipo: m.tipo === "entrada" ? "Entrada" : m.motivo || "Saída",
      epi_nome: epiMap[m.epi_id]?.nome || "—",
      destino: m.responsavel_nome || "—",
      quantidade: m.quantidade || 0,
    }));

    const valorTotal = itens.reduce((s, i) => s + i.valor, 0);

    setUnidadeSummaries(prev => {
      const updated = { ...prev };
      const uSummary = { ...updated[unidadeId] };
      uSummary.contratos = uSummary.contratos.map(c =>
        c.contratoId === contratoId
          ? { ...c, itens, movimentos, valorTotal, loadedDetails: true }
          : c
      );
      updated[unidadeId] = uSummary;
      return updated;
    });
    setLoadingContrato(null);
  };

  const matrizes = unidades.filter(u => u.empresa_pai_id === null);
  const showMatrizSelector = isSuperAdmin && matrizes.length > 1;
  const filiais = unidades.filter(u => u.empresa_pai_id === matrizId);

  const switchMatriz = (newMatrizId: string) => {
    const m = matrizes.find(u => u.id === newMatrizId);
    if (m) {
      setMatrizId(m.id);
      setMatrizNome(m.nome);
      setUnidadeSummaries({});
    }
  };

  const openTransferModal = async (contratoId: string, contratoNome: string, unidadeId: string) => {
    setTransferSource({ contratoId, contratoNome, unidadeId });
    setTransferDestId("");
    setTransferEpiId("");
    setTransferQtd(1);
    setTransferMotivo("");
    // Load EPIs available in source contract
    const { data } = await supabase.from("contrato_epis")
      .select("epi_id, estoque")
      .eq("contrato_id", contratoId)
      .gt("estoque", 0);
    const epiIds = (data || []).map(d => d.epi_id);
    if (epiIds.length > 0) {
      const { data: episInfo } = await supabase.from("epis").select("id, nome, tamanho").in("id", epiIds);
      setTransferEpis((data || []).map(d => {
        const epi = (episInfo || []).find(e => e.id === d.epi_id);
        return { id: d.epi_id, nome: epi?.nome || "—", tamanho: epi?.tamanho || null, estoque: d.estoque || 0 };
      }).sort((a, b) => a.nome.localeCompare(b.nome)));
    } else {
      setTransferEpis([]);
    }
    setTransferOpen(true);
  };

  const executeTransfer = async () => {
    if (!transferSource || !transferDestId || !transferEpiId || transferQtd <= 0) return;
    setTransferLoading(true);
    const { data, error } = await supabase.rpc("transfer_epi_between_contracts" as any, {
      _source_contrato_id: transferSource.contratoId,
      _dest_contrato_id: transferDestId,
      _epi_id: transferEpiId,
      _quantidade: transferQtd,
      _motivo: transferMotivo || null,
    });
    setTransferLoading(false);
    const result = data as any;
    if (error || !result?.success) {
      toast({ title: "Erro na transferência", description: result?.error || error?.message || "Erro desconhecido", variant: "destructive" });
      return;
    }
    toast({ title: "Transferência realizada", description: `${transferQtd} un. transferido(s) para ${result.dest_contrato}` });
    setTransferOpen(false);
    // Reload affected contracts
    const srcUnidadeId = transferSource.unidadeId;
    // Find dest unidade
    const destContrato = contratosRef.current.find(c => c.id === transferDestId);
    // Reset summaries to force reload
    setUnidadeSummaries(prev => {
      const updated = { ...prev };
      if (updated[srcUnidadeId]) updated[srcUnidadeId] = { ...updated[srcUnidadeId], loaded: false };
      if (destContrato && updated[destContrato.unidade_id]) {
        updated[destContrato.unidade_id] = { ...updated[destContrato.unidade_id], loaded: false };
      }
      return updated;
    });
    // Reload
    setTimeout(() => {
      loadUnidadeData(srcUnidadeId);
      if (destContrato && destContrato.unidade_id !== srcUnidadeId) {
        loadUnidadeData(destContrato.unidade_id);
      }
    }, 200);
  };

  const selectedTransferEpi = transferEpis.find(e => e.id === transferEpiId);
  // All contracts except source for destination picker
  const transferDestOptions = contratos.filter(c => c.id !== transferSource?.contratoId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Estoque Hierárquico</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Acompanhe o fluxo de movimentação e indicadores por nível organizacional
          </p>
        </div>
        {showMatrizSelector && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Empresa:</Label>
            <Select value={matrizId || ""} onValueChange={switchMatriz}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {matrizes.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Matriz Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Estoque Matriz"
          value={`${matrizSummary.estoqueTotal.toLocaleString("pt-BR")} un.`}
          icon={<Package className="w-5 h-5" />}
          subtitle={`R$ ${matrizSummary.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <SummaryCard
          label="Unidades"
          value={`${filiais.length}`}
          icon={<GitBranch className="w-5 h-5" />}
          color="text-blue-600"
          subtitle={`${contratos.filter(c => filiais.some(f => f.id === c.unidade_id)).length} contratos`}
        />
        {matrizSummary.baixoEstoque > 0 && (
          <SummaryCard
            label="Alertas de Estoque"
            value={`${matrizSummary.baixoEstoque} itens`}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="text-amber-600"
            subtitle="Abaixo do mínimo"
          />
        )}
      </div>

      {/* Unidades Accordion */}
      {filiais.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Unidades vinculadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <Accordion type="multiple" onValueChange={(values) => {
              values.forEach(v => loadUnidadeData(v));
            }}>
              {filiais.map(filial => {
                const fContratos = contratos.filter(c => c.unidade_id === filial.id);
                const summary = unidadeSummaries[filial.id];
                const isLoadingThis = loadingUnidade === filial.id;

                return (
                  <AccordionItem key={filial.id} value={filial.id} className="border-b-0 mb-1">
                    <AccordionTrigger className="hover:no-underline px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 text-left flex-1 mr-2">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{filial.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {filial.tipo} · {fContratos.length} contrato(s)
                            {summary?.loaded && (
                              <> · {summary.estoqueAtual} un. em estoque</>
                            )}
                          </p>
                        </div>
                        {summary?.alertas ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {summary.alertas}
                          </Badge>
                        ) : null}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-3">
                      {isLoadingThis ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : summary?.loaded ? (
                        <div className="space-y-3">
                          {/* Unidade summary row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
                            <MiniKPI label="Recebido da Matriz" value={`${summary.recebidoMatriz} un.`} />
                            <MiniKPI label="Valor Recebido" value={`R$ ${summary.valorRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                            <MiniKPI label="Estoque Atual" value={`${summary.estoqueAtual} un.`} />
                            <MiniKPI label="Alertas" value={`${summary.alertas}`} warn={summary.alertas > 0} />
                          </div>

                          {/* Contracts inside unit */}
                          {summary.contratos.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum contrato vinculado</p>
                          ) : (
                            <Accordion type="multiple" onValueChange={(values) => {
                              values.forEach(v => loadContratoDetails(v, filial.id));
                            }}>
                              {summary.contratos.map(contrato => (
                                <AccordionItem key={contrato.contratoId} value={contrato.contratoId} className="border rounded-lg mb-2 border-border/60">
                                  <AccordionTrigger className="hover:no-underline px-3 py-2.5">
                                    <div className="flex items-center gap-2 text-left flex-1 mr-2">
                                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold">{contrato.contratoNome}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {contrato.totalItens} EPIs · {contrato.estoqueTotal} un.
                                          {contrato.loadedDetails && contrato.valorTotal > 0 && (
                                            <> · R$ {contrato.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</>
                                          )}
                                        </p>
                                      </div>
                                      {contrato.alertas > 0 && (
                                        <Badge variant="outline" className="text-red-600 border-red-300 text-[10px]">
                                          {contrato.alertas} zerados
                                        </Badge>
                                      )}
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-3 pb-3">
                                    {loadingContrato === contrato.contratoId ? (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                      </div>
                                    ) : contrato.loadedDetails ? (
                                      <div className="space-y-3">
                                        {/* Transfer button */}
                                        {contrato.itens.length > 0 && (
                                          <div className="flex justify-end">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 text-[11px] gap-1.5"
                                              onClick={() => openTransferModal(contrato.contratoId, contrato.contratoNome, filial.id)}
                                            >
                                              <ArrowRightLeft className="w-3.5 h-3.5" />
                                              Transferir EPI
                                            </Button>
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                                            <Package className="w-3.5 h-3.5" /> Estoque
                                          </p>
                                          <div className="overflow-auto max-h-[250px] rounded-md border border-border/60">
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="text-[10px]">
                                                  <TableHead className="px-2 py-1.5">EPI</TableHead>
                                                  <TableHead className="px-2 py-1.5 text-right">Estoque</TableHead>
                                                  <TableHead className="px-2 py-1.5 text-right">Valor</TableHead>
                                                  <TableHead className="px-2 py-1.5 text-center">Status</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {contrato.itens.length === 0 ? (
                                                  <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">
                                                      Nenhum EPI cadastrado
                                                    </TableCell>
                                                  </TableRow>
                                                ) : contrato.itens.map((item, idx) => (
                                                  <TableRow key={idx} className="text-xs">
                                                    <TableCell className="px-2 py-1.5 max-w-[180px] truncate">
                                                      {item.epi_nome}
                                                      {item.tamanho && <span className="ml-1 text-[10px] text-muted-foreground">({item.tamanho})</span>}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-1.5 text-right font-semibold">{item.estoque}</TableCell>
                                                    <TableCell className="px-2 py-1.5 text-right text-muted-foreground">
                                                      R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-1.5 text-center">
                                                      {item.estoque === 0 ? (
                                                        <Badge variant="destructive" className="text-[9px] px-1 py-0">Zerado</Badge>
                                                      ) : item.estoque <= item.estoque_minimo ? (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[9px] px-1 py-0">Baixo</Badge>
                                                      ) : (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[9px] px-1 py-0">OK</Badge>
                                                      )}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>

                                        {/* Recent Movements */}
                                        {contrato.movimentos.length > 0 && (() => {
                                          const filteredMovs = contrato.movimentos.filter(mov => {
                                            const movDate = new Date(mov.data);
                                            if (movDateFrom && movDate < movDateFrom) return false;
                                            if (movDateTo) {
                                              const endOfDay = new Date(movDateTo);
                                              endOfDay.setHours(23, 59, 59, 999);
                                              if (movDate > endOfDay) return false;
                                            }
                                            return true;
                                          });
                                          return (
                                          <div>
                                            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                                <History className="w-3.5 h-3.5" /> Movimentações recentes
                                              </p>
                                              <div className="flex items-center gap-1.5">
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className={cn("h-7 text-[10px] px-2 gap-1", !movDateFrom && "text-muted-foreground")}>
                                                      <CalendarIcon className="w-3 h-3" />
                                                      {movDateFrom ? format(movDateFrom, "dd/MM/yy", { locale: ptBR }) : "De"}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0" align="end">
                                                    <Calendar mode="single" selected={movDateFrom} onSelect={setMovDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                                                  </PopoverContent>
                                                </Popover>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className={cn("h-7 text-[10px] px-2 gap-1", !movDateTo && "text-muted-foreground")}>
                                                      <CalendarIcon className="w-3 h-3" />
                                                      {movDateTo ? format(movDateTo, "dd/MM/yy", { locale: ptBR }) : "Até"}
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0" align="end">
                                                    <Calendar mode="single" selected={movDateTo} onSelect={setMovDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                                                  </PopoverContent>
                                                </Popover>
                                                {(movDateFrom || movDateTo) && (
                                                  <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => { setMovDateFrom(undefined); setMovDateTo(undefined); }}>
                                                    Limpar
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                            <div className="overflow-auto rounded-md border border-border/60">
                                              <Table>
                                                <TableHeader>
                                                  <TableRow className="text-[10px]">
                                                    <TableHead className="px-2 py-1.5">Data</TableHead>
                                                    <TableHead className="px-2 py-1.5">Tipo</TableHead>
                                                    <TableHead className="px-2 py-1.5">EPI</TableHead>
                                                    <TableHead className="px-2 py-1.5">Colaborador</TableHead>
                                                    <TableHead className="px-2 py-1.5 text-right">Qtd</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {filteredMovs.length === 0 ? (
                                                    <TableRow>
                                                      <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-4">
                                                        Nenhuma movimentação no período
                                                      </TableCell>
                                                    </TableRow>
                                                  ) : filteredMovs.map((mov, idx) => (
                                                    <TableRow key={idx} className="text-xs">
                                                      <TableCell className="px-2 py-1.5 whitespace-nowrap">
                                                        {format(new Date(mov.data), "dd/MM/yy", { locale: ptBR })}
                                                      </TableCell>
                                                      <TableCell className="px-2 py-1.5">
                                                        <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${
                                                          mov.tipo === "Entrada" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" :
                                                          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                                        }`}>
                                                          {mov.tipo}
                                                        </Badge>
                                                      </TableCell>
                                                      <TableCell className="px-2 py-1.5 max-w-[140px] truncate">{mov.epi_nome}</TableCell>
                                                      <TableCell className="px-2 py-1.5 max-w-[100px] truncate">{mov.destino}</TableCell>
                                                      <TableCell className="px-2 py-1.5 text-right font-semibold">{mov.quantidade}</TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          </div>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {filiais.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma unidade vinculada a esta empresa</p>
          </CardContent>
        </Card>
      )}

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="w-4 h-4" />
              Transferir EPI entre Contratos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mova EPIs do estoque de um contrato para outro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Source (readonly) */}
            <div>
              <Label className="text-xs">Origem</Label>
              <Input value={transferSource?.contratoNome || ""} disabled className="h-8 text-xs mt-1" />
            </div>

            {/* Destination */}
            <div>
              <Label className="text-xs">Destino</Label>
              <Select value={transferDestId} onValueChange={setTransferDestId}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Selecione o contrato destino" />
                </SelectTrigger>
                <SelectContent>
                  {transferDestOptions.map(c => {
                    const unidade = unidades.find(u => u.id === c.unidade_id);
                    return (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nome}{unidade ? ` (${unidade.nome})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* EPI */}
            <div>
              <Label className="text-xs">EPI</Label>
              <Select value={transferEpiId} onValueChange={(v) => { setTransferEpiId(v); setTransferQtd(1); }}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Selecione o EPI" />
                </SelectTrigger>
                <SelectContent>
                  {transferEpis.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.nome}{e.tamanho ? ` (${e.tamanho})` : ""} — {e.estoque} un.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferEpis.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Nenhum EPI com estoque disponível</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={selectedTransferEpi?.estoque || 1}
                value={transferQtd}
                onChange={e => setTransferQtd(Math.max(1, Math.min(Number(e.target.value), selectedTransferEpi?.estoque || 1)))}
                className="h-8 text-xs mt-1"
              />
              {selectedTransferEpi && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Disponível: {selectedTransferEpi.estoque} un.
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                value={transferMotivo}
                onChange={e => setTransferMotivo(e.target.value)}
                placeholder="Ex: Remanejamento de equipe"
                className="text-xs mt-1 min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={executeTransfer}
              disabled={!transferDestId || !transferEpiId || transferQtd <= 0 || transferLoading}
              className="text-xs gap-1.5"
            >
              {transferLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Tiny helper components ── */

function SummaryCard({ label, value, icon, color = "text-primary", subtitle }: {
  label: string; value: string; icon: React.ReactNode; color?: string; subtitle?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-primary/10 ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="font-bold text-lg leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKPI({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 ${warn ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" : "bg-muted/50"}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${warn ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}
