// Cálculos e formatadores do módulo Comercial → Orçamentos

export type DescontoTipo = "percentual" | "valor";

export interface OrcamentoItemCalc {
  quantidade: number;
  valor_unitario: number;
  desconto: number;
}

export interface OrcamentoTotaisInput {
  itens: OrcamentoItemCalc[];
  desconto_tipo: DescontoTipo;
  desconto_valor: number;
  impostos_valor: number;
  taxa_extra: number;
}

export interface OrcamentoTotaisOutput {
  subtotal: number;
  descontoAplicado: number;
  impostos: number;
  taxa: number;
  total: number;
}

export function calcularTotalItem(qtd: number, unit: number, desconto: number): number {
  const bruto = (Number(qtd) || 0) * (Number(unit) || 0);
  return Math.max(0, bruto - (Number(desconto) || 0));
}

export function calcularTotais(input: OrcamentoTotaisInput): OrcamentoTotaisOutput {
  const subtotal = input.itens.reduce(
    (acc, it) => acc + calcularTotalItem(it.quantidade, it.valor_unitario, it.desconto),
    0,
  );
  const descontoAplicado =
    input.desconto_tipo === "percentual"
      ? (subtotal * (Number(input.desconto_valor) || 0)) / 100
      : Number(input.desconto_valor) || 0;
  const impostos = Number(input.impostos_valor) || 0;
  const taxa = Number(input.taxa_extra) || 0;
  const total = Math.max(0, subtotal - descontoAplicado + impostos + taxa);
  return { subtotal, descontoAplicado, impostos, taxa, total };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBRL(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return brl.format(0);
  return brl.format(n);
}

export function formatNumber(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return num.format(0);
  return num.format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
