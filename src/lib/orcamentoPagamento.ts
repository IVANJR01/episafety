export type FormaPagamento =
  | "À vista"
  | "PIX"
  | "Boleto bancário"
  | "Cartão de débito"
  | "Cartão de crédito"
  | "50% na aprovação + 50% na entrega"
  | "30% na aprovação + 70% na entrega"
  | "Entrada + parcelamento"
  | "Mensalidade recorrente"
  | "A combinar";

export const FORMAS_PAGAMENTO: FormaPagamento[] = [
  "À vista",
  "PIX",
  "Boleto bancário",
  "Cartão de débito",
  "Cartão de crédito",
  "50% na aprovação + 50% na entrega",
  "30% na aprovação + 70% na entrega",
  "Entrada + parcelamento",
  "Mensalidade recorrente",
  "A combinar",
];

export const FORMAS_COM_DETALHE = new Set<string>([
  "Entrada + parcelamento",
  "Mensalidade recorrente",
  "A combinar",
]);

export type CartaoTipoJuros = "sem_juros" | "com_juros";

export interface CartaoConfig {
  parcelas: number;
  tipo: CartaoTipoJuros;
  juros_mensal: number; // % ao mês
  valor_parcela: number;
  total_com_juros: number;
}

export function calcularParcelamentoCartao(
  total: number,
  parcelas: number,
  tipo: CartaoTipoJuros,
  jurosMensal: number,
): { valor_parcela: number; total_com_juros: number } {
  const n = Math.max(1, Math.min(12, Math.floor(parcelas || 1)));
  if (tipo === "sem_juros" || !jurosMensal || jurosMensal <= 0) {
    return {
      valor_parcela: +(total / n).toFixed(2),
      total_com_juros: +total.toFixed(2),
    };
  }
  const i = jurosMensal / 100;
  const pmt = (total * i) / (1 - Math.pow(1 + i, -n));
  const parcela = +pmt.toFixed(2);
  return {
    valor_parcela: parcela,
    total_com_juros: +(parcela * n).toFixed(2),
  };
}

export function parseFormasPagamento(
  formas: unknown,
  legacy?: string | null,
): string[] {
  if (Array.isArray(formas) && formas.length) return formas.filter((f) => typeof f === "string");
  if (legacy && typeof legacy === "string" && legacy.trim()) {
    const match = FORMAS_PAGAMENTO.find((f) => f.toLowerCase() === legacy.toLowerCase());
    return [match || legacy];
  }
  return [];
}
