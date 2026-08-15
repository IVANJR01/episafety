import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Avisar as telas quando uma tabela muda, sem ninguém apertar "atualizar".
 *
 * O problema que isto resolve: colaborador cadastrado num aparelho não
 * aparecia no outro. A lista só recarregava ao montar a tela, ao voltar o foco
 * da janela ou ao reconectar — tela aberta parada nunca ficava sabendo. No
 * aplicativo instalado do celular, que passa horas em segundo plano, isso vira
 * "o cadastro sumiu".
 *
 * Um canal POR TABELA, não por tela. Oito telas leem `funcionarios`; abrir oito
 * canais para a mesma tabela gastaria oito conexões para receber o mesmo aviso
 * oito vezes. A contagem de uso mantém o canal vivo enquanto alguém precisa
 * dele e o fecha quando o último sai.
 */

interface Inscricao {
  canal: RealtimeChannel;
  ouvintes: Set<() => void>;
}

const canais = new Map<string, Inscricao>();

/**
 * Passa a ouvir mudanças em `tabela`. Devolve a função que cancela.
 *
 * `aoMudar` é chamada em INSERT, UPDATE e DELETE. Ela não recebe a linha de
 * propósito: quem escuta recarrega a consulta inteira, que é a única forma de
 * respeitar o filtro por empresa e a ordenação sem reimplementá-los aqui.
 */
export function assinarTabela(tabela: string, aoMudar: () => void): () => void {
  let inscricao = canais.get(tabela);

  if (!inscricao) {
    const ouvintes = new Set<() => void>();
    const canal = supabase
      .channel(`tabela:${tabela}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: tabela },
        () => { ouvintes.forEach((f) => f()); },
      )
      .subscribe();
    inscricao = { canal, ouvintes };
    canais.set(tabela, inscricao);
  }

  inscricao.ouvintes.add(aoMudar);

  return () => {
    const atual = canais.get(tabela);
    if (!atual) return;
    atual.ouvintes.delete(aoMudar);
    if (atual.ouvintes.size === 0) {
      canais.delete(tabela);
      try { supabase.removeChannel(atual.canal); } catch { /* já removido */ }
    }
  };
}

/** Quantos canais estão abertos agora. Existe para o teste e para depuração. */
export function canaisAbertos(): string[] {
  return [...canais.keys()].sort();
}

/** Fecha tudo — usado na troca de empresa e na saída da conta. */
export function fecharTodosOsCanais(): void {
  canais.forEach(({ canal }) => {
    try { supabase.removeChannel(canal); } catch { /* já removido */ }
  });
  canais.clear();
}
