import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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

export function useNucleoMestreSst() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId: authEmpresaId } = useAuth();
  const searchEmpresaId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("empresa_id") : null;
  const activeEmpresaId = searchEmpresaId || authEmpresaId;

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

  const effectiveGesList = gesList.length > 0 ? gesList : legacyGhe.map((g: any) => ({
    id: g.id,
    empresa_id: g.empresa_id,
    codigo: g.codigo || `GHE-${g.nome.substring(0, 5).toUpperCase()}`,
    nome: g.nome,
    descricao: g.descricao || g.descricao_ambiente || "GHE importado da base legada",
    criterio_agrupamento: g.processo ? `Processo: ${g.processo}` : "Importado automaticamente do cadastro de GHE existente",
    validade_inicio: g.created_at ? g.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
  }));

  const effectiveSetores = setores.length > 0 ? setores : legacySetores.map((s: any) => ({
    id: s.id,
    empresa_id: s.empresa_id,
    nome: s.nome,
    descricao: s.descricao || "Setor importado do cadastro existente",
  }));

  const effectiveFuncoes = funcoes.length > 0 ? funcoes : legacyFuncoes.map((f: any) => ({
    id: f.id,
    empresa_id: f.empresa_id,
    nome: f.nome,
    cbo: f.cbo || "-",
    descricao_atividades: f.descricao_atividades || "Atividades importadas da função existente",
    exige_nr10: !!f.exige_nr10,
    exige_nr33: !!f.exige_nr33,
    exige_nr35: !!f.exige_nr35,
  }));

  const effectiveExposicoes = exposicoes.length > 0 ? exposicoes : legacyInventario.map((inv: any) => ({
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

  // SAVE ESTABELECIMENTO MUTATION
  const saveEstabelecimentoMutation = useMutation({
    mutationFn: async (estabelecimento: Partial<SstEstabelecimento>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");

      const payload = {
        ...estabelecimento,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = estabelecimento.id
        ? await supabase.from("sst_estabelecimentos" as any).update(payload).eq("id", estabelecimento.id).select().single()
        : await supabase.from("sst_estabelecimentos" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_estabelecimentos"] });
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

      const payload = {
        ...ambiente,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = ambiente.id
        ? await supabase.from("sst_ambientes" as any).update(payload).eq("id", ambiente.id).select().single()
        : await supabase.from("sst_ambientes" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
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

      const payload = {
        ...setor,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = setor.id
        ? await supabase.from("sst_setores" as any).update(payload).eq("id", setor.id).select().single()
        : await supabase.from("sst_setores" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
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

      const payload = {
        ...processo,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = processo.id
        ? await supabase.from("sst_processos" as any).update(payload).eq("id", processo.id).select().single()
        : await supabase.from("sst_processos" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
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

      const payload = {
        ...funcao,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = funcao.id
        ? await supabase.from("sst_funcoes" as any).update(payload).eq("id", funcao.id).select().single()
        : await supabase.from("sst_funcoes" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
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

      const payload = {
        ...ges,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = ges.id
        ? await supabase.from("sst_ges" as any).update(payload).eq("id", ges.id).select().single()
        : await supabase.from("sst_ges" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_ges"] });
      toast({ title: "Sucesso", description: "GES/GHE cadastrado no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar GES/GHE", description: err.message, variant: "destructive" });
    },
  });

  // SAVE EXPOSICAO MUTATION
  const saveExposicaoMutation = useMutation({
    mutationFn: async (exposicao: Partial<SstExposicao>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");

      const payload = {
        ...exposicao,
        empresa_id: activeEmpresaId,
      };

      const { data, error } = exposicao.id
        ? await supabase.from("sst_exposicoes" as any).update(payload).eq("id", exposicao.id).select().single()
        : await supabase.from("sst_exposicoes" as any).insert(payload).select().single();

      if (error) throw error;
      return data;
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
