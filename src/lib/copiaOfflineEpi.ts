/*
 * Cópia automática dos dados da Gestão de EPIs no aparelho.
 *
 * Antes, a lista de Entregas só existia sem internet se a pessoa tivesse
 * aberto ESSA tela, com internet, NESSA empresa, nos últimos dias. Quem
 * abria o sistema no início do dia (na tela inicial), saía para a obra e
 * desligava o Wi-Fi encontrava "Nenhuma entrega registrada".
 *
 * Agora, sempre que há internet (depois do login, ao trocar de empresa, ao
 * voltar o sinal e a cada 10 minutos com o sistema aberto), o sistema
 * guarda sozinho entregas, colaboradores, EPIs e solicitações — nas mesmas
 * gavetas que cada tela lê quando abre sem internet.
 */
import { supabase } from "@/integrations/supabase/client";
import { buscarTabelaEGuardar } from "@/hooks/useSupabaseData";
import { cachedQuery } from "@/lib/offlineStorage";
import { COLUNAS_DA_LISTA_DE_ENTREGAS } from "@/lib/entregasLeves";

/** A busca da tela de Solicitações — a tela e a cópia usam a mesma. */
export function buscarSolicitacoes(empresaId: string) {
  return cachedQuery<any>(`solicitacoes_materiais:${empresaId}`, () =>
    supabase
      .from("solicitacoes_materiais")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }) as any);
}

/**
 * Cada item repete os parâmetros da tela que o lê (mesma gaveta). Mudou a
 * consulta da tela? Mude aqui também — o teste copiaOfflineEpi.test.ts
 * confere as gavetas.
 */
export function tabelasDaCopia(escopoEmpresas: string[]) {
  return [
    // Entregas.tsx — useSupabaseCrud("entregas", "created_at", undefined, COLUNAS...)
    { table: "entregas", orderBy: "created_at", columns: COLUNAS_DA_LISTA_DE_ENTREGAS, gavetaDaTabela: true, escopoEmpresas },
    // Entregas.tsx, Relatorios.tsx — useSupabaseQuery("funcionarios") / ("epis")
    { table: "funcionarios", escopoEmpresas },
    { table: "epis", escopoEmpresas },
  ];
}

let emAndamento: Promise<void> | null = null;

export function guardarCopiaOfflineEpi(escopoEmpresas: string[], empresaId: string | null): Promise<void> {
  if (escopoEmpresas.length === 0 || !navigator.onLine) return Promise.resolve();
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    // Uma de cada vez: não disputa a internet com a tela que está aberta.
    for (const t of tabelasDaCopia(escopoEmpresas)) {
      try { await buscarTabelaEGuardar(t); } catch { /* sinal caiu: tenta na próxima vez */ }
    }
    if (empresaId) {
      try { await buscarSolicitacoes(empresaId); } catch { /* idem */ }
    }
  })().finally(() => { emAndamento = null; });
  return emAndamento;
}
