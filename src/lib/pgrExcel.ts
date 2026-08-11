import * as XLSX from "xlsx";
import { CLASSE_LABEL, GRUPO_LABEL, classificarRisco } from "@/lib/pgrMatriz";
import { calcularPendencias, Pendencia } from "@/lib/pgrPendencias";

/**
 * Exportação do PGR para Excel.
 *
 * Uma aba por assunto (Inventário, Plano de ação, Pendências) em vez de uma
 * planilha única: as três têm granularidades diferentes — uma linha por risco,
 * uma por ação, uma por pendência — e misturá-las produz a tabela com células
 * mescladas que ninguém consegue filtrar.
 *
 * Datas saem como texto dd/mm/aaaa. O Excel interpreta "01/02/2026" conforme o
 * locale da máquina de quem abre, e uma data de prazo lida como mês/dia troca
 * fevereiro por janeiro sem avisar ninguém.
 */

export interface ContextoExcel {
  pgr: any;
  empresaNome?: string | null;
  unidadeNome?: string | null;
  inventario: any[];
  acoes: any[];
  responsaveis?: any[];
  levantamento?: any[];
  eficacias?: any[];
  /** id -> nome, para resolver as chaves estrangeiras na planilha. */
  nomes?: {
    ges?: Record<string, string>;
    ambientes?: Record<string, string>;
    setores?: Record<string, string>;
    funcoes?: Record<string, string>;
    atividades?: Record<string, string>;
  };
}

const dt = (s?: string | null) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "";

const ACAO_STATUS: Record<string, string> = {
  pendente: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

/** Largura de coluna a partir do maior conteúdo, com teto para não estourar a tela. */
function larguras(linhas: any[][]): { wch: number }[] {
  if (linhas.length === 0) return [];
  return linhas[0].map((_, c) => {
    const max = linhas.reduce(
      (m, l) => Math.max(m, String(l[c] ?? "").length), 10);
    return { wch: Math.min(max + 2, 60) };
  });
}

function aba(wb: XLSX.WorkBook, nome: string, cabecalho: string[], linhas: any[][]) {
  const dados = [cabecalho, ...linhas];
  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = larguras(dados);
  // Congela o cabeçalho: rolar 200 riscos sem saber a coluna é inútil.
  ws["!freeze"] = { xSplit: "0", ySplit: "1" } as any;
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: dados.length - 1, c: cabecalho.length - 1 },
    }),
  };
  // Nome de aba do Excel: máx. 31 caracteres e sem : \ / ? * [ ]
  XLSX.utils.book_append_sheet(wb, ws, nome.replace(/[:\\/?*[\]]/g, "").slice(0, 31));
}

