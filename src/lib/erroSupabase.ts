/**
 * Tradução de erros do Postgres para mensagem útil ao usuário.
 *
 * O caso que motivou este arquivo: código novo entra no ar antes das migrations
 * serem aplicadas. O insert então falha com
 *
 *   'column "atividade_id" of relation "pgr_levantamento_preliminar" does not exist'
 *
 * que aparece num toast, em inglês, e não diz a ninguém o que fazer. Pior: o
 * usuário conclui que o sistema perdeu o cadastro dele.
 *
 * Aqui esse caso vira uma frase que diz o que aconteceu e o que resolve, sem
 * mascarar o erro — o original continua indo para o console.
 */

/** 42P01 = tabela não existe. 42703 = coluna não existe. */
const CODIGOS_SCHEMA = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

export function ehSchemaDesatualizado(e: any): boolean {
  if (!e) return false;
  if (CODIGOS_SCHEMA.has(String(e.code))) return true;
  const m = `${e.message || ""} ${e.details || ""}`.toLowerCase();
  return (
    m.includes("does not exist")
    || m.includes("could not find the")
    || m.includes("schema cache")
  );
}

/**
 * Mensagem pronta para toast. Devolve a original quando o erro não é de schema —
 * engolir a mensagem real esconderia falhas de validação e de permissão.
 */
export function mensagemErro(e: any, contexto?: string): string {
  if (ehSchemaDesatualizado(e)) {
    console.warn("[schema] estrutura do banco desatualizada:", e);
    return (
      `${contexto ? contexto + ": " : ""}o banco ainda não tem a estrutura que esta tela usa. `
      + "As migrations pendentes precisam ser aplicadas no Supabase. Nada foi perdido — "
      + "os dados já cadastrados continuam intactos."
    );
  }
  return e?.message || "Falha inesperada. Tente novamente.";
}

/**
 * Confere se as estruturas exigidas pelas telas novas já existem no banco.
 *
 * Uma leitura barata (`head: true`, sem trazer linha) por tabela. Serve para
 * avisar ANTES de o usuário preencher um formulário inteiro e só então descobrir
 * que não dá para salvar.
 */
export async function verificarEstruturasSst(
  supabase: any,
): Promise<{ ok: boolean; faltando: string[] }> {
  const exigidas = ["sst_atividades", "sst_coletas_campo"];
  const faltando: string[] = [];
  await Promise.all(
    exigidas.map(async (t) => {
      try {
        const { error } = await supabase.from(t).select("id", { count: "exact", head: true });
        // Só falta de estrutura conta. Erro de permissão ou de rede não deve
        // acusar migration pendente — seriam avisos falsos e recorrentes.
        if (error && ehSchemaDesatualizado(error)) faltando.push(t);
      } catch { /* rede fora: não é problema de schema */ }
    }),
  );
  return { ok: faltando.length === 0, faltando };
}
