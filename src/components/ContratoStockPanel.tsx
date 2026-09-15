import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedQuery, isOnline, getCachedData, setCachedData } from "@/lib/offlineStorage";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, ChevronDown, ChevronUp, Package, Users, Plus, Minus,
  TrendingUp, History, Loader2, FileText, BarChart3, AlertTriangle, ArrowRightLeft,
  ClipboardList, Send, CheckCircle2, XCircle, Clock
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

interface SolicitacaoEpi {
  id: string;
  contrato_id: string;
  epi_id: string;
  empresa_id: string | null;
  quantidade: number;
  motivo: string | null;
  status: "pendente" | "aprovada" | "rejeitada" | "entregue";
  solicitante_nome: string | null;
  aprovador_nome: string | null;
  observacao_resposta: string | null;
  created_at: string;
  epi_nome?: string;
  epi_ca?: string;
}

export default function ContratoStockPanel() {
  const { empresaId, contratoId: userContratoId, isSuperAdmin, isPrincipal, modulosPermitidos, loading: authLoading } = useAuth();
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
  const [transferring, setTransferring] = useState(false);
  const [transferEpis, setTransferEpis] = useState<{ id: string; nome: string; ca: string | null; estoque: number }[]>([]);
  const [transferItens, setTransferItens] = useState<{ epiId: string; quantidade: number }[]>([]);

  // Solicitation state
  const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
  const [solicitacaoContratoId, setSolicitacaoContratoId] = useState("");
  const [solicitacaoEmpresaId, setSolicitacaoEmpresaId] = useState("");
  const [solicitacaoEpiId, setSolicitacaoEpiId] = useState("");
  const [solicitacaoQtd, setSolicitacaoQtd] = useState(1);
  const [solicitacaoMotivo, setSolicitacaoMotivo] = useState("");
  const [savingSolicitacao, setSavingSolicitacao] = useState(false);
  const [solicitacaoEpis, setSolicitacaoEpis] = useState<{ id: string; nome: string; ca: string | null }[]>([]);
  const [contratoSolicitacoes, setContratoSolicitacoes] = useState<Record<string, SolicitacaoEpi[]>>({});
  const [solicitacoesOpen, setSolicitacoesOpen] = useState(false);
  const [solicitacoesContratoId, setSolicitacoesContratoId] = useState("");
  const [respondingSolicitacao, setRespondingSolicitacao] = useState<string | null>(null);
  const [respostaObs, setRespostaObs] = useState("");
  const [globalPendingCount, setGlobalPendingCount] = useState(0);
  const [globalPendingSolicitacoes, setGlobalPendingSolicitacoes] = useState<Array<{id: string; contrato_nome: string; unidade_nome: string; epi_nome: string; quantidade: number; solicitante_nome: string | null; created_at: string}>>([]);

  const cacheScope = `${empresaId || "sem-empresa"}:${userContratoId || "sem-contrato"}:${hasGestaoEstoque ? "gestao" : hasEstoqueContrato ? "contrato" : "sem-acesso"}`;

  const loadData = useCallback(async () => {
    if (authLoading) return;
    if (!canAccessPanel) {
      setUnidades([]);
      setContratos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [unidadesResult, contratosResult] = await Promise.all([
      cachedQuery<Unidade>(`empresa_config_${cacheScope}`, () =>
        supabase.from("empresa_config").select("id, nome, tipo, empresa_pai_id") as any
      ),
      cachedQuery<Contrato>(`contratos_${cacheScope}`, () =>
        supabase.from("contratos").select("id, nome, unidade_id, empresa_id") as any
      ),
    ]);
    setUnidades(unidadesResult.data as Unidade[]);
    setContratos(contratosResult.data as Contrato[]);
    setLoading(false);
  }, [authLoading, cacheScope, canAccessPanel]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Load global pending solicitations count for gestão users
  useEffect(() => {
    if (!hasGestaoEstoque) return;
    const loadPending = async () => {
      if (!isOnline()) {
        // Use cached solicitations
        const cached = getCachedData<any>("solicitacoes_epi_pending");
        if (cached) {
          setGlobalPendingCount(cached.length);
          setGlobalPendingSolicitacoes(cached);
        }
        return;
      }
      const { data, count } = await (supabase.from as any)("solicitacoes_epi")
        .select("id, contrato_id, epi_id, quantidade, solicitante_nome, created_at, empresa_id", { count: "exact" })
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(20);
      setGlobalPendingCount(count || 0);
      if (data && data.length > 0) {
        // Enrich with contrato, unidade, and epi names
        const contratoIds = [...new Set(data.map((s: any) => s.contrato_id))] as string[];
        const epiIds = [...new Set(data.map((s: any) => s.epi_id))] as string[];
        const empresaIds = [...new Set(data.map((s: any) => s.empresa_id).filter(Boolean))] as string[];
        const [contratosRes, episRes, empresasRes] = await Promise.all([
          supabase.from("contratos").select("id, nome, unidade_id").in("id", contratoIds),
          supabase.from("epis").select("id, nome").in("id", epiIds),
          empresaIds.length > 0 ? supabase.from("empresa_config").select("id, nome").in("id", empresaIds) : { data: [] },
        ]);
        const contratosMap = new Map((contratosRes.data || []).map((c: any) => [c.id, c]));
        const episMap = new Map((episRes.data || []).map((e: any) => [e.id, e]));
        const empresasMap = new Map(((empresasRes as any).data || []).map((e: any) => [e.id, e]));
        // Also get unidade names from contrato.unidade_id
        const unidadeIds = [...new Set((contratosRes.data || []).map((c: any) => c.unidade_id).filter(Boolean))] as string[];
        let unidadesMap = new Map<string, string>();
        if (unidadeIds.length > 0) {
          const { data: unidadesData } = await supabase.from("empresa_config").select("id, nome").in("id", unidadeIds);
          unidadesMap = new Map((unidadesData || []).map((u: any) => [u.id, u.nome]));
        }
        const enriched = data.map((s: any) => {
          const contrato = contratosMap.get(s.contrato_id);
          return {
            id: s.id,
            contrato_nome: contrato?.nome || "—",
            unidade_nome: contrato ? (unidadesMap.get(contrato.unidade_id) || (empresasMap.get(s.empresa_id) as any)?.nome || "—") : ((empresasMap.get(s.empresa_id) as any)?.nome || "—"),
            epi_nome: episMap.get(s.epi_id)?.nome || "—",
            quantidade: s.quantidade,
            solicitante_nome: s.solicitante_nome,
            created_at: s.created_at,
          };
        });
        setGlobalPendingSolicitacoes(enriched);
        setCachedData("solicitacoes_epi_pending", enriched);
      }
    };
    loadPending();
  }, [hasGestaoEstoque]);

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

    // Check offline - use cached enriched data
    if (!isOnline()) {
      const cached = getCachedData<any>(`contrato_details_${contratoId}`);
      if (cached && cached.length > 0) {
        const c = cached[0];
        setContratoEpis(prev => ({ ...prev, [contratoId]: c.epis || [] }));
        setContratoResponsaveis(prev => ({ ...prev, [contratoId]: c.responsaveis || [] }));
        setContratoMovimentacoes(prev => ({ ...prev, [contratoId]: c.movimentacoes || [] }));
        setContratoConsumo(prev => ({ ...prev, [contratoId]: c.consumo || [] }));
        setContratoSolicitacoes(prev => ({ ...prev, [contratoId]: c.solicitacoes || [] }));
      }
      setLoadingContrato(prev => { const n = new Set(prev); n.delete(contratoId); return n; });
      return;
    }

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

    // Load consumption data from contrato_epis_movimentacoes (already synced via triggers)
    const sixMonthsAgo = format(subMonths(new Date(), 6), "yyyy-MM-dd");
    const { data: movConsumoData } = await supabase
      .from("contrato_epis_movimentacoes")
      .select("created_at, quantidade, epi_id, tipo, motivo")
      .eq("contrato_id", contratoId)
      .gte("created_at", sixMonthsAgo)
      .order("created_at");

    let consumoData: ConsumoMensal[] = [];
    if (movConsumoData && movConsumoData.length > 0) {
      const epiIds = [...new Set(movConsumoData.map(e => e.epi_id))];
      const { data: episInfo } = await supabase.from("epis").select("id, valor").in("id", epiIds);
      const valMap = new Map((episInfo || []).map(e => [e.id, e.valor || 0]));

      const detectTipo = (m: { tipo: string; motivo: string | null }): string => {
        if (m.tipo === "entrada") return "entrada_contrato";
        const mot = (m.motivo || "").toLowerCase();
        if (mot.includes("substituição") || mot.includes("substituicao")) return "substituicao";
        if (mot.includes("troca")) return "troca";
        if (mot.includes("devolução") || mot.includes("devolucao")) return "devolucao";
        if (mot.includes("perda")) return "perda";
        if (mot.includes("dano")) return "dano";
        return "entrega";
      };

      const emptyMonth = () => ({ entrega: 0, troca: 0, substituicao: 0, devolucao: 0, perda: 0, dano: 0, custo: 0 });
      const monthMap = new Map<string, ReturnType<typeof emptyMonth>>();
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(startOfMonth(d), "yyyy-MM");
        monthMap.set(key, emptyMonth());
      }

      movConsumoData.forEach(e => {
        const key = e.created_at.substring(0, 7);
        const existing = monthMap.get(key);
        if (!existing) return;
        const tipo = detectTipo(e);
        if (tipo !== "entrada_contrato" && tipo in existing && tipo !== "custo") {
          (existing as any)[tipo] += e.quantidade;
        }
        if (e.tipo === "saida") {
          existing.custo += e.quantidade * (valMap.get(e.epi_id) || 0);
        }
      });

      consumoData = Array.from(monthMap.entries()).map(([key, val]) => ({
        mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
        ...val,
        custo: Number(val.custo.toFixed(2)),
      }));
    }

    // Load solicitações
    const { data: solData } = await (supabase.from as any)("solicitacoes_epi")
      .select("id, contrato_id, epi_id, empresa_id, quantidade, motivo, status, solicitante_nome, aprovador_nome, observacao_resposta, created_at")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false })
      .limit(50);

    let enrichedSol: SolicitacaoEpi[] = [];
    if (solData && solData.length > 0) {
      const epiIds = [...new Set(solData.map((s: any) => s.epi_id))] as string[];
      const { data: episInfo } = await supabase.from("epis").select("id, nome, ca").in("id", epiIds);
      const episMap = new Map((episInfo || []).map(e => [e.id, e]));
      enrichedSol = solData.map((s: any) => ({
        ...s,
        epi_nome: episMap.get(s.epi_id)?.nome || "—",
        epi_ca: episMap.get(s.epi_id)?.ca || null,
      }));
    }

    setContratoEpis(prev => ({ ...prev, [contratoId]: enrichedEpis }));
    setContratoResponsaveis(prev => ({ ...prev, [contratoId]: enrichedResp }));
    setContratoMovimentacoes(prev => ({ ...prev, [contratoId]: enrichedMov }));
    setContratoConsumo(prev => ({ ...prev, [contratoId]: consumoData }));
    setContratoSolicitacoes(prev => ({ ...prev, [contratoId]: enrichedSol }));

    // Cache the enriched data for offline use
    setCachedData(`contrato_details_${contratoId}`, [{
      epis: enrichedEpis,
      responsaveis: enrichedResp,
      movimentacoes: enrichedMov,
      consumo: consumoData,
      solicitacoes: enrichedSol,
    }]);

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
        .select("nome, email")
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
          responsavel_nome: profile?.nome || profile?.email || "Gestor de SST",
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
    if (!transferUnidadeId) { setTransferEpis([]); setTransferItens([]); return; }
    (async () => {
      const { data: epis } = await supabase
        .from("epis")
        .select("id, nome, ca, estoque")
        .eq("empresa_id", transferUnidadeId)
        .gt("estoque", 0)
        .order("nome");
      setTransferEpis((epis || []) as { id: string; nome: string; ca: string | null; estoque: number }[]);
      setTransferItens([]);
    })();
  }, [transferUnidadeId]);

  const handleTransferToContract = async () => {
    const validItens = transferItens.filter(i => i.epiId && i.quantidade > 0);
    if (!transferUnidadeId || !transferContratoId || validItens.length === 0) return;
    setTransferring(true);
    try {
      let totalTransferred = 0;
      for (const item of validItens) {
        const { data: result } = await supabase.rpc("transfer_epi_to_contract" as any, {
          _source_empresa_id: transferUnidadeId,
          _contrato_id: transferContratoId,
          _epi_id: item.epiId,
          _quantidade: item.quantidade,
        });
        const res = result as any;
        if (res?.success) {
          totalTransferred += item.quantidade;
        } else {
          const epiNome = transferEpis.find(e => e.id === item.epiId)?.nome || "EPI";
          toast({ title: `Erro ao transferir ${epiNome}`, description: res?.error || "Erro desconhecido", variant: "destructive" });
        }
      }
      if (totalTransferred > 0) {
        toast({ title: "Transferência realizada!", description: `${validItens.length} EPI(s) transferido(s) para o contrato.` });
      }
      setTransferOpen(false);
      setTransferUnidadeId("");
      setTransferContratoId("");
      setTransferItens([]);
      // Reload contract details if expanded
      if (expandedContratos.has(transferContratoId)) {
        const contrato = contratos.find(c => c.id === transferContratoId);
        if (contrato) await loadContratoDetails(transferContratoId, contrato.empresa_id);
      }
      await loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  // --- Solicitation functions ---
  const openSolicitacao = async (contratoId: string, empresaId: string) => {
    setSolicitacaoContratoId(contratoId);
    setSolicitacaoEmpresaId(empresaId);
    setSolicitacaoEpiId("");
    setSolicitacaoQtd(1);
    setSolicitacaoMotivo("");
    const epis = contratoEpis[contratoId] || [];
    setSolicitacaoEpis(epis.map(e => ({ id: e.epi_id, nome: e.epi_nome || "", ca: e.epi_ca || null })));
    setSolicitacaoOpen(true);
  };

  const handleSolicitacao = async () => {
    if (!solicitacaoEpiId || solicitacaoQtd <= 0) return;
    setSavingSolicitacao(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      const { error } = await (supabase.from as any)("solicitacoes_epi").insert({
        contrato_id: solicitacaoContratoId,
        epi_id: solicitacaoEpiId,
        empresa_id: solicitacaoEmpresaId,
        quantidade: solicitacaoQtd,
        motivo: solicitacaoMotivo || null,
        solicitante_nome: profile?.nome || "Gestor de SST",
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      });

      if (error) throw error;
      toast({ title: "Solicitação enviada!", description: "Aguarde a aprovação do responsável." });
      setSolicitacaoOpen(false);
      await loadContratoDetails(solicitacaoContratoId, solicitacaoEmpresaId);
    } catch (err: any) {
      toast({ title: "Erro ao solicitar", description: err.message, variant: "destructive" });
    } finally {
      setSavingSolicitacao(false);
    }
  };

  const handleRespostaSolicitacao = async (solicitacaoId: string, novoStatus: "aprovada" | "rejeitada") => {
    setRespondingSolicitacao(solicitacaoId);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      const { error } = await (supabase.from as any)("solicitacoes_epi")
        .update({
          status: novoStatus,
          aprovador_nome: profile?.nome || "Gestor de SST",
          aprovado_por: (await supabase.auth.getUser()).data.user?.id || null,
          observacao_resposta: respostaObs || null,
        })
        .eq("id", solicitacaoId);

      if (error) throw error;
      toast({ title: novoStatus === "aprovada" ? "Solicitação aprovada!" : "Solicitação rejeitada" });
      setRespostaObs("");
      setGlobalPendingCount(prev => Math.max(0, prev - 1));
      if (solicitacoesContratoId) {
        const contrato = contratos.find(c => c.id === solicitacoesContratoId);
        if (contrato) await loadContratoDetails(solicitacoesContratoId, contrato.empresa_id);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setRespondingSolicitacao(null);
    }
  };

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pendente: { label: "Pendente", icon: <Clock className="w-3 h-3" />, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    aprovada: { label: "Aprovada", icon: <CheckCircle2 className="w-3 h-3" />, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
    rejeitada: { label: "Rejeitada", icon: <XCircle className="w-3 h-3" />, className: "bg-destructive/10 text-destructive" },
    entregue: { label: "Entregue", icon: <Package className="w-3 h-3" />, className: "bg-primary/10 text-primary" },
  };

  if (loading || authLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-bold text-sm sm:text-lg">Controle de Estoque por Unidade</h2>
        </div>
        {hasGestaoEstoque && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full sm:w-auto" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transferir para Contrato
          </Button>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
        <Users className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <span className="font-semibold">Observação:</span> Todas as métricas de consumo, entregas e movimentações são calculadas com base no cadastro do <span className="font-semibold">colaborador</span>, onde estão vinculados a <span className="font-semibold">Unidade</span> e o <span className="font-semibold">Contrato</span>. Isso garante a máxima precisão no rastreamento de origem e destino dos EPIs.
        </p>
      </div>

      {hasGestaoEstoque && globalPendingCount > 0 && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 shrink-0">
                <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {globalPendingCount} solicitaç{globalPendingCount === 1 ? "ão" : "ões"} de EPI pendente{globalPendingCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground">Expanda os contratos abaixo para aprovar ou rejeitar</p>
              </div>
              <Badge className="bg-amber-500 text-white">{globalPendingCount}</Badge>
            </div>
            {globalPendingSolicitacoes.length > 0 && (
              <div className="ml-0 sm:ml-11 space-y-1.5 mt-2">
                {globalPendingSolicitacoes.map(sol => (
                  <div key={sol.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs bg-background/80 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800/40">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-amber-700 dark:text-amber-300">{sol.unidade_nome}</span>
                      <span className="text-muted-foreground">›</span>
                      <span className="font-medium">{sol.contrato_nome}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pl-4 sm:pl-0">
                      <span className="text-muted-foreground hidden sm:inline">—</span>
                      <span className="truncate max-w-[200px]">{sol.epi_nome}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">{sol.quantidade} un.</Badge>
                      {sol.solicitante_nome && (
                        <span className="text-muted-foreground text-[10px]">por {sol.solicitante_nome}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {allUnits.map(unidade => {
        if (!unidade) return null;
        const unitContratos = visibleContratos.filter(c => c.unidade_id === unidade.id);
        if (unitContratos.length === 0) return null;

        const isUnitExpanded = expandedUnidades.has(unidade.id);

        return (
          <Card key={unidade.id} className="border-secondary/30">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Building2 className="w-4 h-4 text-secondary-foreground shrink-0" />
                  <span className="font-semibold text-sm truncate">{unidade.nome}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">{unidade.tipo}</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {unitContratos.length} contrato{unitContratos.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleUnidade(unidade.id)} className="h-7 px-2 text-xs shrink-0">
                  {isUnitExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isUnitExpanded ? "Recolher" : "Expandir"}</span>
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
                    const solicitacoes = contratoSolicitacoes[contrato.id] || [];
                    const solicitacoesPendentes = solicitacoes.filter(s => s.status === "pendente").length;

                    const totalEstoque = epis.reduce((s, e) => s + e.estoque, 0);
                    const totalValor = epis.reduce((s, e) => s + e.estoque * (e.epi_valor || 0), 0);
                    const itensBaixos = epis.filter(e => e.estoque <= 0).length;

                    return (
                      <Card key={contrato.id} className="bg-muted/30">
                        <CardContent className="p-3 space-y-3">
                          {/* Contrato header */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-medium text-sm truncate">{contrato.nome}</span>
                                {responsaveis.length > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 hidden sm:inline-flex">
                                    <Users className="w-3 h-3" />
                                    {responsaveis.map(r => r.funcionario_nome).join(", ")}
                                  </Badge>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => toggleContrato(contrato)} className="h-6 px-2 text-[10px] shrink-0">
                                {isContratoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                            {isContratoExpanded && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                  onClick={() => openAddEpi(contrato.id, unidade.id, unidade.id)}>
                                  <Plus className="w-3 h-3" />EPI
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                  onClick={() => { setHistoryContratoId(contrato.id); setHistoryOpen(true); }}>
                                  <History className="w-3 h-3" />Histórico
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                  onClick={() => openSolicitacao(contrato.id, unidade.id)}>
                                  <Send className="w-3 h-3" />Solicitar
                                  {solicitacoesPendentes > 0 && (
                                    <Badge className="h-4 px-1 text-[9px] ml-0.5 bg-amber-500 text-white">{solicitacoesPendentes}</Badge>
                                  )}
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1"
                                  onClick={() => { setSolicitacoesContratoId(contrato.id); setSolicitacoesOpen(true); }}>
                                  <ClipboardList className="w-3 h-3" />Solicitações
                                </Button>
                              </div>
                            )}
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
                                            // Calculate per-EPI average monthly spending from consumo data
                                            const epiMediaMensal = (() => {
                                              if (!consumo.length || !epi.epi_valor) return 0;
                                              // We need per-epi data; use movimentacoes for this EPI
                                              const epiMovs = movimentacoes.filter(m => m.epi_nome === epi.epi_nome && m.tipo === "saida");
                                              // Alternative: count from entregas in consumo (aggregate), but we don't have per-epi breakdown
                                              // Use movimentacoes count * valor / months with data
                                              const mesesComDados = consumo.filter(c => c.entrega > 0 || c.troca > 0 || c.substituicao > 0 || c.perda > 0 || c.dano > 0).length;
                                              if (mesesComDados === 0) return 0;
                                              const totalQtdEpi = epiMovs.reduce((s, m) => s + m.quantidade, 0);
                                              return (totalQtdEpi * Number(epi.epi_valor)) / mesesComDados;
                                            })();
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
                                              <TableCell className="text-xs text-right font-mono">
                                                {epiMediaMensal > 0 ? `R$ ${epiMediaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Transferir EPIs para Contrato
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Unidade (Origem)</Label>
              <Select value={transferUnidadeId} onValueChange={v => { setTransferUnidadeId(v); setTransferContratoId(""); setTransferItens([]); }}>
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

            {/* EPIs list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">EPIs</Label>
                {transferUnidadeId && transferEpis.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => setTransferItens(prev => [...prev, { epiId: "", quantidade: 1 }])}
                  >
                    <Plus className="w-3 h-3" /> Adicionar EPI
                  </Button>
                )}
              </div>

              {!transferUnidadeId && (
                <p className="text-xs text-muted-foreground border rounded-md p-2">Selecione a unidade primeiro</p>
              )}
              {transferUnidadeId && transferEpis.length === 0 && (
                <p className="text-xs text-muted-foreground border rounded-md p-2">Nenhum EPI com estoque disponível nesta unidade</p>
              )}
              {transferUnidadeId && transferEpis.length > 0 && transferItens.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1"
                  onClick={() => setTransferItens([{ epiId: "", quantidade: 1 }])}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar EPI
                </Button>
              )}

              {transferItens.map((item, idx) => {
                const selectedEpi = transferEpis.find(e => e.id === item.epiId);
                const usedIds = transferItens.filter((_, i) => i !== idx).map(i => i.epiId);
                const availableForSelect = transferEpis.filter(e => !usedIds.includes(e.id));
                return (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-md border bg-muted/30">
                    <div className="flex-1 space-y-1.5">
                      <Select value={item.epiId} onValueChange={v => {
                        setTransferItens(prev => prev.map((it, i) => i === idx ? { ...it, epiId: v } : it));
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                        <SelectContent>
                          {availableForSelect.map(e => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nome} {e.ca ? `(CA: ${e.ca})` : ""} — Disp: {e.estoque}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={selectedEpi?.estoque || 999}
                          value={item.quantidade}
                          onChange={e => {
                            const val = Math.max(1, Number(e.target.value));
                            setTransferItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: val } : it));
                          }}
                          className="h-8 text-xs w-20"
                          placeholder="Qtd"
                        />
                        {selectedEpi && (
                          <span className="text-[10px] text-muted-foreground">de {selectedEpi.estoque} disp.</span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => setTransferItens(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleTransferToContract}
              disabled={transferring || !transferUnidadeId || !transferContratoId || transferItens.filter(i => i.epiId && i.quantidade > 0).length === 0}>
              {transferring ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />}
              Transferir {transferItens.filter(i => i.epiId).length > 1 ? `(${transferItens.filter(i => i.epiId).length} EPIs)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Solicitar EPI Dialog */}
      <Dialog open={solicitacaoOpen} onOpenChange={setSolicitacaoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Solicitar EPI
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">EPI</Label>
              <Select value={solicitacaoEpiId} onValueChange={setSolicitacaoEpiId}>
                <SelectTrigger><SelectValue placeholder="Selecione o EPI" /></SelectTrigger>
                <SelectContent>
                  {solicitacaoEpis.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} {e.ca ? `(CA: ${e.ca})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {solicitacaoEpis.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhum EPI vinculado a este contrato</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} value={solicitacaoQtd} onChange={e => setSolicitacaoQtd(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <Label className="text-xs">Motivo / Justificativa</Label>
              <Textarea
                value={solicitacaoMotivo}
                onChange={e => setSolicitacaoMotivo(e.target.value)}
                placeholder="Ex: Estoque baixo, necessidade de reposição para nova equipe..."
                className="min-h-[60px] text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSolicitacaoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSolicitacao} disabled={savingSolicitacao || !solicitacaoEpiId || solicitacaoQtd <= 0}>
              {savingSolicitacao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Solicitações List Dialog */}
      <Dialog open={solicitacoesOpen} onOpenChange={setSolicitacoesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Solicitações de EPIs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(contratoSolicitacoes[solicitacoesContratoId] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação registrada</p>
            ) : (
              (contratoSolicitacoes[solicitacoesContratoId] || []).map(sol => {
                const cfg = statusConfig[sol.status] || statusConfig.pendente;
                return (
                  <div key={sol.id} className="rounded-md border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{sol.epi_nome}</span>
                        {sol.epi_ca && <span className="text-[10px] text-muted-foreground font-mono">CA: {sol.epi_ca}</span>}
                        <span className="text-xs font-mono font-semibold">{sol.quantidade} un.</span>
                      </div>
                      <Badge className={`text-[10px] gap-1 ${cfg.className}`}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>
                    {sol.motivo && (
                      <p className="text-[11px] text-muted-foreground">{sol.motivo}</p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Solicitado por: {sol.solicitante_nome}</span>
                      <span>· {format(new Date(sol.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    {sol.aprovador_nome && (
                      <div className="text-[10px] text-muted-foreground">
                        {sol.status === "aprovada" ? "Aprovado" : "Rejeitado"} por: {sol.aprovador_nome}
                        {sol.observacao_resposta && <span> — {sol.observacao_resposta}</span>}
                      </div>
                    )}
                    {/* Approve/Reject buttons for pending solicitations (only for managers) */}
                    {sol.status === "pendente" && hasGestaoEstoque && (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <Input
                          placeholder="Observação (opcional)"
                          className="h-7 text-xs flex-1"
                          value={respondingSolicitacao === sol.id ? respostaObs : ""}
                          onChange={e => { setRespondingSolicitacao(sol.id); setRespostaObs(e.target.value); }}
                          onFocus={() => setRespondingSolicitacao(sol.id)}
                        />
                        <Button size="sm" className="h-7 text-[10px] gap-1" variant="outline"
                          onClick={() => handleRespostaSolicitacao(sol.id, "aprovada")}
                          disabled={respondingSolicitacao === sol.id && savingSolicitacao}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />Aprovar
                        </Button>
                        <Button size="sm" className="h-7 text-[10px] gap-1" variant="outline"
                          onClick={() => handleRespostaSolicitacao(sol.id, "rejeitada")}
                          disabled={respondingSolicitacao === sol.id && savingSolicitacao}>
                          <XCircle className="w-3 h-3 text-destructive" />Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
