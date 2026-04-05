import { supabase } from "@/integrations/supabase/client";
import { setCachedData } from "@/lib/offlineStorage";
import { setOfflineViewCache } from "@/lib/offlineViewCache";

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

interface HierarchyPayload {
  unidades: UnidadeData[];
  contratos: ContratoData[];
  matrizId: string | null;
  matrizNome: string;
  matrizSummary: {
    estoqueTotal: number;
    valorTotal: number;
    totalSaidas: number;
    valorSaidas: number;
    baixoEstoque: number;
  };
}

interface UnidadeSummary {
  id: string;
  nome: string;
  tipo: string;
  recebidoMatriz: number;
  valorRecebido: number;
  estoqueAtual: number;
  alertas: number;
  contratos: {
    contratoId: string;
    contratoNome: string;
    totalItens: number;
    estoqueTotal: number;
    valorTotal: number;
    alertas: number;
    itens: {
      epi_nome: string;
      ca: string | null;
      tamanho: string | null;
      estoque: number;
      estoque_minimo: number;
      valor: number;
    }[];
    movimentos: {
      data: string;
      tipo: string;
      epi_nome: string;
      ca: string | null;
      tamanho: string | null;
      destino: string;
      quantidade: number;
    }[];
    loadedDetails: boolean;
  }[];
  loaded: boolean;
}

interface ContractDetailsPayload {
  itens: {
    epi_nome: string;
    ca: string | null;
    tamanho: string | null;
    estoque: number;
    estoque_minimo: number;
    valor: number;
  }[];
  movimentos: {
    data: string;
    tipo: string;
    epi_nome: string;
    ca: string | null;
    tamanho: string | null;
    destino: string;
    quantidade: number;
  }[];
  valorTotal: number;
}

interface StockPrefetchOptions {
  empresaId: string | null;
  contratoId: string | null;
  restricted: boolean;
}

async function buildRestrictedHierarchy(empresaId: string | null, contratoId: string | null): Promise<HierarchyPayload> {
  let scopedContratos: ContratoData[] = [];
  let scopedUnidades: UnidadeData[] = [];
  let matriz: UnidadeData | null = null;

  if (contratoId) {
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select("id, nome, unidade_id")
      .eq("id", contratoId)
      .maybeSingle();

    if (contratoError) throw contratoError;
    if (contrato) scopedContratos = [contrato as ContratoData];
  }

  const targetUnidadeId = scopedContratos[0]?.unidade_id || empresaId;

  if (targetUnidadeId) {
    const { data: unidade, error: unidadeError } = await supabase
      .from("empresa_config")
      .select("id, nome, tipo, empresa_pai_id")
      .eq("id", targetUnidadeId)
      .maybeSingle();

    if (unidadeError) throw unidadeError;

    if (unidade) {
      scopedUnidades.push(unidade as UnidadeData);

      if (unidade.empresa_pai_id) {
        const { data: parentEmpresa, error: parentError } = await supabase
          .from("empresa_config")
          .select("id, nome, tipo, empresa_pai_id")
          .eq("id", unidade.empresa_pai_id)
          .maybeSingle();

        if (parentError) throw parentError;
        if (parentEmpresa) {
          matriz = parentEmpresa as UnidadeData;
          scopedUnidades.unshift(matriz);
        }
      } else {
        matriz = unidade as UnidadeData;
      }

      if (scopedContratos.length === 0) {
        const { data: contratosData, error: contratosError } = await supabase
          .from("contratos")
          .select("id, nome, unidade_id")
          .eq("unidade_id", unidade.id)
          .order("nome");

        if (contratosError) throw contratosError;
        scopedContratos = (contratosData || []) as ContratoData[];
      }
    }
  }

  const uniqueUnidades = Array.from(new Map(scopedUnidades.map((item) => [item.id, item])).values());

  return {
    unidades: uniqueUnidades,
    contratos: scopedContratos,
    matrizId: matriz?.id || uniqueUnidades[0]?.id || null,
    matrizNome: matriz?.nome || uniqueUnidades[0]?.nome || "Minha Unidade",
    matrizSummary: { estoqueTotal: 0, valorTotal: 0, totalSaidas: 0, valorSaidas: 0, baixoEstoque: 0 },
  };
}

