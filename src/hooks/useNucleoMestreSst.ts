import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedData, setCachedData } from "@/lib/offlineStorage";
import {
  SstEstabelecimento,
  SstAmbiente,
  SstSetor,
  SstProcesso,
  SstFuncao,
  SstGes,
  SstGesVinculo,
  SstExposicao,
  SstPerigoCatalogo,
} from "@/types/sst";

async function resilientSaveItem<T extends { id?: string }>(
  tableName: string,
  legacyTableName: string | null,
  item: Partial<T>,
  empresaId: string,
  legacyFieldMap?: (item: any) => any,
  // Quando true, o registro é sempre replicado (upsert) na tabela legada,
  // mesmo quando o salvamento na tabela primária (Núcleo Mestre) tem sucesso.
  // Necessário para GES/GHE: outros módulos (ex.: ASO/RH) ainda leem da
  // tabela legada via FK (funcionarios.ghe_id -> ghe_ges.id), então o
  // registro precisa existir com o MESMO id nas duas tabelas.
  alwaysMirrorToLegacy = false,
): Promise<T> {
  const itemId = item.id || crypto.randomUUID();
  const payload: any = {
    ...item,
    id: itemId,
    empresa_id: empresaId,
  };

  let result: T | null = null;
  let primarySucceeded = false;

  // 1. Try primary table insert / update
  try {
    const res = item.id
      ? await supabase.from(tableName as any).update(payload).eq("id", item.id).select().single()
      : await supabase.from(tableName as any).insert(payload).select().single();
    if (!res.error && res.data) {
      result = res.data as T;
      primarySucceeded = true;
    } else {
      console.warn(`Primary save to ${tableName} notice:`, res.error?.message);
    }
  } catch (e: any) {
    console.warn(`Primary save to ${tableName} failed:`, e?.message);
  }

  // 2. Legacy table: fallback (se a primária falhou) ou espelhamento (se alwaysMirrorToLegacy)
  if (legacyTableName && (!primarySucceeded || alwaysMirrorToLegacy)) {
    try {
      const legacyPayload = legacyFieldMap ? legacyFieldMap(payload) : payload;
      const res = await supabase
        .from(legacyTableName as any)
        .upsert(legacyPayload, { onConflict: "id" })
        .select()
        .single();
      if (!res.error && res.data) {
        if (!primarySucceeded) {
          result = res.data as T;
          primarySucceeded = true;
        }
      } else if (res.error) {
        console.warn(`Legacy save to ${legacyTableName} failed:`, res.error.message);
      }
    } catch (e: any) {
      console.warn(`Legacy save to ${legacyTableName} failed:`, e?.message);
    }
  }

  if (primarySucceeded && result) return result;

  // 3. Fallback: Save to Local Storage Cache
  try {
    const currentCached = getCachedData<any>(tableName) || [];
    const existingIndex = currentCached.findIndex((c: any) => c.id === itemId);
    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...currentCached];
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...payload };
    } else {
      updatedList = [payload, ...currentCached];
    }
    setCachedData(tableName, updatedList);
  } catch (e) {
    console.warn("Local View Cache save warning:", e);
  }

  return payload as T;
}

/** Une duas listas de mesmo formato por `id`, priorizando o registro da fonte primária em caso de conflito. */
function unionById<T extends { id: string }>(primary: T[], legacy: T[]): T[] {
  const seen = new Set(primary.map((p) => p.id));
  return [...primary, ...legacy.filter((l) => !seen.has(l.id))];
}

