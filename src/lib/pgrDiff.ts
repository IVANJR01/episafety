import { CLASSE_LABEL, classificarRisco, PgrClasse, CLASSES_ORDENADAS } from "@/lib/pgrMatriz";

/**
 * Comparação entre duas versões do PGR.
 *
 * Cada versão é uma linha própria em pgr_documentos (a anterior vira
 * 'substituido' ao publicar), então comparar é confrontar dois conjuntos de
 * riscos e ações. Não existe id estável entre versões — quando uma revisão
 * recadastra os itens, os uuid mudam. Por isso o pareamento é por CHAVE
 * SEMÂNTICA: o mesmo perigo, no mesmo ponto da estrutura, é o mesmo risco.
 *
 * A consequência honesta disso: renomear o perigo aparece como "removido +
 * incluído", não como "alterado". Preferimos errar para o lado de mostrar
 * demais — um risco que sumiu da lista precisa saltar aos olhos.
 */

export type TipoMudanca = "incluido" | "removido" | "alterado" | "igual";

export interface MudancaRisco {
  tipo: TipoMudanca;
  chave: string;
  perigo: string;
  contexto: string;
  antes: { classe: PgrClasse | null; sev: number | null; prob: number | null } | null;
  depois: { classe: PgrClasse | null; sev: number | null; prob: number | null } | null;
  /** Campos de texto que mudaram, com valor antigo e novo. */
  camposAlterados: { campo: string; antes: string; depois: string }[];
}

export interface MudancaAcao {
  tipo: TipoMudanca;
  chave: string;
  descricao: string;
  antes: { status: string; prazo: string | null; responsavel: string | null } | null;
  depois: { status: string; prazo: string | null; responsavel: string | null } | null;
}

export interface DiffPgr {
  riscos: MudancaRisco[];
  acoes: MudancaAcao[];
  resumo: {
    riscosIncluidos: number;
    riscosRemovidos: number;
    riscosAlterados: number;
    acoesIncluidas: number;
    acoesRemovidas: number;
    acoesAlteradas: number;
    /** Riscos que pioraram de classe entre as versões. */
    agravados: number;
    atenuados: number;
  };
}

const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Três chaves, da mais específica para a mais frouxa.
 *
 * Casar só pela chave completa produzia ruído demais no caso mais comum: uma
 * versão antiga, feita antes de o Núcleo Mestre existir, não tem setor_id nem
 * funcao_id. Comparada com a nova, TODO risco aparecia como removido seguido de
 * incluído — a tela ficava inútil justamente quando mais importa.
 *
 * O pareamento roda em passadas: primeiro os que batem em contexto completo,
 * depois perigo+GES, por fim só o perigo. Cada item é consumido ao casar, então
 * dois riscos com o mesmo perigo em setores diferentes continuam distintos
 * (casam na primeira passada) e não se confundem nas seguintes.
 */
const chaves = (i: any) => [
  [norm(i.perigo_descricao), i.ges_id || i.ghe_id || "", i.setor_id || norm(i.setor),
    i.funcao_sst_id || i.funcao_id || "", i.atividade_id || ""].join("|"),
  [norm(i.perigo_descricao), i.ges_id || i.ghe_id || ""].join("|"),
  norm(i.perigo_descricao),
];

/** Consome de `disponiveis` o primeiro item que casa com `alvo`. */
function parear(alvo: any, disponiveis: Map<string, any>[]): any | null {
  const ks = chaves(alvo);
  for (let n = 0; n < ks.length; n++) {
    const achado = disponiveis[n].get(ks[n]);
    if (achado && !achado.__usado) {
      achado.__usado = true;
      return achado;
    }
  }
  return null;
}

function indexar(itens: any[]): Map<string, any>[] {
  const idx: Map<string, any>[] = [new Map(), new Map(), new Map()];
  itens.forEach((i) => {
    chaves(i).forEach((k, n) => { if (!idx[n].has(k)) idx[n].set(k, i); });
  });
  return idx;
}

const chaveAcao = (a: any) => [norm(a.descricao), a.inventario_item_id || ""].join("|");

const aval = (i: any) => ({
  classe: (i.classificacao as PgrClasse) || classificarRisco(i.severidade, i.probabilidade),
  sev: i.severidade ?? null,
  prob: i.probabilidade ?? null,
});

const ordemClasse = (c: PgrClasse | null) =>
  c ? CLASSES_ORDENADAS.indexOf(c) : -1;

const CAMPOS_RISCO: [string, string][] = [
  ["fonte_geradora", "Fonte geradora"],
  ["circunstancia", "Circunstância"],
  ["lesoes", "Possíveis lesões"],
  ["tipo_exposicao", "Tipo de exposição"],
  ["epi", "EPI"],
  ["justificativa", "Justificativa"],
];

