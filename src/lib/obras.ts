import { supabase } from "@/integrations/supabase/client";
import { SEED_OBRAS } from "@/lib/obrasSeed";

/**
 * Próximo código da sequência OBR-NNN.
 *
 * O código era digitado à mão, e a sequência que já existia (OBR-001 a
 * OBR-005) só se mantinha porque alguém lembrava do último número. Contar a
 * partir do maior existente faz o campo sair do formulário sem a sequência se
 * perder — e códigos fora do padrão (importados, escritos de outro jeito)
 * simplesmente não entram na conta, em vez de quebrá-la.
 */
export function proximoCodigoObra(obras: { codigo?: string | null }[]): string {
  const maior = obras.reduce((max, o) => {
    const m = /^OBR-(\d+)$/i.exec((o.codigo || "").trim());
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `OBR-${String(maior + 1).padStart(3, "0")}`;
}

export interface NovaObra {
  empresaId: string;
  nome: string;
  cidade?: string | null;
  uf?: string | null;
  status?: string;
  userId?: string | null;
  /** Para calcular o próximo código — passe a lista já carregada na tela. */
  existentes: { codigo?: string | null }[];
}

/** Cria a obra e devolve a linha gravada, com o código já numerado. */
export async function criarObra(p: NovaObra) {
  const { data, error } = await (supabase.from as any)("obras")
    .insert({
      empresa_id: p.empresaId,
      nome: p.nome.trim(),
      codigo: proximoCodigoObra(p.existentes),
      cidade: p.cidade?.trim() || null,
      uf: p.uf?.trim().toUpperCase() || null,
      status: p.status || "ATIVA",
      created_by: p.userId || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Grava no banco as obras que ainda moram no código-fonte.
 *
 * `obrasSeed.ts` traz 16 obras com `empresa_id` chumbado, e a listagem as
 * juntava às do banco só na tela. O efeito era uma tela que parecia um
 * cadastro e não era: excluir respondia "este local ainda não foi salvo", e
 * empresa cliente nova — que não está na lista — abria a tela vazia.
 *
 * A gravação é idempotente por (empresa, nome), a mesma regra que a listagem
 * já usava para não mostrar a obra duas vezes. Roda sozinha ao abrir a tela e,
 * depois da primeira vez, não encontra mais nada para fazer.
 *
 * Nenhuma inspeção aponta para essas obras hoje, e não é por acaso:
 * `conformidades.obra_id` é UUID com chave estrangeira para `obras(id)`, e o
 * identificador do seed ("obra-cg3-001") nunca caberia ali. Por isso os ids
 * novos não quebram vínculo nenhum — não havia vínculo.
 */
export async function gravarObrasDoCodigo(
  empresaIds: string[],
  jaNoBanco: { nome: string }[],
  userId?: string | null,
): Promise<number> {
  const nomes = new Set(jaNoBanco.map((o) => o.nome.trim().toLowerCase()));
  const faltando = SEED_OBRAS.filter(
    (s) => empresaIds.includes(s.empresa_id) && !nomes.has(s.nome.trim().toLowerCase()),
  );
  if (faltando.length === 0) return 0;

  const { error } = await (supabase.from as any)("obras").insert(
    // endereco e observacoes vão junto mesmo tendo saído do formulário: o
    // texto continua no banco, para não sumir de quem já o tinha.
    faltando.map((s) => ({
      empresa_id: s.empresa_id,
      nome: s.nome,
      codigo: s.codigo,
      endereco: s.endereco,
      cidade: s.cidade,
      uf: s.uf,
      status: s.status,
      observacoes: s.observacoes,
      created_by: userId || null,
    })),
  );
  if (error) throw error;
  return faltando.length;
}
