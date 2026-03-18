import { supabase } from "@/integrations/supabase/client";

const OUTGOING_ENTREGA_TYPES = new Set(["entrega", "troca", "substituicao", "perda", "dano"]);

interface SyncContractStockParams {
  funcionarioId: string;
  epiId: string;
  quantidade: number;
  tipo: string;
  empresaId?: string | null;
  observacao?: string | null;
  createdBy?: string | null;
  responsavelNome?: string | null;
}

const movimentoLabel: Record<string, string> = {
  entrega: "Entrega",
  troca: "Troca",
  substituicao: "Substituição",
  devolucao: "Devolução",
  perda: "Perda",
  dano: "Dano",
};

export async function syncContractStockFromEntrega({
  funcionarioId,
  epiId,
  quantidade,
  tipo,
  empresaId = null,
  observacao = null,
  createdBy = null,
  responsavelNome = null,
}: SyncContractStockParams) {
  if (!funcionarioId || !epiId || quantidade <= 0) {
    return { applied: false as const, reason: "invalid_payload" as const };
  }

  const isOutgoing = OUTGOING_ENTREGA_TYPES.has(tipo);
  const isReturn = tipo === "devolucao";

  if (!isOutgoing && !isReturn) {
    return { applied: false as const, reason: "unsupported_type" as const };
  }

  const { data: funcionario, error: funcionarioError } = await (supabase.from as any)("funcionarios")
    .select("contrato_id, empresa_id")
    .eq("id", funcionarioId)
    .maybeSingle();

  if (funcionarioError) throw funcionarioError;
  if (!funcionario?.contrato_id) {
    return { applied: false as const, reason: "no_contract" as const };
  }

  const { data: contratoEpi, error: contratoEpiError } = await (supabase.from as any)("contrato_epis")
    .select("id, contrato_id, empresa_id, estoque")
    .eq("contrato_id", funcionario.contrato_id)
    .eq("epi_id", epiId)
    .maybeSingle();

  if (contratoEpiError) throw contratoEpiError;
  if (!contratoEpi) {
    return { applied: false as const, reason: "no_contract_epi" as const };
  }

  const nextStock = isReturn
    ? Number(contratoEpi.estoque || 0) + quantidade
    : Math.max(Number(contratoEpi.estoque || 0) - quantidade, 0);

  const { error: updateError } = await (supabase.from as any)("contrato_epis")
    .update({ estoque: nextStock })
    .eq("id", contratoEpi.id);

  if (updateError) throw updateError;

  const motivoBase = `${movimentoLabel[tipo] || tipo} via módulo de entregas`;
  const motivo = observacao ? `${motivoBase} — ${observacao}` : motivoBase;

  const { error: movimentoError } = await (supabase.from as any)("contrato_epis_movimentacoes").insert({
    contrato_epi_id: contratoEpi.id,
    contrato_id: contratoEpi.contrato_id,
    epi_id: epiId,
    empresa_id: contratoEpi.empresa_id ?? funcionario.empresa_id ?? empresaId,
    tipo: isReturn ? "entrada" : "saida",
    quantidade,
    motivo,
    responsavel_nome: responsavelNome,
    created_by: createdBy,
  });

  if (movimentoError) {
    console.error("Failed to record contract stock movement:", movimentoError);
  }

  return {
    applied: true as const,
    contratoId: contratoEpi.contrato_id,
    contratoEpiId: contratoEpi.id,
    nextStock,
  };
}