export function montarWorkbookPgr(ctx: ContextoExcel): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const n = ctx.nomes || {};
  const de = (mapa: Record<string, string> | undefined, id?: string | null) =>
    (id && mapa?.[id]) || "";

  // ── Capa ──────────────────────────────────────────────────────────────────
  const p = ctx.pgr || {};
  aba(wb, "Identificação", ["Campo", "Valor"], [
    ["Empresa", ctx.empresaNome || ""],
    ["Unidade", ctx.unidadeNome || ""],
    ["CNPJ", p.cnpj_snapshot || ""],
    ["CNAE principal", p.cnae_principal || ""],
    ["Grau de risco", p.grau_risco ?? ""],
    ["Versão", p.versao ?? ""],
    ["Status", p.status || ""],
    ["Data de emissão", dt(p.data_emissao)],
    ["Vigência", `${dt(p.data_vigencia_inicio)} a ${dt(p.data_vigencia_fim)}`],
    ["Próxima revisão", dt(p.proxima_revisao)],
    ["Responsável técnico", p.resp_tec_nome || ""],
    ["Registro profissional", p.resp_tec_registro || ""],
    ["Exportado em", new Date().toLocaleString("pt-BR")],
  ]);

  // ── Inventário ────────────────────────────────────────────────────────────
  aba(wb, "Inventário de riscos", [
    "Ambiente", "Setor", "GES", "Função", "Atividade",
    "Grupo", "Perigo", "Fonte geradora", "Circunstância", "Possíveis lesões",
    "Tipo de exposição", "Expostos", "Controles existentes", "EPI",
    "Severidade", "Probabilidade", "Nível", "Classificação",
    "Sev. residual", "Prob. residual", "Nível residual", "Classificação residual",
    "Necessita ação", "Justificativa",
  ], (ctx.inventario || []).map((i) => {
    const classe = i.classificacao || classificarRisco(i.severidade, i.probabilidade);
    const classeRes = classificarRisco(i.severidade_residual, i.probabilidade_residual);
    return [
      de(n.ambientes, i.ambiente_id) || i.descricao_ambiente || "",
      de(n.setores, i.setor_id) || i.setor || "",
      de(n.ges, i.ges_id || i.ghe_id),
      de(n.funcoes, i.funcao_sst_id || i.funcao_id),
      de(n.atividades, i.atividade_id),
      GRUPO_LABEL[i.grupo] || i.grupo || "",
      i.perigo_descricao || "",
      i.fonte_geradora || "",
      i.circunstancia || "",
      i.lesoes || "",
      i.medicao_valor != null ? String(i.medicao_valor) + (i.medicao_unidade ? " " + i.medicao_unidade : "") : "",
      i.tempo_exposicao || i.tipo_exposicao || "",
      i.trabalhadores_expostos ?? "",
      (i.controles_existentes || []).join("; ") || i.medidas_existentes || "",
      i.epi || "",
      i.severidade ?? "",
      i.probabilidade ?? "",
      i.severidade != null && i.probabilidade != null ? i.severidade * i.probabilidade : "",
      // Sem avaliação fica "Não avaliado" — nunca a menor classe, que faria
      // risco não avaliado parecer risco aceito.
      classe ? CLASSE_LABEL[classe] : "Não avaliado",
      i.severidade_residual ?? "",
      i.probabilidade_residual ?? "",
      i.severidade_residual != null && i.probabilidade_residual != null
        ? i.severidade_residual * i.probabilidade_residual : "",
      classeRes ? CLASSE_LABEL[classeRes] : "Não avaliado",
      i.necessita_acao ? "Sim" : "Não",
      i.justificativa || "",
    ];
  }));

  // ── Plano de ação ─────────────────────────────────────────────────────────
  const porItem = new Map<string, any>();
  (ctx.inventario || []).forEach((i) => porItem.set(i.id, i));
  const verificacao = new Map<string, any>();
  (ctx.eficacias || []).forEach((v) => verificacao.set(v.acao_id, v));

  aba(wb, "Plano de ação", [
    "Risco relacionado", "Ação", "Tipo de medida", "Prioridade",
    "Responsável", "Setor responsável", "Prazo", "Status", "% execução",
    "Data de conclusão", "Evidência", "Custo estimado",
    "Eficácia verificada em", "Resultado da verificação", "Necessita ajuste",
  ], (ctx.acoes || []).map((a) => {
    const risco = a.inventario_item_id ? porItem.get(a.inventario_item_id) : null;
    const v = verificacao.get(a.id);
    return [
      risco?.perigo_descricao || "",
      a.descricao || "",
      a.tipo || "",
      a.prioridade ?? "",
      a.responsavel_nome || "",
      a.responsavel_setor || "",
      dt(a.prazo),
      ACAO_STATUS[a.status] || a.status || "",
      a.percentual_execucao ?? "",
      dt(a.data_conclusao),
      a.evidencia_url ? "Sim" : "Não",
      a.custo_estimado ?? "",
      dt(v?.data_verificacao),
      v?.resultado || "",
      v?.necessita_ajuste == null ? "" : v.necessita_ajuste ? "Sim" : "Não",
    ];
  }));

  // ── Pendências ────────────────────────────────────────────────────────────
  const pend: Pendencia[] = calcularPendencias({
    inventario: ctx.inventario || [],
    acoes: ctx.acoes || [],
    responsaveis: ctx.responsaveis || [],
    levantamento: ctx.levantamento,
    eficacias: ctx.eficacias,
    respTecNome: p.resp_tec_nome,
  });
  aba(wb, "Pendências", ["Categoria", "Pendência", "Item", "Severidade", "Resolve em"],
    pend.map((x) => [
      x.categoria, x.titulo, x.referencia || "",
      x.severidade === "bloqueio" ? "Impede emitir" : "Revisar", x.etapa,
    ]));

  return wb;
}

/** Nome de arquivo previsível e ordenável: PGR_Unidade_v2_2026-07-28.xlsx */
export function nomeArquivoPgr(ctx: ContextoExcel, ext = "xlsx") {
  const limpa = (s?: string | null) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const partes = [
    "PGR",
    limpa(ctx.unidadeNome || ctx.empresaNome) || "documento",
    `v${ctx.pgr?.versao ?? 1}`,
    new Date().toISOString().slice(0, 10),
  ];
  return `${partes.join("_")}.${ext}`;
}

export function exportarPgrExcel(ctx: ContextoExcel) {
  const wb = montarWorkbookPgr(ctx);
  XLSX.writeFile(wb, nomeArquivoPgr(ctx));
}
