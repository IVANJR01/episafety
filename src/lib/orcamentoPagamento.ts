import type { DescontoTipo } from "./orcamentoCalc";

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

// --- Legacy (compatibilidade com orçamentos antigos) -------------------------
export interface CartaoConfig {
  parcelas: number;
  tipo: CartaoTipoJuros;
  juros_mensal: number;
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
    return { valor_parcela: +(total / n).toFixed(2), total_com_juros: +total.toFixed(2) };
  }
  const i = jurosMensal / 100;
  const pmt = (total * i) / (1 - Math.pow(1 + i, -n));
  const parcela = +pmt.toFixed(2);
  return { valor_parcela: parcela, total_com_juros: +(parcela * n).toFixed(2) };
}

export function parseFormasPagamento(formas: unknown, legacy?: string | null): string[] {
  if (Array.isArray(formas) && formas.length) return formas.filter((f) => typeof f === "string");
  if (legacy && typeof legacy === "string" && legacy.trim()) {
    const match = FORMAS_PAGAMENTO.find((f) => f.toLowerCase() === legacy.toLowerCase());
    return [match || legacy];
  }
  return [];
}

// --- Novo modelo profissional ------------------------------------------------
export interface AvistaConfig {
  desconto_tipo: DescontoTipo;
  desconto_valor: number;
  aplica_pix: boolean;
}

export type CartaoModo = "juros_composto" | "taxa_por_parcela";

export type CartaoPreset =
  | "nubank_link_publico"
  | "nubank_tap_publico"
  | "nupay_publico"
  | "nubank_cnpj_atual"
  | "personalizado";

export interface CartaoParcelamentoConfig {
  modo?: CartaoModo;
  preset?: CartaoPreset;
  max_parcelas: number;
  parcelas_sem_juros: number;
  juros_mensal: number;
  /** Taxa (%) por número de parcelas quando modo = "taxa_por_parcela". Ex: {1:0, 2:2.01, 12:14.77} */
  taxas?: Record<number, number>;
}

export interface ParcelaCartao {
  n: number;
  valor_parcela: number;
  total: number;
  tem_juros: boolean;
  taxa?: number;
}

export interface PagamentoConfig {
  formas: string[];
  avista: AvistaConfig;
  cartao: CartaoParcelamentoConfig;
}

export const PRESETS_CARTAO: Record<Exclude<CartaoPreset, "personalizado">, Record<number, number>> = {
  // Valores públicos aproximados — servem como ponto de partida e devem ser conferidos no app antes do envio.
  nubank_link_publico: { 1: 4.29, 2: 6.5, 3: 7.5, 4: 8.5, 5: 9.5, 6: 10.5, 7: 11.5, 8: 12.5, 9: 13.5, 10: 14.5, 11: 15.5, 12: 16.66 },
  nubank_tap_publico: { 1: 1.39, 2: 4.5, 3: 5.5, 4: 6.5, 5: 7.5, 6: 8.5, 7: 9.5, 8: 10.5, 9: 11.5, 10: 12.5, 11: 13.5, 12: 15.0 },
  nupay_publico: { 1: 1.99, 2: 3.5, 3: 4.5, 4: 5.3, 5: 6.2, 6: 7.1, 7: 8.0, 8: 8.9, 9: 9.8, 10: 10.7, 11: 11.8, 12: 13.0 },
  // Exemplo enviado pelo usuário; totalmente editável.
  // Valores confirmados no checkout Nubank CNPJ (print do cliente).
  nubank_cnpj_atual: { 1: 0, 2: 2.01, 3: 3.02, 4: 4.03, 5: 5.05, 6: 6.08, 7: 7.11, 8: 10.65, 9: 11.72, 10: 12.79, 11: 13.87, 12: 14.77 },
};

export const CARTAO_PRESET_LABEL: Record<CartaoPreset, string> = {
  nubank_link_publico: "Nubank Link de Pagamento — Público",
  nubank_tap_publico: "Nubank Tap to Pay — Público",
  nupay_publico: "NuPay — Público",
  nubank_cnpj_atual: "Nubank CNPJ — Minha taxa atual",
  personalizado: "Personalizado",
};

export function taxasDoPreset(preset: CartaoPreset, max: number = 12): Record<number, number> {
  const base = preset === "personalizado" ? {} : PRESETS_CARTAO[preset];
  const out: Record<number, number> = {};
  for (let n = 1; n <= max; n++) out[n] = Number(base?.[n] ?? 0);
  return out;
}

