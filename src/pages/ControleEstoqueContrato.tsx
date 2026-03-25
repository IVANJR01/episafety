import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Building2, GitBranch, FileText, ChevronRight, Loader2, Package, TrendingUp } from "lucide-react";
import StockBreadcrumb, { BreadcrumbLevel } from "@/components/stock/StockBreadcrumb";
import { MatrizKPICards, UnidadeKPICards, ContratoKPICards } from "@/components/stock/StockKPICards";

import StockMovementTable, { MovementRow } from "@/components/stock/StockMovementTable";
import ConsolidatedEpiPanel from "@/components/ConsolidatedEpiPanel";
import ContratoStockPanel from "@/components/ContratoStockPanel";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";

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

export default function ControleEstoqueContrato() {
  const { isSuperAdmin, isPrincipal, modulosPermitidos, contratoId: userContratoId, empresaId } = useAuth();
  const hasGestaoEstoque = isSuperAdmin || isPrincipal || modulosPermitidos.includes("epis:gestao_estoque") || modulosPermitidos.includes("epis");
  const hasContratoAccess = !!userContratoId;

  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbLevel[]>([]);
  const [unidades, setUnidades] = useState<UnidadeData[]>([]);
  const [contratos, setContratos] = useState<ContratoData[]>([]);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [matrizNome, setMatrizNome] = useState("Matriz");

  // Matriz KPIs
  const [matrizKPIs, setMatrizKPIs] = useState({ estoqueTotal: 0, valorTotal: 0, totalEntradas: 0, totalSaidas: 0, valorSaidas: 0, itensBaixoEstoque: 0, giroEstoque: 0 });
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [monthlyChartData, setMonthlyChartData] = useState<{ mes: string; entrada: number; saida: number }[]>([]);

  // Unidade KPIs
  const [unidadeKPIs, setUnidadeKPIs] = useState({ recebidoMatriz: 0, valorRecebido: 0, entregueContratos: 0, valorEntregue: 0, estoqueAtual: 0, itensBaixoEstoque: 0 });

  // Contrato KPIs
  const [contratoKPIs, setContratoKPIs] = useState({ consumoTotal: 0, valorConsumido: 0, custoColaborador: 0, totalColaboradores: 0, topMateriais: [] as { nome: string; qtd: number }[] });

  const currentLevel = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].type : "matriz";
  const currentId = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].id : matrizId;

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const [unidadesRes, contratosRes] = await Promise.all([
      supabase.from("empresa_config").select("id, nome, tipo, empresa_pai_id"),
      supabase.from("contratos").select("id, nome, unidade_id"),
    ]);

    const allUnidades = (unidadesRes.data || []) as UnidadeData[];
    const allContratos = (contratosRes.data || []) as ContratoData[];
    setUnidades(allUnidades);
    setContratos(allContratos);

    // Find the correct parent company (matriz)
    // For Principal/regular users, use their empresaId from auth context
    // For super_admin, if empresaId exists use it, otherwise find the root that owns the most data
    const matrizes = allUnidades.filter(u => u.empresa_pai_id === null);
    let matriz: UnidadeData | undefined;

    if (empresaId) {
      // Check if empresaId IS a matriz
      matriz = matrizes.find(m => m.id === empresaId);
      if (!matriz) {
        // empresaId might be a filial — find its parent
        const userUnit = allUnidades.find(u => u.id === empresaId);
        if (userUnit?.empresa_pai_id) {
          matriz = matrizes.find(m => m.id === userUnit.empresa_pai_id);
        }
      }
    }

    // Fallback: if only one matriz, use it
    if (!matriz && matrizes.length === 1) {
      matriz = matrizes[0];
    }

    // Super admin with multiple matrizes and no empresaId: show all as selectable
    if (!matriz && matrizes.length > 1) {
      // Default to first but show selector
      matriz = matrizes[0];
    }

    if (matriz) {
      setMatrizId(matriz.id);
      setMatrizNome(matriz.nome);
      setBreadcrumbs([{ id: matriz.id, nome: matriz.nome, type: "matriz" }]);
    }

    setLoading(false);
  }, [empresaId]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  // Load KPIs based on current level
  useEffect(() => {
    if (!currentId) return;

    if (currentLevel === "matriz") {
      loadMatrizKPIs(currentId);
    } else if (currentLevel === "unidade") {
      loadUnidadeKPIs(currentId);
    } else if (currentLevel === "contrato") {
      loadContratoKPIs(currentId);
    }
  }, [currentLevel, currentId]);

  const loadMatrizKPIs = async (matrizId: string) => {
    const filiais = unidades.filter(u => u.empresa_pai_id === matrizId);
    const filiaisIds = filiais.map(f => f.id);
    const allIds = [matrizId, ...filiaisIds];

    // Get EPIs for matriz
    const { data: episMatriz } = await supabase.from("epis").select("id, estoque, estoque_minimo, valor").eq("empresa_id", matrizId);
    const matrizEstoque = (episMatriz || []).reduce((s, e) => s + (e.estoque || 0), 0);
    const matrizValor = (episMatriz || []).reduce((s, e) => s + ((e.estoque || 0) * (e.valor || 0)), 0);
    const baixoEstoque = (episMatriz || []).filter(e => e.estoque <= e.estoque_minimo).length;

    // Get movements (transfers out from matriz)
    const { data: movs } = await supabase.from("estoque_movimentacoes")
      .select("id, tipo, quantidade, valor_unitario, empresa_origem_id, empresa_destino_id, epi_id, created_at, created_by, motivo")
      .or(`empresa_origem_id.eq.${matrizId},empresa_destino_id.eq.${matrizId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    const saidas = (movs || []).filter(m => m.empresa_origem_id === matrizId);
    const entradas = (movs || []).filter(m => m.empresa_destino_id === matrizId);

    const totalSaidas = saidas.reduce((s, m) => s + (m.quantidade || 0), 0);
    const valorSaidas = saidas.reduce((s, m) => s + ((m.quantidade || 0) * (m.valor_unitario || 0)), 0);
    const totalEntradas = entradas.reduce((s, m) => s + (m.quantidade || 0), 0);

    // Giro de estoque (average days in stock)
    let giro = 0;
    if (saidas.length > 0 && matrizEstoque > 0) {
      const firstMovDate = saidas[saidas.length - 1]?.created_at;
      if (firstMovDate) {
        const days = Math.ceil((Date.now() - new Date(firstMovDate).getTime()) / (1000 * 60 * 60 * 24));
        giro = Math.round((matrizEstoque / Math.max(1, totalSaidas)) * days);
      }
    }

    setMatrizKPIs({
      estoqueTotal: matrizEstoque,
      valorTotal: matrizValor,
      totalEntradas,
      totalSaidas,
      valorSaidas,
      itensBaixoEstoque: baixoEstoque,
      giroEstoque: giro,
    });


    // Movement table
    const epiIds = [...new Set((movs || []).map(m => m.epi_id))];
    const { data: episNames } = epiIds.length > 0
      ? await supabase.from("epis").select("id, nome").in("id", epiIds)
      : { data: [] };
    const epiMap = Object.fromEntries((episNames || []).map(e => [e.id, e.nome]));

    const empresaIds = [...new Set((movs || []).flatMap(m => [m.empresa_origem_id, m.empresa_destino_id].filter(Boolean)))];
    const empresaMap = Object.fromEntries(unidades.filter(u => empresaIds.includes(u.id)).map(u => [u.id, u.nome]));

    // Get profile names for created_by
    const userIds = [...new Set((movs || []).map(m => m.created_by).filter(Boolean))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", userIds)
      : { data: [] };
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.nome]));

    setMovements((movs || []).map(m => ({
      id: m.id,
      data: m.created_at,
      tipo: m.tipo || "transferencia",
      epi_nome: epiMap[m.epi_id] || "—",
      origem: empresaMap[m.empresa_origem_id] || "—",
      destino: empresaMap[m.empresa_destino_id] || "—",
      quantidade: m.quantidade || 0,
      responsavel: profileMap[m.created_by] || "Sistema",
      valor_unitario: m.valor_unitario,
    })));

    // Build monthly entry/exit chart
    const mesesMap: Record<string, { entrada: number; saida: number }> = {};
    (movs || []).forEach(m => {
      const mes = m.created_at?.substring(0, 7);
      if (!mes) return;
      if (!mesesMap[mes]) mesesMap[mes] = { entrada: 0, saida: 0 };
      if (m.empresa_destino_id === matrizId) {
        mesesMap[mes].entrada += (m.quantidade || 0) * (m.valor_unitario || 0);
      }
      if (m.empresa_origem_id === matrizId) {
        mesesMap[mes].saida += (m.quantidade || 0) * (m.valor_unitario || 0);
      }
    });
    const mesesSorted = Object.keys(mesesMap).sort().slice(-12);
    setMonthlyChartData(mesesSorted.map(mes => ({
      mes: mes.split("-").reverse().join("/"),
      entrada: Number(mesesMap[mes].entrada.toFixed(2)),
      saida: Number(mesesMap[mes].saida.toFixed(2)),
    })));
  };

  const loadUnidadeKPIs = async (unidadeId: string) => {
    const contratosUnidade = contratos.filter(c => c.unidade_id === unidadeId);
    const contratoIds = contratosUnidade.map(c => c.id);

    const [recebidosRes, episUnidadeRes, entregasRes, movContratosRes, contratoEpisRes] = await Promise.all([
      supabase.from("estoque_movimentacoes")
        .select("quantidade, valor_unitario, epi_id, created_at, created_by, empresa_origem_id, id, motivo, tipo")
        .eq("empresa_destino_id", unidadeId)
        .order("created_at", { ascending: false }),
      supabase.from("epis").select("estoque, estoque_minimo, valor").eq("empresa_id", unidadeId),
      supabase.from("entregas")
        .select("id, data, tipo, quantidade, epi_id, funcionario_id, created_by, observacao, empresa_id")
        .eq("empresa_id", unidadeId)
        .order("data", { ascending: false })
        .limit(50),
      contratoIds.length > 0
        ? supabase.from("contrato_epis_movimentacoes")
          .select("id, quantidade, tipo, epi_id, created_at, created_by, contrato_id")
          .in("contrato_id", contratoIds)
          .eq("tipo", "entrada")
          .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }),
      contratoIds.length > 0
        ? supabase.from("contrato_epis")
          .select("estoque, epi_id")
          .in("contrato_id", contratoIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const recebidos = recebidosRes.data || [];
    const episUnidade = episUnidadeRes.data || [];
    const entregas = entregasRes.data || [];
    const movContratos = movContratosRes.data || [];
    const contratoEpisData = contratoEpisRes.data || [];

    const recebidoMatriz = (recebidos || []).reduce((s, m) => s + (m.quantidade || 0), 0);
    const valorRecebido = (recebidos || []).reduce((s, m) => s + ((m.quantidade || 0) * (m.valor_unitario || 0)), 0);

    // Stock = unit own stock + all contract stock under this unit
    const estoqueUnidade = (episUnidade || []).reduce((s, e) => s + (e.estoque || 0), 0);
    const estoqueContratos = (contratoEpisData || []).reduce((s: number, e: any) => s + (e.estoque || 0), 0);
    const estoqueAtual = estoqueUnidade + estoqueContratos;
    const baixoUnidade = (episUnidade || []).filter(e => e.estoque <= e.estoque_minimo).length;
    const baixoContratos = (contratoEpisData || []).filter((e: any) => (e.estoque || 0) <= 0).length;
    const baixo = baixoUnidade + baixoContratos;

    let entregueContratos = 0;
    let valorEntregue = 0;
    if (movContratos.length > 0) {
      entregueContratos = movContratos.reduce((s, m) => s + (m.quantidade || 0), 0);
      const epiIds = [...new Set(movContratos.map(m => m.epi_id))];
      if (epiIds.length > 0) {
        const { data: episVals } = await supabase.from("epis").select("id, valor").in("id", epiIds);
        const valMap = Object.fromEntries((episVals || []).map(e => [e.id, e.valor || 0]));
        valorEntregue = movContratos.reduce((s, m) => s + ((m.quantidade || 0) * (valMap[m.epi_id] || 0)), 0);
      }
    }

    setUnidadeKPIs({ recebidoMatriz, valorRecebido, entregueContratos, valorEntregue, estoqueAtual, itensBaixoEstoque: baixo });

    // Collect all EPI ids from both sources
    const allEpiIds = [...new Set([
      ...recebidos.map(m => m.epi_id),
      ...entregas.map(m => m.epi_id),
      ...movContratos.map(m => m.epi_id),
    ])];
    const { data: episNames } = allEpiIds.length > 0
      ? await supabase.from("epis").select("id, nome").in("id", allEpiIds)
      : { data: [] };
    const epiMap = Object.fromEntries((episNames || []).map(e => [e.id, e.nome]));
    const empresaMap = Object.fromEntries(unidades.map(u => [u.id, u.nome]));

    // Collect all user ids from both sources
    const allUserIds = [...new Set([
      ...recebidos.map(m => m.created_by).filter(Boolean),
      ...entregas.map(m => m.created_by).filter(Boolean),
      ...movContratos.map(m => m.created_by).filter(Boolean),
    ])];
    const { data: profiles } = allUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, nome").in("user_id", allUserIds)
      : { data: [] };
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.nome]));
    const contratoMap = Object.fromEntries(contratosUnidade.map(c => [c.id, c.nome]));

    // Get funcionario names for entregas
    const funcIds = [...new Set(entregas.map(m => m.funcionario_id).filter(Boolean))];
    const { data: funcsData } = funcIds.length > 0
      ? await supabase.from("funcionarios").select("id, nome").in("id", funcIds)
      : { data: [] };
    const funcMap = Object.fromEntries((funcsData || []).map(f => [f.id, f.nome]));

    const tipoEntregaLabel: Record<string, string> = {
      entrega: "Entrega",
      troca: "Troca",
      substituicao: "Substituição",
      devolucao: "Devolução",
      perda: "Perda",
      dano: "Dano",
    };

    // Merge both movement sources
    const transferMovs: MovementRow[] = (recebidos || []).map(m => ({
      id: m.id,
      data: m.created_at,
      tipo: m.tipo || "transferencia",
      epi_nome: epiMap[m.epi_id] || "—",
      origem: empresaMap[m.empresa_origem_id] || "Matriz",
      destino: empresaMap[unidadeId] || "—",
      quantidade: m.quantidade || 0,
      responsavel: profileMap[m.created_by] || "Sistema",
    }));

    const entregaMovs: MovementRow[] = (entregas || []).map(m => ({
      id: m.id,
      data: m.data,
      tipo: m.tipo === "devolucao" ? "devolucao" : "entrega",
      epi_nome: epiMap[m.epi_id] || "—",
      origem: empresaMap[unidadeId] || "Unidade",
      destino: funcMap[m.funcionario_id] || "Colaborador",
      quantidade: m.quantidade || 0,
      responsavel: profileMap[m.created_by] || "Sistema",
    }));

    const contratoMovRows: MovementRow[] = movContratos.map(m => ({
      id: m.id,
      data: m.created_at,
      tipo: "transferencia",
      epi_nome: epiMap[m.epi_id] || "—",
      origem: empresaMap[unidadeId] || "Unidade",
      destino: contratoMap[m.contrato_id] || "Contrato",
      quantidade: m.quantidade || 0,
      responsavel: profileMap[m.created_by] || "Sistema",
    }));

    // Combine and sort by date descending
    const allMovements = [...transferMovs, ...contratoMovRows, ...entregaMovs]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 50);

    setMovements(allMovements);

    // Monthly chart: entradas (from matriz) and saídas (to contracts)
    const mesesMap: Record<string, { entrada: number; saida: number }> = {};
    (recebidos || []).forEach(m => {
      const mes = m.created_at?.substring(0, 7);
      if (!mes) return;
      if (!mesesMap[mes]) mesesMap[mes] = { entrada: 0, saida: 0 };
      mesesMap[mes].entrada += (m.quantidade || 0) * (m.valor_unitario || 0);
    });
    if (movContratos.length > 0) {
      const epiIdsC = [...new Set(movContratos.map(m => m.epi_id))];
      const { data: episValsC } = epiIdsC.length > 0
        ? await supabase.from("epis").select("id, valor").in("id", epiIdsC)
        : { data: [] };
      const valMapC = Object.fromEntries((episValsC || []).map(e => [e.id, e.valor || 0]));
      movContratos.forEach(m => {
        const mes = m.created_at?.substring(0, 7);
        if (!mes) return;
        if (!mesesMap[mes]) mesesMap[mes] = { entrada: 0, saida: 0 };
        mesesMap[mes].saida += (m.quantidade || 0) * (valMapC[m.epi_id] || 0);
      });
    }
    const mesesSorted = Object.keys(mesesMap).sort().slice(-12);
    setMonthlyChartData(mesesSorted.map(mes => ({
      mes: mes.split("-").reverse().join("/"),
      entrada: Number(mesesMap[mes].entrada.toFixed(2)),
      saida: Number(mesesMap[mes].saida.toFixed(2)),
    })));
  };

  const loadContratoKPIs = async (contratoId: string) => {
    // Get movements for this contract (saidas = consumo)
    const { data: movs } = await supabase.from("contrato_epis_movimentacoes")
      .select("quantidade, tipo, epi_id, created_at, responsavel_nome, motivo, id")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false });

    const saidas = (movs || []).filter(m => m.tipo === "saida");
    const consumoTotal = saidas.reduce((s, m) => s + (m.quantidade || 0), 0);

    // Get EPI values
    const epiIds = [...new Set((movs || []).map(m => m.epi_id))];
    const { data: episData } = epiIds.length > 0
      ? await supabase.from("epis").select("id, nome, valor").in("id", epiIds)
      : { data: [] };
    const epiMap = Object.fromEntries((episData || []).map(e => [e.id, { nome: e.nome, valor: e.valor || 0 }]));

    const valorConsumido = saidas.reduce((s, m) => s + ((m.quantidade || 0) * (epiMap[m.epi_id]?.valor || 0)), 0);

    // Get employees in this contract
    const { count: totalColaboradores } = await supabase.from("funcionarios")
      .select("id", { count: "exact", head: true })
      .eq("contrato_id", contratoId)
      .is("data_demissao", null);

    const nColab = totalColaboradores || 1;
    const custoColaborador = valorConsumido / nColab;

    // Top 5 materials
    const materialCount: Record<string, { nome: string; qtd: number }> = {};
    saidas.forEach(m => {
      const info = epiMap[m.epi_id];
      if (!info) return;
      if (!materialCount[m.epi_id]) materialCount[m.epi_id] = { nome: info.nome, qtd: 0 };
      materialCount[m.epi_id].qtd += m.quantidade || 0;
    });
    const topMateriais = Object.values(materialCount).sort((a, b) => b.qtd - a.qtd).slice(0, 5);

    setContratoKPIs({ consumoTotal, valorConsumido, custoColaborador, totalColaboradores: nColab, topMateriais });

    // Movement table
    setMovements((movs || []).map(m => ({
      id: m.id,
      data: m.created_at,
      tipo: m.tipo,
      epi_nome: epiMap[m.epi_id]?.nome || "—",
      origem: m.tipo === "entrada" ? "Unidade" : "Contrato",
      destino: m.tipo === "saida" ? "Colaborador" : "Estoque",
      quantidade: m.quantidade || 0,
      responsavel: m.responsavel_nome || "Sistema",
    })));

    // Monthly chart: entradas and saídas for this contract
    const mesesMap: Record<string, { entrada: number; saida: number }> = {};
    (movs || []).forEach(m => {
      const mes = m.created_at?.substring(0, 7);
      if (!mes) return;
      if (!mesesMap[mes]) mesesMap[mes] = { entrada: 0, saida: 0 };
      const val = (m.quantidade || 0) * (epiMap[m.epi_id]?.valor || 0);
      if (m.tipo === "entrada") mesesMap[mes].entrada += val;
      else if (m.tipo === "saida") mesesMap[mes].saida += val;
    });
    const mesesSorted = Object.keys(mesesMap).sort().slice(-12);
    setMonthlyChartData(mesesSorted.map(mes => ({
      mes: mes.split("-").reverse().join("/"),
      entrada: Number(mesesMap[mes].entrada.toFixed(2)),
      saida: Number(mesesMap[mes].saida.toFixed(2)),
    })));
  };

  const navigateTo = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const drillDown = (id: string, nome: string, type: "unidade" | "contrato") => {
    setBreadcrumbs(prev => [...prev, { id, nome, type }]);
  };

  const matrizes = unidades.filter(u => u.empresa_pai_id === null);
  const showMatrizSelector = isSuperAdmin && matrizes.length > 1;

  const switchMatriz = (newMatrizId: string) => {
    const m = matrizes.find(u => u.id === newMatrizId);
    if (m) {
      setMatrizId(m.id);
      setMatrizNome(m.nome);
      setBreadcrumbs([{ id: m.id, nome: m.nome, type: "matriz" }]);
    }
  };

  const filiais = unidades.filter(u => u.empresa_pai_id === currentId);
  const contratosCurrentUnit = contratos.filter(c => c.unidade_id === currentId);

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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Gestão de Estoque Hierárquico</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Acompanhe o fluxo de movimentação e indicadores por nível organizacional
        </p>
      </div>

      {/* Breadcrumb */}
      {breadcrumbs.length > 0 && (
        <StockBreadcrumb levels={breadcrumbs} onNavigate={navigateTo} />
      )}

      {/* Level-specific content */}
      {currentLevel === "matriz" && (
        <div className="space-y-4">
          

          {monthlyChartData.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Entradas e Saídas Mensais (Matriz)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, name === "entrada" ? "Entrada" : "Saída"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend formatter={(v: string) => v === "entrada" ? "Entrada" : "Saída"} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entrada" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="saida" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <StockMovementTable movements={movements} title="Movimentações Recentes (Matriz)" />

          {/* Drill-down: Filiais */}
          {filiais.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" />
                  Unidades
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid gap-2">
                  {filiais.map(f => {
                    const fContratos = contratos.filter(c => c.unidade_id === f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => drillDown(f.id, f.nome, "unidade")}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{f.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {f.tipo} · {fContratos.length} contrato(s)
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing panels */}
          {hasGestaoEstoque && <ConsolidatedEpiPanel />}
        </div>
      )}

      {currentLevel === "unidade" && (
        <div className="space-y-4">
          <UnidadeKPICards {...unidadeKPIs} />

          {monthlyChartData.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Entradas e Saídas Mensais — {breadcrumbs[breadcrumbs.length - 1]?.nome}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, name === "entrada" ? "Recebido da Matriz" : "Enviado p/ Contratos"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend formatter={(v: string) => v === "entrada" ? "Recebido da Matriz" : "Enviado p/ Contratos"} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entrada" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="saida" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <StockMovementTable movements={movements} title={`Movimentações — ${breadcrumbs[breadcrumbs.length - 1]?.nome}`} />

          {/* Drill-down: Contratos */}
          {contratosCurrentUnit.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Contratos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid gap-2">
                  {contratosCurrentUnit.map(c => (
                    <button
                      key={c.id}
                      onClick={() => drillDown(c.id, c.nome, "contrato")}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{c.nome}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentLevel === "contrato" && (
        <div className="space-y-4">
          <ContratoKPICards {...contratoKPIs} />

          {monthlyChartData.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Entradas e Saídas Mensais — {breadcrumbs[breadcrumbs.length - 1]?.nome}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, name === "entrada" ? "Entrada no Contrato" : "Consumo (Colaboradores)"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend formatter={(v: string) => v === "entrada" ? "Entrada no Contrato" : "Consumo (Colaboradores)"} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entrada" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="saida" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <StockMovementTable movements={movements} title={`Consumo — ${breadcrumbs[breadcrumbs.length - 1]?.nome}`} />
        </div>
      )}

      {/* Contract stock panel always visible for authorized users */}
      {(hasGestaoEstoque || hasContratoAccess) && currentLevel === "matriz" && <ContratoStockPanel />}
    </div>
  );
}
