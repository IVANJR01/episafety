import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const { activeEmpresaId } = useAuth();

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
    estabelecimentos,
    ambientes,
    setores,
    processos,
    funcoes,
    gesList,
    gesVinculos,
    perigosCatalogo,
    exposicoes,
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
