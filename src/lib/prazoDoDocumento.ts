/**
 * Atalhos de validade de um documento do dossiê ("vence em 1 ano").
 *
 * Antes eram 8 botõezinhos (+30d, +60d, +90d, +120d, +135d, +6 meses,
 * +1 ano, +2 anos) embaixo do campo de data, mais um parágrafo de
 * explicação — poluía a janela. Agora é uma lista só: escolhe o prazo e a
 * data é calculada a partir da emissão.
 */
export interface Prazo { valor: string; rotulo: string; dias?: number; meses?: number }

export const PRAZOS: Prazo[] = [
  { valor: "30d", rotulo: "30 dias", dias: 30 },
  { valor: "60d", rotulo: "60 dias", dias: 60 },
  // 90, 120 e 135 dias: prazos de ASO que aparecem fora do anual.
  { valor: "90d", rotulo: "90 dias", dias: 90 },
  { valor: "120d", rotulo: "120 dias", dias: 120 },
  { valor: "135d", rotulo: "135 dias", dias: 135 },
  { valor: "6m", rotulo: "6 meses", meses: 6 },
  { valor: "12m", rotulo: "1 ano", meses: 12 },
  { valor: "24m", rotulo: "2 anos", meses: 24 },
];

/**
 * Data de emissão (AAAA-MM-DD) + prazo = vencimento (AAAA-MM-DD).
 *
 * Mês a mais em dia que não existe cai no último dia do mês: 31/01 + 1 mês
 * é 28 ou 29/02, e não 03/03 (o que o Date do JavaScript faria sozinho).
 */
export function vencimento(emissao: string, prazo: Prazo): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(emissao);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  let d: Date;
  if (prazo.meses) {
    const alvo = new Date(ano, mes + prazo.meses, 1);
    const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    d = new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimoDia));
  } else {
    d = new Date(ano, mes, dia + (prazo.dias ?? 0));
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Qual atalho gerou esta data (para a lista mostrar o escolhido), se algum. */
export function prazoDaData(emissao: string, validade: string): string {
  return PRAZOS.find((p) => vencimento(emissao, p) === validade)?.valor ?? "";
}
