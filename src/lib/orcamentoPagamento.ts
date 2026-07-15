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

export const FORMAS_PAGAMENTO: (FormaPagamento | "Pagar com Nubank / NuPay" | "Link de Pagamento InfinitePay")[] = [
  "À vista",
  "PIX",
  "Pagar com Nubank / NuPay",
  "Link de Pagamento InfinitePay",
  "Boleto bancário",
  "Cartão de débito",
  "Cartão de crédito",
  "50% na aprovação + 50% na entrega",
  "30% na aprovação + 70% na entrega",
  "Entrada + parcelamento",
  "Mensalidade recorrente",
  "A combinar",
];

export const NUPAY_KEY = "Pagar com Nubank / NuPay";
export const INFINITEPAY_LINK_KEY = "Link de Pagamento InfinitePay";

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

export interface NupayConfig {
  taxa: number; // % sobre total base
}

export interface InfinitepayConfig {
  preset: "infinitepay_link_1du" | "personalizado";
  max_parcelas: number;
  taxas: Record<number, number>;
}

export interface PagamentoConfig {
  formas: string[];
  avista: AvistaConfig;
  cartao: CartaoParcelamentoConfig;
  nupay?: NupayConfig;
  infinitepay?: InfinitepayConfig;
}

export const PRESETS_CARTAO: Record<Exclude<CartaoPreset, "personalizado">, Record<number, number>> = {
  // Valores públicos aproximados — servem como ponto de partida e devem ser conferidos no app antes do envio.
  nubank_link_publico: { 1: 4.29, 2: 6.5, 3: 7.5, 4: 8.5, 5: 9.5, 6: 10.5, 7: 11.5, 8: 12.5, 9: 13.5, 10: 14.5, 11: 15.5, 12: 16.66 },
  nubank_tap_publico: { 1: 1.39, 2: 4.5, 3: 5.5, 4: 6.5, 5: 7.5, 6: 8.5, 7: 9.5, 8: 10.5, 9: 11.5, 10: 12.5, 11: 13.5, 12: 15.0 },
  nupay_publico: { 1: 1.99, 2: 3.5, 3: 4.5, 4: 5.3, 5: 6.2, 6: 7.1, 7: 8.0, 8: 8.9, 9: 9.8, 10: 10.7, 11: 11.8, 12: 13.0 },
  // Valores confirmados no checkout Nubank CNPJ (print do cliente). 1x NÃO é sem juros.
  nubank_cnpj_atual: { 1: 4.38, 2: 6.20, 3: 7.20, 4: 8.24, 5: 9.28, 6: 10.34, 7: 11.42, 8: 10.65, 9: 11.72, 10: 12.79, 11: 13.87, 12: 14.77 },
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
  const nupay: NupayConfig = pc?.nupay ? { taxa: Number(pc.nupay.taxa) || 0 } : { taxa: 2.76 };
  const infinitepay: InfinitepayConfig = pc?.infinitepay
    ? { preset: pc.infinitepay.preset || "infinitepay_link_1du", max_parcelas: pc.infinitepay.max_parcelas || 12, taxas: { ...INFINITEPAY_LINK_1DU_TAXAS, ...(pc.infinitepay.taxas || {}) } }
    : { ...DEFAULT_INFINITEPAY };
  return { formas, avista, cartao, nupay, infinitepay };
}

export const DEFAULT_NUPAY: NupayConfig = { taxa: 2.76 };

export function calcularNupay(total: number, taxa: number): { valor_final: number; acrescimo: number } {
  const t = Math.max(0, Number(total) || 0);
  const x = Math.max(0, Number(taxa) || 0);
  const vf = +(t * (1 + x / 100)).toFixed(2);
  return { valor_final: vf, acrescimo: +(vf - t).toFixed(2) };
}

// --- InfinitePay Link de Pagamento — repasse de taxa -------------------------
// Fórmula: valor_cobrado = valor_liquido / (1 - taxa/100)
export const INFINITEPAY_LINK_1DU_TAXAS: Record<number, number> = {
  1: 4.20, 2: 6.09, 3: 7.01, 4: 7.91, 5: 8.80, 6: 9.67,
  7: 12.59, 8: 13.42, 9: 14.25, 10: 15.06, 11: 15.87, 12: 16.66,
};

export const DEFAULT_INFINITEPAY: InfinitepayConfig = {
  preset: "infinitepay_link_1du",
  max_parcelas: 12,
  taxas: { ...INFINITEPAY_LINK_1DU_TAXAS },
};

export interface ParcelaInfinitepay {
  n: number;
  taxa: number;
  valor_cobrado: number;
  valor_parcela: number;
  liquido: number;
}

export function calcularInfinitepay(liquido: number, taxa: number, parcelas: number): ParcelaInfinitepay {
  const l = Math.max(0, Number(liquido) || 0);
  const x = Math.max(0, Math.min(99.99, Number(taxa) || 0));
  const n = Math.max(1, Math.floor(parcelas || 1));
  // Arredonda a parcela primeiro e recompõe o total, para que parcela × n == cliente paga (sem diferença de centavos).
  const cobradoBruto = l / (1 - x / 100);
  const parc = +(cobradoBruto / n).toFixed(2);
  const cobrado = +(parc * n).toFixed(2);
  return { n, taxa: x, valor_cobrado: cobrado, valor_parcela: parc, liquido: l };
}

export function gerarTabelaInfinitepay(liquido: number, cfg: InfinitepayConfig): ParcelaInfinitepay[] {
  const max = Math.max(1, Math.min(12, Math.floor(cfg.max_parcelas || 12)));
  const out: ParcelaInfinitepay[] = [];
  for (let n = 1; n <= max; n++) {
    out.push(calcularInfinitepay(liquido, Number(cfg.taxas?.[n] ?? 0), n));
  }
  return out;
}

