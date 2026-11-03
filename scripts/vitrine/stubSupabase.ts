/* Cliente de banco falso: a vitrine não fala com servidor nenhum. */
const vazio = () => {
  const e: any = {
    select: () => e, eq: () => e, in: () => e, not: () => e, is: () => e,
    order: () => e, limit: () => e, neq: () => e, or: () => e, ilike: () => e,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => e, update: () => e, delete: () => e,
    then: (ok: any) => Promise.resolve({ data: [], error: null }).then(ok),
  };
  return e;
};
export const supabase: any = {
  from: () => vazio(),
  rpc: () => Promise.resolve({ data: [], error: null }),
  auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
};