async function buildFullHierarchy(empresaId: string | null): Promise<HierarchyPayload> {
  const [unidadesRes, contratosRes] = await Promise.all([
    supabase.from("empresa_config").select("id, nome, tipo, empresa_pai_id"),
    supabase.from("contratos").select("id, nome, unidade_id"),
  ]);

  if (unidadesRes.error) throw unidadesRes.error;
  if (contratosRes.error) throw contratosRes.error;

  const allUnidades = (unidadesRes.data || []) as UnidadeData[];
  const allContratos = (contratosRes.data || []) as ContratoData[];
  const matrizes = allUnidades.filter((u) => u.empresa_pai_id === null);
  let matriz: UnidadeData | undefined;

  if (empresaId) {
    matriz = matrizes.find((m) => m.id === empresaId);
    if (!matriz) {
      const userUnit = allUnidades.find((u) => u.id === empresaId);
      if (userUnit?.empresa_pai_id) {
        matriz = matrizes.find((m) => m.id === userUnit.empresa_pai_id);
      }
    }
  }

  if (!matriz && matrizes.length > 0) {
    matriz = matrizes[0];
  }

  let matrizSummary = { estoqueTotal: 0, valorTotal: 0, totalSaidas: 0, valorSaidas: 0, baixoEstoque: 0 };
  if (matriz) {
    const { data: episMatriz, error: episMatrizError } = await supabase
      .from("epis")
      .select("estoque, estoque_minimo, valor")
      .eq("empresa_id", matriz.id);

    if (episMatrizError) throw episMatrizError;

    const epis = episMatriz || [];
    matrizSummary = {
      estoqueTotal: epis.reduce((sum, epi) => sum + (epi.estoque || 0), 0),
      valorTotal: epis.reduce((sum, epi) => sum + ((epi.estoque || 0) * (epi.valor || 0)), 0),
      totalSaidas: 0,
      valorSaidas: 0,
      baixoEstoque: epis.filter((epi) => epi.estoque <= epi.estoque_minimo).length,
    };
  }

  return {
    unidades: allUnidades,
    contratos: allContratos,
    matrizId: matriz?.id || null,
    matrizNome: matriz?.nome || "Matriz",
    matrizSummary,
  };
}