export function useNucleoMestreSst() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId: authEmpresaId, empresasIds, isSuperAdmin } = useAuth();
  const searchEmpresaId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("empresa_id") : null;
  // ISOLAMENTO POR EMPRESA: só aceita o empresa_id da URL se o usuário for
  // realmente autorizado para essa empresa (super_admin ou empresa vinculada).
  // Sem essa checagem, um empresa_id arbitrário na URL seria usado como
  // empresa_id de gravação — o RLS bloquearia a escrita, mas é melhor nunca
  // deixar o cliente nem tentar montar esse payload.
  const searchEmpresaAutorizada = !!searchEmpresaId && (isSuperAdmin || (empresasIds || []).includes(searchEmpresaId));
  const activeEmpresaId = searchEmpresaAutorizada ? searchEmpresaId : authEmpresaId;

  // READ QUERIES
  const { data: estabelecimentos = [], isLoading: loadingEstabelecimentos } =
    useSupabaseQuery<SstEstabelecimento>("sst_estabelecimentos", "nome", true);

  const { data: ambientes = [], isLoading: loadingAmbientes } =
    useSupabaseQuery<SstAmbiente>("sst_ambientes", "nome", true);

  const { data: setores = [], isLoading: loadingSetores } =
    useSupabaseQuery<SstSetor>("sst_setores", "nome", true);

  const { data: processos = [], isLoading: loadingProcessos } =
    useSupabaseQuery<SstProcesso>("sst_processos", "nome", true);

  const { data: funcoes = [], isLoading: loadingFuncoes } =
    useSupabaseQuery<SstFuncao>("sst_funcoes", "nome", true);

  const { data: gesList = [], isLoading: loadingGes } =
    useSupabaseQuery<SstGes>("sst_ges", "nome", true);

  const { data: gesVinculos = [], isLoading: loadingGesVinculos } =
    useSupabaseQuery<SstGesVinculo>("sst_ges_vinculos");

  const { data: perigosCatalogo = [], isLoading: loadingPerigos } =
    useSupabaseQuery<SstPerigoCatalogo>("sst_perigos_catalogo", "nome_agente", true);

  const { data: exposicoes = [], isLoading: loadingExposicoes } =
    useSupabaseQuery<SstExposicao>("sst_exposicoes");

  // LEGACY FALLBACK QUERIES (Sincronização Automática de Unidades, CNO/CNPJ e GHEs Existentes)
  const { data: legacyEmpresasConfig = [] } = useQuery({
    queryKey: ["sst-legacy-empresa-config", activeEmpresaId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      if (!activeEmpresaId) return [];
      const { data, error } = await supabase
        .from("empresa_config")
        .select("*")
        .or(`id.eq.${activeEmpresaId},empresa_pai_id.eq.${activeEmpresaId}`);
      if (error) {
        console.error("Error fetching empresa_config for SST:", error);
        return [];
      }
      return data || [];
    },
  });
  const { data: legacyGhe = [] } = useSupabaseQuery<any>("ghe_ges", "nome", true);
  const { data: legacySetores = [] } = useSupabaseQuery<any>("aso_setores", "nome", true);
  const { data: legacyFuncoes = [] } = useSupabaseQuery<any>("aso_funcoes", "nome", true);
  const { data: legacyInventario = [] } = useSupabaseQuery<any>("pgr_inventario_itens");

  // NOTA: estabelecimentos usa "ou" (não "união") de propósito — legacyEmpresasConfig
  // é derivado 1:1 de empresa_config (matriz + filiais), então uma vez que o
  // Núcleo Mestre tenha estabelecimentos próprios cadastrados eles substituem
  // a visão sintética. Os demais (GES, setores, funções, exposições) usam
  // união por id para nunca esconder cadastros antigos feitos fora do Núcleo Mestre.
  const effectiveEstabelecimentos = estabelecimentos.length > 0 ? estabelecimentos : legacyEmpresasConfig.map((ec: any) => ({
    id: ec.id,
    empresa_id: activeEmpresaId || ec.id,
    codigo: ec.cno ? `CNO-${ec.cno}` : (ec.tipo === "matriz" || !ec.empresa_pai_id ? "SEDE-MATRIZ" : `FILIAL-${(ec.nome || "EST").substring(0, 5).toUpperCase()}`),
    nome: ec.nome,
    tipo_inscricao: ec.cno ? "cno" : "cnpj",
    numero_inscricao: ec.cno || ec.cnpj || "00.000.000/0000-00",
    cnae: ec.cnae || "4120-4/00",
    grau_risco: ec.grau_risco || 2,
    endereco_completo: ec.endereco || "Endereço principal cadastrado na unidade",
    cidade: ec.cidade || "João Pessoa",
    uf: ec.uf || "PB",
  }));

  const legacyGesAsSst = legacyGhe.map((g: any) => ({
    id: g.id,
    empresa_id: g.empresa_id,
    codigo: g.codigo || `GHE-${g.nome.substring(0, 5).toUpperCase()}`,
    nome: g.nome,
    descricao: g.descricao || g.descricao_ambiente || "GHE importado da base legada",
    criterio_agrupamento: g.processo ? `Processo: ${g.processo}` : "Importado automaticamente do cadastro de GHE existente",
    validade_inicio: g.created_at ? g.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
  }));
  const effectiveGesList = unionById(gesList, legacyGesAsSst);

  const legacySetoresAsSst = legacySetores.map((s: any) => ({
    id: s.id,
    empresa_id: s.empresa_id,
    nome: s.nome,
    descricao: s.descricao || "Setor importado do cadastro existente",
  }));
  const effectiveSetores = unionById(setores, legacySetoresAsSst);

  const legacyFuncoesAsSst = legacyFuncoes.map((f: any) => ({
    id: f.id,
    empresa_id: f.empresa_id,
    nome: f.nome,
    cbo: f.cbo || "-",
    descricao_atividades: f.descricao_atividades || "Atividades importadas da função existente",
    exige_nr10: !!f.exige_nr10,
    exige_nr33: !!f.exige_nr33,
    exige_nr35: !!f.exige_nr35,
  }));
  const effectiveFuncoes = unionById(funcoes, legacyFuncoesAsSst);

  const legacyExposicoesAsSst = legacyInventario.map((inv: any) => ({
    id: inv.id,
    empresa_id: inv.empresa_id,
    nivel_origem: inv.ghe_id ? "ges" : "funcao",
    ges_id: inv.ghe_id || null,
    fonte_geradora: inv.perigo_descricao || inv.fonte_geradora || "Perigo Mapeado",
    tipo_exposicao: inv.tipo_exposicao || "habitual_permanente",
    severidade: inv.severidade || 3,
    probabilidade: inv.probabilidade || 2,
    epi_eficacia_conclusao: inv.epi ? "eficaz" : "nao_avaliada",
  }));
  const effectiveExposicoes = unionById(exposicoes, legacyExposicoesAsSst);

  // SAVE ESTABELECIMENTO MUTATION
  const saveEstabelecimentoMutation = useMutation({
    mutationFn: async (estabelecimento: Partial<SstEstabelecimento>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_estabelecimentos", "empresa_config", estabelecimento, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_estabelecimentos"] });
      queryClient.invalidateQueries({ queryKey: ["sst-legacy-empresa-config"] });
      toast({ title: "Sucesso", description: "Estabelecimento salvo no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar estabelecimento", description: err.message, variant: "destructive" });
    },
  });

  // SAVE AMBIENTE MUTATION
  const saveAmbienteMutation = useMutation({
    mutationFn: async (ambiente: Partial<SstAmbiente>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_ambientes", null, ambiente, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_ambientes"] });
      toast({ title: "Sucesso", description: "Ambiente de trabalho salvo com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar ambiente", description: err.message, variant: "destructive" });
    },
  });

  // SAVE SETOR MUTATION
  const saveSetorMutation = useMutation({
    mutationFn: async (setor: Partial<SstSetor>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_setores", "aso_setores", setor, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_setores"] });
      toast({ title: "Sucesso", description: "Setor salvo no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar setor", description: err.message, variant: "destructive" });
    },
  });

  // SAVE PROCESSO MUTATION
  const saveProcessoMutation = useMutation({
    mutationFn: async (processo: Partial<SstProcesso>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_processos", null, processo, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_processos"] });
      toast({ title: "Sucesso", description: "Processo/Atividade salvo com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar processo", description: err.message, variant: "destructive" });
    },
  });

  // SAVE FUNCAO MUTATION
  const saveFuncaoMutation = useMutation({
    mutationFn: async (funcao: Partial<SstFuncao>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_funcoes", "aso_funcoes", funcao, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_funcoes"] });
      toast({ title: "Sucesso", description: "Função/Cargo cadastrado no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar função", description: err.message, variant: "destructive" });
    },
  });

  // SAVE GES MUTATION
  const saveGesMutation = useMutation({
    mutationFn: async (ges: Partial<SstGes>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem(
        "sst_ges",
        "ghe_ges",
        ges,
        activeEmpresaId,
        (g: any) => ({
          // Mesmo id do registro em sst_ges — evita duplicar o GES na lista
          // (união por id) e mantém os dois registros como a MESMA entidade.
          id: g.id,
          empresa_id: g.empresa_id,
          codigo: g.codigo || `GHE-${Math.floor(100 + Math.random() * 900)}`,
          nome: g.nome || "Novo GES",
          descricao: g.criterio_agrupamento || g.descricao || null,
          status: "ativo",
        }),
        // Sempre espelha em ghe_ges: o módulo ASO/RH (funcionarios.ghe_id -> ghe_ges)
        // precisa enxergar imediatamente todo GES criado/editado aqui no Inventário.
        true,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_ges"] });
      queryClient.invalidateQueries({ queryKey: ["supabase", "ghe_ges"] });
      queryClient.invalidateQueries({ queryKey: ["cad-ghe-list"] });
      toast({ title: "Sucesso", description: "GES/GHE salvo com sucesso no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar GES/GHE", description: err.message, variant: "destructive" });
    },
  });

  // SAVE EXPOSICAO MUTATION
  const saveExposicaoMutation = useMutation({
    mutationFn: async (exposicao: Partial<SstExposicao>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      return resilientSaveItem("sst_exposicoes", "pgr_inventario_itens", exposicao, activeEmpresaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_exposicoes"] });
      toast({ title: "Sucesso", description: "Exposição/Agente cadastrado no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar exposição", description: err.message, variant: "destructive" });
    },
  });

  return {
    estabelecimentos: effectiveEstabelecimentos,
    ambientes,
    setores: effectiveSetores,
    processos,
    funcoes: effectiveFuncoes,
    gesList: effectiveGesList,
    gesVinculos,
    perigosCatalogo,
    exposicoes: effectiveExposicoes,
    isLoading:
      loadingEstabelecimentos ||
      loadingAmbientes ||
      loadingSetores ||
      loadingProcessos ||
      loadingFuncoes ||
      loadingGes ||
      loadingGesVinculos ||
      loadingPerigos ||
      loadingExposicoes,
    saveEstabelecimento: saveEstabelecimentoMutation.mutateAsync,
    saveAmbiente: saveAmbienteMutation.mutateAsync,
    saveSetor: saveSetorMutation.mutateAsync,
    saveProcesso: saveProcessoMutation.mutateAsync,
    saveFuncao: saveFuncaoMutation.mutateAsync,
    saveGes: saveGesMutation.mutateAsync,
    saveExposicao: saveExposicaoMutation.mutateAsync,
  };
}
