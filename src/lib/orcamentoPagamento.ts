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

export interface CartaoParcelamentoConfig {
  max_parcelas: number;
  parcelas_sem_juros: number;
  juros_mensal: number;
}

export interface ParcelaCartao {
  n: number;
  valor_parcela: number;
  total: number;
  tem_juros: boolean;
}

export interface PagamentoConfig {
  formas: string[];
  avista: AvistaConfig;
  cartao: CartaoParcelamentoConfig;
}

export const DEFAULT_AVISTA: AvistaConfig = {
  desconto_tipo: "percentual",
  desconto_valor: 0,
  aplica_pix: true,
};

export const DEFAULT_CARTAO: CartaoParcelamentoConfig = {
  max_parcelas: 12,
  parcelas_sem_juros: 2,
  juros_mensal: 2.99,
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
  maxParcelas: number,
  parcelasSemJuros: number,
  jurosMensal: number,
): ParcelaCartao[] {
  const max = Math.max(1, Math.min(12, Math.floor(maxParcelas || 1)));
  const semJuros = Math.max(0, Math.min(max, Math.floor(parcelasSemJuros || 0)));
  const i = Math.max(0, Number(jurosMensal) || 0) / 100;
  const t = Math.max(0, Number(total) || 0);
  const out: ParcelaCartao[] = [];
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

/** Deriva a estrutura nova a partir dos campos legados (leitura de orçamentos antigos). */
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
