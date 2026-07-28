import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getCachedData, setCachedData } from "@/lib/offlineStorage";
import { mensagemErro } from "@/lib/erroSupabase";
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
  SstAtividade,
  formatarEndereco,
} from "@/types/sst";

/**
 * Traduz um estabelecimento do Núcleo Mestre para o formato de empresa_config.
 *
 * Não é uma cópia campo-a-campo: os dois cadastros usam vocabulários diferentes.
 *  - `tipo` em sst_estabelecimentos é proprio|terceiro|obra|administrativo;
 *    em empresa_config é matriz|filial. Copiar direto corromperia o cadastro
 *    de empresas e a árvore usada pela RLS.
 *  - `endereco` é jsonb de um lado e colunas decompostas + texto legado do outro.
 *  - `empresa_id`, `cno` e `qtd_trabalhadores` não existem em empresa_config e
 *    precisam ser removidos, sob pena de o upsert falhar por coluna inexistente.
 */
function mapEstabelecimentoParaEmpresaConfig(activeEmpresaId: string) {
  return (payload: any) => {
    const ehMatriz = payload.id === activeEmpresaId;
    const end = payload.endereco || {};
    const resp = payload.responsavel_legal || {};
    return {
      id: payload.id,
      nome: payload.nome,
      nome_fantasia: payload.nome_fantasia ?? null,
      cnpj: payload.cnpj ?? null,
      cnae_principal: payload.cnae_principal ?? null,
      cnae_secundario: payload.cnae_secundario ?? null,
      grau_risco: payload.grau_risco ?? null,
      telefone: payload.telefone ?? null,
      email: payload.email ?? null,
      // Endereço decomposto + texto corrido mantido para leitores legados.
      logradouro: end.logradouro ?? null,
      numero: end.numero ?? null,
      complemento: end.complemento ?? null,
      bairro: end.bairro ?? null,
      cidade: end.cidade ?? null,
      uf: end.uf ?? null,
      cep: end.cep ?? null,
      endereco: formatarEndereco(end) || null,
      nome_representante_legal: resp.nome ?? null,
      cpf_representante_legal: resp.cpf ?? null,
      // A matriz nunca vira filial de si mesma.
      tipo: ehMatriz ? "matriz" : "filial",
      empresa_pai_id: ehMatriz ? null : activeEmpresaId,
    };
  };
}

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
  // Quando true, o cache local NÃO conta como sucesso: se nem a tabela primária
  // nem a legada aceitaram o registro, a função lança. Usado onde o fallback de
  // localStorage seria enganoso — a tela diria "Salvo com sucesso" e o dado
  // sumiria no próximo navegador. Ver saveAtividadeMutation.
  exigirPersistencia = false,
): Promise<T> {
  const itemId = item.id || crypto.randomUUID();
  const payload: any = {
    ...item,
    id: itemId,
    empresa_id: empresaId,
  };

  let result: T | null = null;
  let primarySucceeded = false;
  let ultimoErro: any = null;

  // 1. Tabela primária (Núcleo Mestre): UPSERT, nunca update-ou-insert.
  //
  // Antes, um item COM id virava UPDATE ... WHERE id = <id>. As listas da tela
  // são a união da tabela do Núcleo Mestre com as tabelas legadas (aso_funcoes,
  // aso_setores, ghe_ges, empresa_config), então um registro legado aparece na
  // lista COM id — mas esse id não existe em sst_funcoes/sst_setores. O UPDATE
  // acertava 0 linhas, o .single() devolvia erro, e a gravação caía na tabela
  // legada; lá o payload novo (processo_id, atividades_criticas, setor_id
  // apontando para sst_setores) não encaixa no schema antigo, então também
  // falhava — e a edição terminava só no localStorage, sem nunca chegar ao
  // banco. Sintoma: escolher o Setor Principal de uma função e, depois de
  // "salvar com sucesso", a coluna Setor continuar mostrando "-".
  //
  // Com upsert, editar um registro legado o materializa no Núcleo Mestre com o
  // MESMO id. unionById prioriza a tabela primária, então a edição aparece.
  try {
    const res = await supabase
      .from(tableName as any)
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (!res.error && res.data) {
      result = res.data as T;
      primarySucceeded = true;
    } else {
      ultimoErro = res.error;
      console.warn(`Primary save to ${tableName} notice:`, res.error?.message);
    }
  } catch (e: any) {
    ultimoErro = e;
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

  // Nada foi aceito pelo banco. Onde o cache local não serve como resposta,
  // propaga o erro real em vez de deixar a tela dizer "Salvo com sucesso".
  if (exigirPersistencia) {
    throw ultimoErro || new Error("Não foi possível gravar no banco.");
  }

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

  const { data: atividades = [], isLoading: loadingAtividades } =
    useSupabaseQuery<SstAtividade>("sst_atividades", "nome", true);

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

  // empresa_config projetada como estabelecimento tipo='proprio'. Como o
  // espelhamento usa o MESMO id nas duas tabelas, a união por id converge:
  // o registro do Núcleo Mestre tem precedência e o de empresa_config só
  // aparece enquanto ainda não foi espelhado.
  //
  // Campos ausentes ficam null de propósito — não se inventa CNPJ, CNAE nem
  // cidade para preencher tela: dado ausente precisa aparecer como ausente.
  const legacyEmpresasAsSst: SstEstabelecimento[] = legacyEmpresasConfig.map((ec: any) => ({
    id: ec.id,
    empresa_id: activeEmpresaId || ec.id,
    nome: ec.nome,
    tipo: "proprio",
    nome_fantasia: ec.nome_fantasia ?? null,
    cnpj: ec.cnpj ?? null,
    cno: null,
    cnae_principal: ec.cnae_principal ?? null,
    cnae_secundario: ec.cnae_secundario ?? null,
    grau_risco: ec.grau_risco ?? null,
    telefone: ec.telefone ?? null,
    email: ec.email ?? null,
    endereco: {
      logradouro: ec.logradouro ?? null,
      numero: ec.numero ?? null,
      complemento: ec.complemento ?? null,
      bairro: ec.bairro ?? null,
      cidade: ec.cidade ?? null,
      uf: ec.uf ?? null,
      cep: ec.cep ?? null,
    },
    responsavel_legal: {
      nome: ec.nome_representante_legal ?? null,
      cpf: ec.cpf_representante_legal ?? null,
    },
  }));
  const effectiveEstabelecimentos = unionById(estabelecimentos, legacyEmpresasAsSst);

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
  //
  // FONTE ÚNICA: empresa_config é a tabela de identidade da empresa — é dela que
  // o PGR, o LTCAT, o PPP, o dashboard e as políticas de RLS já leem. Um
  // estabelecimento tipo='proprio' (matriz ou filial) é, portanto, espelhado em
  // empresa_config com o MESMO id, para que o usuário digite uma única vez.
  //
  // Os demais tipos (terceiro, obra, administrativo) NÃO são espelhados: eles não
  // são pessoas jurídicas do tenant e criariam empresas fantasma no cadastro,
  // poluindo seletores de empresa e a árvore usada pela RLS.
  const saveEstabelecimentoMutation = useMutation({
    mutationFn: async (estabelecimento: Partial<SstEstabelecimento>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      const ehProprio = (estabelecimento.tipo || "proprio") === "proprio";
      return resilientSaveItem(
        "sst_estabelecimentos",
        ehProprio ? "empresa_config" : null,
        estabelecimento,
        activeEmpresaId,
        mapEstabelecimentoParaEmpresaConfig(activeEmpresaId),
        ehProprio,
      );
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

  // SAVE ATIVIDADE MUTATION
  // Sem tabela legada: a atividade não existia antes como entidade, então não há
  // nada para espelhar — o texto solto em sst_funcoes.descricao_atividades
  // continua onde está, servindo de resumo da função.
  const saveAtividadeMutation = useMutation({
    mutationFn: async (atividade: Partial<SstAtividade>) => {
      if (!activeEmpresaId) throw new Error("Nenhuma empresa ativa selecionada.");
      if (!(atividade.nome || "").trim()) throw new Error("Informe o nome da atividade.");
      // exigirPersistencia: a tabela sst_atividades só existe depois da migration
      // pendente. Sem isto, a gravação caía no cache do navegador e a tela dizia
      // "Atividade salva no Núcleo Mestre!" — o cadastro sumia em outro
      // dispositivo e o PGR nunca via a atividade.
      return resilientSaveItem("sst_atividades", null, atividade, activeEmpresaId, undefined, false, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_atividades"] });
      toast({ title: "Sucesso", description: "Atividade salva no Núcleo Mestre!" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar atividade",
        description: mensagemErro(err, "Atividade"),
        variant: "destructive",
      });
    },
  });

  // DELETE MUTATIONS
  const deleteAtividadeMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_atividades").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_atividades"] });
      toast({ title: "Sucesso", description: "Atividade removida." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteEstabelecimentoMutation = useMutation({
    mutationFn: async (id: string) => {
      const ehProprio = estabelecimentos.find((e) => e.id === id)?.tipo === "proprio";
      await supabase.from("sst_estabelecimentos").delete().eq("id", id);
      if (ehProprio) {
        await supabase.from("empresa_config").delete().eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_estabelecimentos"] });
      queryClient.invalidateQueries({ queryKey: ["sst-legacy-empresa-config"] });
      toast({ title: "Sucesso", description: "Estabelecimento removido." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteAmbienteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_ambientes").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_ambientes"] });
      toast({ title: "Sucesso", description: "Ambiente removido." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteSetorMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_setores").delete().eq("id", id);
      await supabase.from("aso_setores").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_setores"] });
      toast({ title: "Sucesso", description: "Setor removido." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteProcessoMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_processos").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_processos"] });
      toast({ title: "Sucesso", description: "Processo removido." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteFuncaoMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_funcoes").delete().eq("id", id);
      await supabase.from("aso_funcoes").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_funcoes"] });
      toast({ title: "Sucesso", description: "Função removida." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteGesMutation = useMutation({
    mutationFn: async (id: string) => {
      // O .delete() do supabase-js NÃO lança: devolve { error }. Ignorar isso
      // fazia a tela dizer "GES/GHE removido." com a linha ainda no banco.
      //
      // A ordem importa. funcionarios.ghe_id referencia ghe_ges.id, então a
      // chave estrangeira barra a exclusão de um GES com gente vinculada — mas
      // só em ghe_ges. Apagando sst_ges primeiro, o caso "tem trabalhador"
      // apagava metade: o registro sumia de sst_ges (levando junto o critério
      // de agrupamento) e continuava em ghe_ges, de onde a lista o traz de
      // volta pelo espelho legado. Para o usuário, nada acontecia — e o
      // critério tinha sido destruído em silêncio.
      //
      // Começando pela tabela restrita, o caso bloqueado para antes de tocar
      // em qualquer coisa.
      const legado = await supabase.from("ghe_ges").delete().eq("id", id);
      if (legado.error) {
        if (String(legado.error.code) === "23503") {
          throw new Error(
            "Este GES não pode ser excluído porque há trabalhadores vinculados a ele. "
            + "Mova essas pessoas para outro grupo antes de excluir.",
          );
        }
        throw legado.error;
      }
      const principal = await supabase.from("sst_ges").delete().eq("id", id);
      if (principal.error) throw principal.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_ges"] });
      queryClient.invalidateQueries({ queryKey: ["supabase", "ghe_ges"] });
      queryClient.invalidateQueries({ queryKey: ["cad-ghe-list"] });
      toast({ title: "Sucesso", description: "GES/GHE removido." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  const deleteExposicaoMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("sst_exposicoes").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase", "sst_exposicoes"] });
      toast({ title: "Sucesso", description: "Exposição removida." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  return {
    estabelecimentos: effectiveEstabelecimentos,
    ambientes,
    setores: effectiveSetores,
    processos,
    funcoes: effectiveFuncoes,
    atividades,
    gesList: effectiveGesList,
    gesVinculos,
    perigosCatalogo,
    exposicoes: effectiveExposicoes,
    activeEmpresaId,
    isLoading:
      loadingEstabelecimentos ||
      loadingAmbientes ||
      loadingSetores ||
      loadingProcessos ||
      loadingFuncoes ||
      loadingAtividades ||
      loadingGes ||
      loadingGesVinculos ||
      loadingPerigos ||
      loadingExposicoes,
    saveAtividade: saveAtividadeMutation.mutateAsync,
    deleteAtividade: deleteAtividadeMutation.mutateAsync,
    saveEstabelecimento: saveEstabelecimentoMutation.mutateAsync,
    saveAmbiente: saveAmbienteMutation.mutateAsync,
    saveSetor: saveSetorMutation.mutateAsync,
    saveProcesso: saveProcessoMutation.mutateAsync,
    saveFuncao: saveFuncaoMutation.mutateAsync,
    saveGes: saveGesMutation.mutateAsync,
    saveExposicao: saveExposicaoMutation.mutateAsync,
    deleteEstabelecimento: deleteEstabelecimentoMutation.mutateAsync,
    deleteAmbiente: deleteAmbienteMutation.mutateAsync,
    deleteSetor: deleteSetorMutation.mutateAsync,
    deleteProcesso: deleteProcessoMutation.mutateAsync,
    deleteFuncao: deleteFuncaoMutation.mutateAsync,
    deleteGes: deleteGesMutation.mutateAsync,
    deleteExposicao: deleteExposicaoMutation.mutateAsync,
  };
}