export const DEFAULT_AVISTA: AvistaConfig = {
  desconto_tipo: "percentual",
  desconto_valor: 0,
  aplica_pix: true,
};

export const DEFAULT_CARTAO: CartaoParcelamentoConfig = {
  modo: "juros_composto",
  preset: "personalizado",
  max_parcelas: 12,
  parcelas_sem_juros: 2,
  juros_mensal: 2.99,
  taxas: {},
};

export function calcularDescontoAvista(
  total: number,
  tipo: DescontoTipo,
  valor: number,
): { desconto: number; valor_final: number } {
  const v = Math.max(0, Number(valor) || 0);
  const bruto = tipo === "percentual" ? (total * v) / 100 : v;
  const desconto = Math.max(0, Math.min(bruto, total));
  return { desconto: +desconto.toFixed(2), valor_final: +(total - desconto).toFixed(2) };
}

export function gerarTabelaParcelas(
  total: number,
  cartaoOrMax: CartaoParcelamentoConfig | number,
  parcelasSemJuros?: number,
  jurosMensal?: number,
): ParcelaCartao[] {
  const cartao: CartaoParcelamentoConfig = typeof cartaoOrMax === "number"
    ? { modo: "juros_composto", max_parcelas: cartaoOrMax, parcelas_sem_juros: parcelasSemJuros ?? 0, juros_mensal: jurosMensal ?? 0 }
    : cartaoOrMax;
  const max = Math.max(1, Math.min(12, Math.floor(cartao.max_parcelas || 1)));
  const t = Math.max(0, Number(total) || 0);
  const out: ParcelaCartao[] = [];

  if ((cartao.modo || "juros_composto") === "taxa_por_parcela") {
    const taxas = cartao.taxas || {};
    for (let n = 1; n <= max; n++) {
      const taxa = Math.max(0, Number(taxas[n]) || 0);
      const totalComTaxa = +(t * (1 + taxa / 100)).toFixed(2);
      const parcela = +(totalComTaxa / n).toFixed(2);
      out.push({ n, valor_parcela: parcela, total: totalComTaxa, tem_juros: taxa > 0, taxa });
    }
    return out;
  }

  const semJuros = Math.max(0, Math.min(max, Math.floor(cartao.parcelas_sem_juros || 0)));
  const i = Math.max(0, Number(cartao.juros_mensal) || 0) / 100;
  for (let n = 1; n <= max; n++) {
    const temJuros = n > semJuros;
    if (!temJuros || i <= 0) {
      const p = +(t / n).toFixed(2);
      out.push({ n, valor_parcela: p, total: +t.toFixed(2), tem_juros: temJuros && i > 0 });
    } else {
      const pmt = (t * i) / (1 - Math.pow(1 + i, -n));
      const parcela = +pmt.toFixed(2);
      out.push({ n, valor_parcela: parcela, total: +(parcela * n).toFixed(2), tem_juros: true });
    }
  }
  return out;
}
export function hydratePagamentoConfig(orc: {
  formas_pagamento?: string[] | null;
  condicoes_pagamento?: string | null;
  cartao_credito_config?: CartaoConfig | null;
  pagamento_config?: Partial<PagamentoConfig> | null;
}): PagamentoConfig {
  const formas = parseFormasPagamento(orc.formas_pagamento, orc.condicoes_pagamento);
  const pc = orc.pagamento_config || null;
  const avista: AvistaConfig = pc?.avista
    ? { ...DEFAULT_AVISTA, ...pc.avista }
    : { ...DEFAULT_AVISTA };
  let cartao: CartaoParcelamentoConfig;
  if (pc?.cartao) {
    cartao = { ...DEFAULT_CARTAO, ...pc.cartao };
  } else if (orc.cartao_credito_config) {
    const cc = orc.cartao_credito_config;
    cartao = {
      max_parcelas: Math.max(1, cc.parcelas || 1),
      parcelas_sem_juros: cc.tipo === "sem_juros" ? Math.max(1, cc.parcelas || 1) : 0,
      juros_mensal: cc.juros_mensal || 0,
    };
  } else {
    cartao = { ...DEFAULT_CARTAO };
  }
  return { formas, avista, cartao };
}
