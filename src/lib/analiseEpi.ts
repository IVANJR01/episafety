/**
 * Contas do painel "Análise de EPI".
 *
 * Tudo aqui recebe listas já carregadas e devolve números — sem banco, sem
 * React. Quem desenha é src/components/dashboard/AnaliseEpi.tsx.
 *
 * Saída de EPI: entrega, troca, substituição, perda e dano. Todas tiram um
 * EPI do estoque e põem na mão do trabalhador. Devolução não é saída.
 */

export interface MovimentoEpi {
  funcionario_id: string;
  epi_id: string;
  quantidade: number;
  /** Data da entrega (AAAA-MM-DD). */
  data: string;
  /** Quando foi registrada — dá a hora do dia. */
  created_at: string;
  tipo: string;
}

export interface EpiComEstoque {
  id: string;
  nome: string;
  estoque: number;
  estoque_minimo?: number | null;
}

const SAIDAS = new Set(["entrega", "troca", "substituicao", "perda", "dano"]);
export const ehSaida = (m: { tipo: string }) => SAIDAS.has(m.tipo);

const DIA_MS = 86_400_000;

/** Dias inteiros entre duas datas AAAA-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / DIA_MS);
}

/** Data AAAA-MM-DD de N dias antes de `hoje`. */
export function diasAntes(hoje: string, n: number): string {
  return new Date(Date.parse(`${hoje}T00:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
}

/* ─────────────── Item 4: filtros ─────────────── */

export interface Filtros {
  /** Só movimentos a partir desta data (AAAA-MM-DD). Vazio = desde sempre. */
  desde?: string;
  /** Só trabalhadores destes ids (vindos do filtro de GHE/setor). Vazio = todos. */
  funcionarios?: Set<string> | null;
}

export function filtrar<T extends MovimentoEpi>(movs: T[], f: Filtros): T[] {
  return movs.filter((m) =>
    (!f.desde || m.data >= f.desde) &&
    (!f.funcionarios || f.funcionarios.has(m.funcionario_id)));
}

/* ─────────────── Item 2: previsão de estoque em dias ─────────────── */

export interface PrevisaoEstoque {
  epi: EpiComEstoque;
  /** Unidades que saíram na janela. */
  consumo: number;
  /** Consumo por dia. */
  porDia: number;
  /** Dias até acabar; null = sem consumo na janela (não dá para prever). */
  dias: number | null;
  situacao: "zerado" | "critico" | "atencao" | "ok" | "sem_consumo";
}

/** Até 15 dias de estoque é crítico; até 30, atenção. */
export const DIAS_CRITICO = 15;
export const DIAS_ATENCAO = 30;

/**
 * Para cada EPI: com o consumo dos últimos `janela` dias, quantos dias o
 * estoque atual dura. É a pergunta que o "estoque mínimo" sozinho não
 * responde: 10 luvas é muito para quem gasta 1 por mês e nada para quem
 * gasta 5 por dia.
 */
export function previsaoDeEstoque(
  epis: EpiComEstoque[], movs: MovimentoEpi[], hoje: string, janela = 90,
): PrevisaoEstoque[] {
  const desde = diasAntes(hoje, janela);
  const consumo = new Map<string, number>();
  for (const m of movs) {
    if (!ehSaida(m) || m.data < desde || m.data > hoje) continue;
    consumo.set(m.epi_id, (consumo.get(m.epi_id) ?? 0) + (m.quantidade || 0));
  }
  const ordem = { zerado: 0, critico: 1, atencao: 2, ok: 3, sem_consumo: 4 };
  return epis.map((epi) => {
    const c = consumo.get(epi.id) ?? 0;
    const porDia = c / janela;
    const estoque = epi.estoque ?? 0;
    let dias: number | null = porDia > 0 ? Math.floor(estoque / porDia) : null;
    let situacao: PrevisaoEstoque["situacao"];
    if (estoque <= 0) { situacao = "zerado"; dias = porDia > 0 ? 0 : null; }
    else if (dias === null) situacao = "sem_consumo";
    else if (dias <= DIAS_CRITICO) situacao = "critico";
    else if (dias <= DIAS_ATENCAO) situacao = "atencao";
    else situacao = "ok";
    return { epi, consumo: c, porDia, dias, situacao };
  }).sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.dias ?? 1e9) - (b.dias ?? 1e9));
}

/* ─────────────── Item 3: tempo de uso real ─────────────── */

export interface UsoPorEpi {
  epi_id: string;
  /** Média de dias entre uma entrega e a próxima do mesmo EPI ao mesmo trabalhador. */
  mediaDias: number;
  /** Quantos intervalos entraram na média. */
  amostras: number;
}

export interface TrocaRapida {
  funcionario_id: string;
  epi_id: string;
  mediaDias: number;
  mediaDoEpi: number;
  amostras: number;
}

/**
 * Quanto tempo cada EPI dura na mão do trabalhador, medido pelos dados:
 * o intervalo entre uma entrega e a seguinte do mesmo EPI à mesma pessoa.
 * Entregas no mesmo dia contam como uma só (kit, ou par de luvas lançado
 * em duas linhas).
 */
function intervalos(movs: MovimentoEpi[]): Map<string, number[]> {
  const porPar = new Map<string, Set<string>>();
  for (const m of movs) {
    if (!ehSaida(m)) continue;
    const k = `${m.funcionario_id}|${m.epi_id}`;
    if (!porPar.has(k)) porPar.set(k, new Set());
    porPar.get(k)!.add(m.data.slice(0, 10));
  }
  const out = new Map<string, number[]>();
  for (const [k, datas] of porPar) {
    const d = [...datas].sort();
    const iv: number[] = [];
    for (let i = 1; i < d.length; i++) iv.push(diasEntre(d[i - 1], d[i]));
    if (iv.length) out.set(k, iv);
  }
  return out;
}

const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function usoRealPorEpi(movs: MovimentoEpi[]): UsoPorEpi[] {
  const porEpi = new Map<string, number[]>();
  for (const [k, iv] of intervalos(movs)) {
    const epi = k.split("|")[1];
    porEpi.set(epi, [...(porEpi.get(epi) ?? []), ...iv]);
  }
  return [...porEpi].map(([epi_id, iv]) => ({ epi_id, mediaDias: media(iv), amostras: iv.length }))
    .sort((a, b) => a.mediaDias - b.mediaDias);
}

/** Troca "rápida": a média da pessoa é no máximo esta fração da média do EPI. */
export const FRACAO_TROCA_RAPIDA = 0.5;

/**
 * Quem troca o mesmo EPI muito mais rápido que os colegas — pista de uso
 * errado, função mais agressiva para o EPI ou EPI de baixa qualidade. Só
 * entra quem tem pelo menos 2 trocas e EPI com pelo menos 4 intervalos no
 * total, para um caso isolado não virar alarme.
 */
export function trocasRapidas(movs: MovimentoEpi[]): TrocaRapida[] {
  const iv = intervalos(movs);
  const doEpi = new Map(usoRealPorEpi(movs).map((u) => [u.epi_id, u]));
  const out: TrocaRapida[] = [];
  for (const [k, xs] of iv) {
    const [funcionario_id, epi_id] = k.split("|");
    const e = doEpi.get(epi_id);
    if (!e || e.amostras < 4 || xs.length < 2) continue;
    const m = media(xs);
    if (m <= e.mediaDias * FRACAO_TROCA_RAPIDA) {
      out.push({ funcionario_id, epi_id, mediaDias: m, mediaDoEpi: e.mediaDias, amostras: xs.length });
    }
  }
  return out.sort((a, b) => a.mediaDias / a.mediaDoEpi - b.mediaDias / b.mediaDoEpi);
}

/* ─────────────── Item 6: quando o almoxarifado trabalha ─────────────── */

/**
 * Deixa a data no formato que todo navegador entende. O banco às vezes
 * devolve "2026-11-18 13:25:08+00": o Chrome aceita, o Safari do iPhone não
 * (dá NaN e a entrega some do gráfico).
 */
export function dataIso(s: string): string {
  return s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
}

export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Unidades entregues por dia da semana (pela data da entrega). */
export function porDiaDaSemana(movs: MovimentoEpi[]): { dia: string; quantidade: number }[] {
  const q = new Array(7).fill(0);
  for (const m of movs) {
    if (!ehSaida(m)) continue;
    q[new Date(`${m.data.slice(0, 10)}T12:00:00Z`).getUTCDay()] += m.quantidade || 0;
  }
  return DIAS_DA_SEMANA.map((dia, i) => ({ dia, quantidade: q[i] }));
}

/**
 * Entregas por hora do dia, pela hora em que foram registradas, no fuso de
 * Brasília (UTC-3, sem horário de verão desde 2019). Lançamento feito depois,
 * no escritório, aparece na hora do lançamento — a tela avisa isso.
 */
export function porHoraDoDia(movs: MovimentoEpi[]): { hora: string; quantidade: number }[] {
  const q = new Array(24).fill(0);
  for (const m of movs) {
    if (!ehSaida(m)) continue;
    const t = Date.parse(dataIso(m.created_at));
    if (Number.isNaN(t)) continue;
    q[new Date(t - 3 * 3_600_000).getUTCHours()] += m.quantidade || 0;
  }
  return q.map((quantidade, h) => ({ hora: `${String(h).padStart(2, "0")}h`, quantidade }));
}
