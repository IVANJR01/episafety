/* Cliente de banco falso: a vitrine não fala com servidor nenhum. */

/**
 * Linhas fictícias por tabela. Tabela fora daqui volta vazia.
 * Quem monta a tela preenche antes de renderizar.
 */
export const dadosPorTabela: Record<string, any[]> = {};

const vazio = (tabela?: string) => {
  const linhas = () => (tabela && dadosPorTabela[tabela]) || [];
  const e: any = {
    select: () => e, eq: () => e, in: () => e, not: () => e, is: () => e,
    order: () => e, limit: () => e, neq: () => e, or: () => e, ilike: () => e,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => e, update: () => e, delete: () => e,
    then: (ok: any) => Promise.resolve({ data: linhas(), error: null }).then(ok),
  };
  return e;
};
export const supabase: any = {
  from: (tabela: string) => vazio(tabela),
  rpc: () => Promise.resolve({ data: [], error: null }),
  auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
};