async function buildUnitSummary(unidadeId: string, unidadeContratos: ContratoData[], currentUnidades: UnidadeData[]): Promise<UnidadeSummary> {
  const contratoIds = unidadeContratos.map((contrato) => contrato.id);

  const [recebidosRes, episRes, contratoEpisRes] = await Promise.all([
    supabase.from("estoque_movimentacoes").select("quantidade, valor_unitario").eq("empresa_destino_id", unidadeId),
    supabase.from("epis").select("estoque, estoque_minimo").eq("empresa_id", unidadeId),
    contratoIds.length > 0
      ? supabase.from("contrato_epis").select("estoque, contrato_id").in("contrato_id", contratoIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (recebidosRes.error) throw recebidosRes.error;
  if (episRes.error) throw episRes.error;
  if (contratoEpisRes.error) throw contratoEpisRes.error;

  const recebidos = recebidosRes.data || [];
  const episUnidade = episRes.data || [];
  const contratoEpis = contratoEpisRes.data || [];
  const estoqueUnidade = episUnidade.reduce((sum, epi) => sum + (epi.estoque || 0), 0);
  const estoqueContratos = contratoEpis.reduce((sum: number, epi: any) => sum + (epi.estoque || 0), 0);
  const baixoUnidade = episUnidade.filter((epi) => epi.estoque <= epi.estoque_minimo).length;

  return {
    id: unidadeId,
    nome: currentUnidades.find((unidade) => unidade.id === unidadeId)?.nome || "",
    tipo: currentUnidades.find((unidade) => unidade.id === unidadeId)?.tipo || "",
    recebidoMatriz: recebidos.reduce((sum, movimento) => sum + (movimento.quantidade || 0), 0),
    valorRecebido: recebidos.reduce((sum, movimento) => sum + ((movimento.quantidade || 0) * (movimento.valor_unitario || 0)), 0),
    estoqueAtual: estoqueUnidade + estoqueContratos,
    alertas: baixoUnidade,
    contratos: unidadeContratos.map((contrato) => {
      const contratoStock = contratoEpis.filter((item: any) => item.contrato_id === contrato.id);

      return {
        contratoId: contrato.id,
        contratoNome: contrato.nome,
        totalItens: contratoStock.length,
        estoqueTotal: contratoStock.reduce((sum: number, item: any) => sum + (item.estoque || 0), 0),
        valorTotal: 0,
        alertas: contratoStock.filter((item: any) => (item.estoque || 0) === 0).length,
        itens: [],
        movimentos: [],
        loadedDetails: false,
      };
    }),
    loaded: true,
  };
}

async function buildContractDetails(contratoId: string): Promise<ContractDetailsPayload> {
  const [cepisRes, movsRes] = await Promise.all([
    supabase.from("contrato_epis").select("estoque, epi_id").eq("contrato_id", contratoId),
    supabase.from("contrato_epis_movimentacoes")
      .select("quantidade, tipo, epi_id, created_at, responsavel_nome, motivo")
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (cepisRes.error) throw cepisRes.error;
  if (movsRes.error) throw movsRes.error;

  const cepis = cepisRes.data || [];
  const movs = movsRes.data || [];
  const epiIds = [...new Set([...cepis.map((item) => item.epi_id), ...movs.map((movimento) => movimento.epi_id)])];
  const episResult = epiIds.length > 0
    ? await supabase.from("epis").select("id, nome, ca, valor, estoque_minimo, tamanho").in("id", epiIds)
    : { data: [], error: null };

  if (episResult.error) throw episResult.error;

  const epiMap = Object.fromEntries((episResult.data || []).map((epi) => [epi.id, epi]));
  const itens = cepis
    .map((item) => ({
      epi_nome: epiMap[item.epi_id]?.nome || "—",
      ca: epiMap[item.epi_id]?.ca || null,
      tamanho: epiMap[item.epi_id]?.tamanho || null,
      estoque: item.estoque || 0,
      estoque_minimo: epiMap[item.epi_id]?.estoque_minimo || 0,
      valor: (item.estoque || 0) * (epiMap[item.epi_id]?.valor || 0),
    }))
    .sort((a, b) => a.epi_nome.localeCompare(b.epi_nome));

  const movimentos = movs.map((movimento) => ({
    data: movimento.created_at,
    tipo: movimento.tipo === "entrada" ? "Entrada" : movimento.motivo || "Saída",
    epi_nome: epiMap[movimento.epi_id]?.nome || "—",
    ca: epiMap[movimento.epi_id]?.ca || null,
    tamanho: epiMap[movimento.epi_id]?.tamanho || null,
    destino: movimento.responsavel_nome || "—",
    quantidade: movimento.quantidade || 0,
  }));

  return {
    itens,
    movimentos,
    valorTotal: itens.reduce((sum, item) => sum + item.valor, 0),
  };
}

export async function prefetchDashboardOfflineData() {
  const [movimentacoes, contratos, profiles, contratoEpis, unidades, estoqueMovimentacoes] = await Promise.all([
    (supabase.from as any)("contrato_epis_movimentacoes")
      .select("id, contrato_id, epi_id, tipo, quantidade, created_at, empresa_id")
      .order("created_at", { ascending: true }),
    (supabase.from as any)("contratos").select("id, nome, unidade_id"),
    (supabase.from as any)("profiles").select("id, user_id, nome, email"),
    (supabase.from as any)("contrato_epis").select("id, contrato_id, epi_id, estoque, empresa_id"),
    (supabase.from as any)("empresa_config").select("id, nome, tipo, empresa_pai_id"),
    (supabase.from as any)("estoque_movimentacoes")
      .select("id, epi_id, quantidade, valor_unitario, tipo, created_at, empresa_id")
      .order("created_at", { ascending: true }),
  ]);

  if (!movimentacoes.error) setCachedData("dashboard_movimentacoes", movimentacoes.data || []);
  if (!contratos.error) setCachedData("dashboard_contratos", contratos.data || []);
  if (!profiles.error) setCachedData("dashboard_profiles", profiles.data || []);
  if (!contratoEpis.error) setCachedData("dashboard_contrato_epis", contratoEpis.data || []);
  if (!unidades.error) setCachedData("dashboard_unidades", unidades.data || []);
  if (!estoqueMovimentacoes.error) setCachedData("dashboard_estoque_mov", estoqueMovimentacoes.data || []);
}

export async function prefetchStockOfflineData({ empresaId, contratoId, restricted }: StockPrefetchOptions) {
  const hierarchy = restricted
    ? await buildRestrictedHierarchy(empresaId, contratoId)
    : await buildFullHierarchy(empresaId);

  const hierarchyKey = restricted
    ? `stock-hierarchy:restricted:${empresaId || "sem-empresa"}:${contratoId || "sem-contrato"}`
    : `stock-hierarchy:full:${empresaId || "global"}`;

  setOfflineViewCache(hierarchyKey, hierarchy);

  const unitsToPrefetch = hierarchy.unidades.filter((unidade) => {
    if (restricted) return true;
    if (!hierarchy.matrizId) return true;
    return unidade.id === hierarchy.matrizId || unidade.empresa_pai_id === hierarchy.matrizId;
  });

  await Promise.allSettled(
    unitsToPrefetch.map(async (unidade) => {
      const unidadeContratos = hierarchy.contratos.filter((contrato) => contrato.unidade_id === unidade.id);
      const unidadeSummary = await buildUnitSummary(unidade.id, unidadeContratos, hierarchy.unidades);
      const unitCacheKey = `stock-unit:${unidade.id}:${unidadeContratos.map((contrato) => contrato.id).sort().join(",")}`;

      setOfflineViewCache(unitCacheKey, unidadeSummary);

      await Promise.allSettled(
        unidadeContratos.map(async (contrato) => {
          const details = await buildContractDetails(contrato.id);
          setOfflineViewCache(`stock-contract:${contrato.id}`, details);
        }),
      );
    }),
  );
}