import { DADOS } from "./stubDados";

export function useSupabaseQuery<T = any>(tabela: string) {
  return {
    data: (DADOS[tabela] || []) as T[],
    loading: false, refreshing: false, verificado: true,
    refetch: async () => {},
  };
}

export function useSupabaseCrud<T = any>(tabela: string) {
  return {
    ...useSupabaseQuery<T>(tabela),
    add: async () => {}, update: async () => {}, remove: async () => {},
  };
}