export function compararVersoes(
  antes: { inventario: any[]; acoes: any[] },
  depois: { inventario: any[]; acoes: any[] },
  nomes?: { ges?: Record<string, string>; setores?: Record<string, string>; funcoes?: Record<string, string> },
): DiffPgr {
  const de = (m: Record<string, string> | undefined, id?: string | null) => (id && m?.[id]) || "";
  const contextoDe = (i: any) =>
    [de(nomes?.setores, i.setor_id) || i.setor, de(nomes?.ges, i.ges_id || i.ghe_id),
      de(nomes?.funcoes, i.funcao_sst_id || i.funcao_id)]
      .filter(Boolean).join(" › ") || "—";

  // Cópias rasas: o pareamento marca `__usado` e não deve sujar o dado original.
  const antigos = antes.inventario.map((i) => ({ ...i }));
  const idxAntigos = indexar(antigos);

  const riscos: MudancaRisco[] = [];

  depois.inventario.forEach((novo) => {
    const chave = chaves(novo)[0];
    const velho = parear(novo, idxAntigos);
    if (!velho) {
      riscos.push({
        tipo: "incluido", chave, perigo: novo.perigo_descricao || "—",
        contexto: contextoDe(novo), antes: null, depois: aval(novo), camposAlterados: [],
      });
      return;
    }
    const a = aval(velho);
    const d = aval(novo);
    const camposAlterados = CAMPOS_RISCO
      .filter(([k]) => norm(velho[k]) !== norm(novo[k]))
      .map(([k, rot]) => ({ campo: rot, antes: String(velho[k] ?? "—"), depois: String(novo[k] ?? "—") }));
    const mudouAval = a.sev !== d.sev || a.prob !== d.prob || a.classe !== d.classe;
    riscos.push({
      tipo: mudouAval || camposAlterados.length > 0 ? "alterado" : "igual",
      chave, perigo: novo.perigo_descricao || "—", contexto: contextoDe(novo),
      antes: a, depois: d, camposAlterados,
    });
  });

  // Sobrou sem par = saiu do inventário.
  antigos.filter((v) => !v.__usado).forEach((velho) => {
    riscos.push({
      tipo: "removido", chave: chaves(velho)[0], perigo: velho.perigo_descricao || "—",
      contexto: contextoDe(velho), antes: aval(velho), depois: null, camposAlterados: [],
    });
  });

  // ── Ações ─────────────────────────────────────────────────────────────────
  const acoesA = new Map<string, any>();
  antes.acoes.forEach((a) => acoesA.set(chaveAcao(a), a));
  const acoesD = new Map<string, any>();
  depois.acoes.forEach((a) => acoesD.set(chaveAcao(a), a));

  const resumoAcao = (a: any) => ({
    status: a.status || "—", prazo: a.prazo || null, responsavel: a.responsavel_nome || null,
  });

  const acoes: MudancaAcao[] = [];
  acoesD.forEach((novo, chave) => {
    const velho = acoesA.get(chave);
    if (!velho) {
      acoes.push({ tipo: "incluido", chave, descricao: novo.descricao || "—", antes: null, depois: resumoAcao(novo) });
      return;
    }
    const a = resumoAcao(velho);
    const d = resumoAcao(novo);
    const mudou = a.status !== d.status || a.prazo !== d.prazo || a.responsavel !== d.responsavel;
    acoes.push({ tipo: mudou ? "alterado" : "igual", chave, descricao: novo.descricao || "—", antes: a, depois: d });
  });
  acoesA.forEach((velho, chave) => {
    if (acoesD.has(chave)) return;
    acoes.push({ tipo: "removido", chave, descricao: velho.descricao || "—", antes: resumoAcao(velho), depois: null });
  });

  const agravados = riscos.filter(
    (r) => r.antes && r.depois && ordemClasse(r.depois.classe) > ordemClasse(r.antes.classe)
      && ordemClasse(r.antes.classe) >= 0).length;
  const atenuados = riscos.filter(
    (r) => r.antes && r.depois && ordemClasse(r.depois.classe) < ordemClasse(r.antes.classe)
      && ordemClasse(r.depois.classe) >= 0).length;

  const conta = (l: { tipo: TipoMudanca }[], t: TipoMudanca) => l.filter((x) => x.tipo === t).length;

  return {
    riscos, acoes,
    resumo: {
      riscosIncluidos: conta(riscos, "incluido"),
      riscosRemovidos: conta(riscos, "removido"),
      riscosAlterados: conta(riscos, "alterado"),
      acoesIncluidas: conta(acoes, "incluido"),
      acoesRemovidas: conta(acoes, "removido"),
      acoesAlteradas: conta(acoes, "alterado"),
      agravados, atenuados,
    },
  };
}

export const rotuloClasse = (c: PgrClasse | null) => (c ? CLASSE_LABEL[c] : "Não avaliado");
