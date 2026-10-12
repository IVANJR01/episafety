import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  BookMarked,
  ListChecks,
} from "lucide-react";
import { PgrDocumento, PgrStatus } from "@/lib/pgrTypes";
import { isAtrasada } from "@/lib/pgrAcoes";
import { necessitaAcao, PgrClasse } from "@/lib/pgrMatriz";

interface Props {
  pgr: PgrDocumento;
}

/**
 * Severidade da pendência, conforme a Etapa 8:
 *   bloqueante   — impede a emissão;
 *   alerta       — não impede, mas a revisão técnica deve olhar;
 *   recomendacao — boa prática, não exigência literal da norma;
 *   ok / info    — conforme, ou apenas contexto.
 */
type Severidade = "bloqueante" | "alerta" | "recomendacao" | "ok" | "info";

interface Item {
  label: string;
  sev: Severidade;
  detail?: string;
  /** Referência normativa, quando a pendência vem de exigência literal. */
  norma?: string;
}

/*
 * Um estilo por severidade, num só lugar: o ícone, o quadrado que o envolve e
 * a etiqueta. Antes eram quatro mapas separados (ICONE/COR/BADGE/SEV_LABEL),
 * e as cores saturadas (bg-red-100 + border-red-300) deixavam a tela com cara
 * de alerta de sistema antigo. Aqui a cor é superfície clara com anel fino.
 */
const ESTILO: Record<
  Severidade,
  { icone: typeof CheckCircle2; tile: string; chip: string; label: string; plural: string; barra: string }
> = {
  bloqueante: {
    icone: XCircle,
    tile: "bg-rose-50 text-rose-600 ring-rose-100",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    label: "Bloqueante",
    plural: "Bloqueantes",
    barra: "bg-rose-500",
  },
  alerta: {
    icone: AlertTriangle,
    tile: "bg-amber-50 text-amber-600 ring-amber-100",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Alerta",
    plural: "Alertas",
    barra: "bg-amber-500",
  },
  recomendacao: {
    icone: Info,
    tile: "bg-sky-50 text-sky-600 ring-sky-100",
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    label: "Recomendação",
    plural: "Recomendações",
    barra: "bg-sky-500",
  },
  ok: {
    icone: CheckCircle2,
    tile: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    label: "Conforme",
    plural: "Conformes",
    barra: "bg-emerald-500",
  },
  info: {
    icone: Info,
    tile: "bg-slate-50 text-slate-500 ring-slate-100",
    chip: "bg-slate-50 text-slate-600 ring-slate-200",
    label: "Contexto",
    plural: "Contexto",
    barra: "bg-slate-400",
  },
};

/** Pendência é o que o responsável técnico precisa resolver; ok/info, não. */
const ehPendencia = (i: Item) => i.sev !== "ok" && i.sev !== "info";

function Row({ item }: { item: Item }) {
  const estilo = ESTILO[item.sev];
  const Icon = estilo.icone;
  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <span
        className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${estilo.tile}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium leading-snug">{item.label}</span>
          {ehPendencia(item) && (
            <span
              className={`rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ${estilo.chip}`}
            >
              {estilo.label}
            </span>
          )}
        </div>
        {item.detail && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
        )}
        {item.norma && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <BookMarked className="h-2.5 w-2.5 shrink-0" />
            {item.norma}
          </p>
        )}
      </div>
    </li>
  );
}

/*
 * Cada grupo de conferências. O cabeçalho conta quantas já estão conformes,
 * para o bloco se ler sem abrir — e, com o filtro em "pendências", um bloco
 * inteiro resolvido colapsa numa linha em vez de ocupar meia tela de verde.
 */
function Bloco({
  titulo,
  itens,
  somentePendencias,
}: {
  titulo: string;
  itens: Item[];
  somentePendencias: boolean;
}) {
  const visiveis = somentePendencias ? itens.filter(ehPendencia) : itens;
  const conferencias = itens.filter((i) => i.sev !== "info");
  const conformes = itens.filter((i) => i.sev === "ok").length;

  if (visiveis.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-sm font-medium text-emerald-800">{titulo}</span>
        <span className="ml-auto text-xs text-emerald-700">tudo conforme</span>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b bg-muted/30 px-4 py-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
          <span>{titulo}</span>
          <span className="text-xs font-normal tabular-nums text-muted-foreground">
            {conformes} de {conferencias.length} conforme
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {visiveis.map((it, i) => (
            <Row key={i} item={it} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Contador de severidade no topo — número grande, rótulo pequeno. */
function Contador({ sev, total }: { sev: Severidade; total: number }) {
  const estilo = ESTILO[sev];
  const vazio = total === 0;
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ring-1 ${vazio ? "bg-muted/40 ring-border" : estilo.chip}`}
    >
      <div className="text-xl font-semibold leading-none tabular-nums">{total}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {total === 1 ? estilo.label : estilo.plural}
      </div>
    </div>
  );
}

export default function PgrChecklistTab({ pgr }: Props) {
  const pgrId = pgr.id;

  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-chk-inv", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-chk-acoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: acaoRiscos = [] } = useQuery({
    queryKey: ["pgr-chk-acao-riscos", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_riscos")
        .select("acao_id,inventario_item_id").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: controles = [] } = useQuery({
    queryKey: ["pgr-chk-controles", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_risco_controles")
        .select("inventario_item_id,hierarquia,implementado").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ["pgr-chk-medicoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_avaliacao_medicoes")
        .select("inventario_item_id,resultado,unidade,limite_valor,limite_fonte").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: gatilhos = [] } = useQuery({
    queryKey: ["pgr-chk-gatilhos", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_gatilhos_revisao")
        .select("id,tipo,status,descricao").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: eficacias = [] } = useQuery({
    queryKey: ["pgr-chk-eficacia", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_eficacia")
        .select("acao_id,status").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["pgr-chk-resp", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_responsaveis")
        .select("id,papel,nome,registro_profissional").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: pdfVersoes = [] } = useQuery({
    queryKey: ["pgr-chk-pdf", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("*").eq("pgr_id", pgrId).order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-chk-assin", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas").select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const status = pgr.status as PgrStatus;
  const ultimoPdf = pdfVersoes[0];

  // ---------------------------------------------------------------------------
  // Cálculos
  // ---------------------------------------------------------------------------
  // Riscos que EXIGEM ação vêm da classificação vigente, não de uma lista fixa
  // de nomes de classe — que era o bug anterior: filtrava "alto"/"critico",
  // valores que a escala de 5 níveis não produz, então o checklist nunca
  // encontrava risco algum e aprovava a emissão silenciosamente.
  const exigemAcao = inventario.filter(
    (i) => i.necessita_acao === true || necessitaAcao(i.classificacao as PgrClasse),
  );
  const itensPorAcao = new Set(acaoRiscos.map((r) => r.inventario_item_id));
  acoes.forEach((a) => { if (a.inventario_item_id) itensPorAcao.add(a.inventario_item_id); });
  const acoesAtivas = acoes.filter((a) => a.status !== "cancelada");
  const semAcao = exigemAcao.filter(
    (i) => !acoes.some((a) => a.status !== "cancelada"
      && (a.inventario_item_id === i.id
        || acaoRiscos.some((r) => r.acao_id === a.id && r.inventario_item_id === i.id))),
  );

  const semGrupoExposto = inventario.filter((i) => !i.trabalhadores_expostos && !i.ghe_id && !i.setor_id);
  const semFonte = inventario.filter((i) => !(i.fonte_geradora || "").trim() && !(i.circunstancia || "").trim() && !(i.perigo_descricao || "").trim());
  const semJustificativa = inventario.filter(
    (i) =>
      !(i.justificativa_severidade || "").trim() &&
      !(i.justificativa_probabilidade || "").trim() &&
      !(i.justificativa || "").trim() &&
      !(i.tecnica_utilizada || "").trim(),
  );
  const naoAvaliados = inventario.filter((i) => !i.classificacao);
  const ergoSemAvaliacao = inventario.filter(
    (i) =>
      (i.grupo === "ergonomico" || i.grupo === "psicossocial") &&
      !(i.tecnica_utilizada || "").trim() &&
      i.avaliacao_estado !== "avaliado" &&
      !medicoes.some((m) => m.inventario_item_id === i.id),
  );
  const quantSemFonteLimite = medicoes.filter((m) => m.resultado != null && !(m.limite_fonte || "").trim());
  const soEpi = inventario.filter((i) => {
    const meus = controles.filter((c) => c.inventario_item_id === i.id);
    if (meus.length === 0) return false;
    return !meus.some((c) => c.implementado
      && ["eliminacao", "substituicao", "engenharia_epc"].includes(c.hierarquia));
  });

  const acoesSemResponsavel = acoesAtivas.filter((a) => !(a.responsavel_nome || "").trim());
  const acoesSemPrazo = acoesAtivas.filter((a) => !a.prazo);
  const acoesSemAcompanhamento = acoesAtivas.filter(
    (a) => !(a.forma_acompanhamento || "").trim() || !(a.indicador || "").trim(),
  );
  const atrasadas = acoes.filter((a) => isAtrasada(a));
  const concluidasSemVerificacao = acoes.filter(
    (a) => a.status === "concluida"
      && !eficacias.some((e) => e.acao_id === a.id
        && ["eficaz", "parcialmente_eficaz", "ineficaz"].includes(e.status)),
  );

  const gatilhosAbertos = gatilhos.filter((g) => ["aberto", "em_tratamento"].includes(g.status));
  const temRT = responsaveis.some((r) => r.papel === "responsavel_tecnico")
    || !!(pgr.resp_tec_nome || "").trim();
  const temAprovador = responsaveis.some((r) => ["aprovador", "responsavel_organizacao"].includes(r.papel));
  const pdfDesatualizado = ultimoPdf && (pgr as any).conteudo_atualizado_em
    && new Date((pgr as any).conteudo_atualizado_em).getTime()
       > new Date(ultimoPdf.gerado_em).getTime() + 500;
  const assinPdfAtual = ultimoPdf && assinaturas.some(
    (a) => a.pdf_versao === ultimoPdf.pdf_versao && a.pdf_hash === ultimoPdf.pdf_hash,
  );

  const hoje = new Date().toISOString().slice(0, 10);
  const revisaoVencida = !!pgr.proxima_revisao && pgr.proxima_revisao < hoje;

  const n = (arr: any[]) => arr.length;
  const sevSe = (cond: boolean, quando: Severidade): Severidade => (cond ? quando : "ok");

  // ---------------------------------------------------------------------------
  // Campos mínimos da NR-01
  // ---------------------------------------------------------------------------
  const normativos: Item[] = [
    { label: "Inventário de riscos preenchido",
      sev: sevSe(inventario.length === 0, "bloqueante"),
      detail: `${inventario.length} item(ns)`, norma: "NR-01 1.5.7.3.2" },
    { label: "Todo risco tem grupo de trabalhadores expostos",
      sev: sevSe(n(semGrupoExposto) > 0, "bloqueante"),
      detail: n(semGrupoExposto) > 0 ? `${n(semGrupoExposto)} risco(s) sem população exposta` : undefined,
      norma: "NR-01 1.5.7.3.2" },
    { label: "Todo perigo tem fonte ou circunstância",
      sev: sevSe(n(semFonte) > 0, "bloqueante"),
      detail: n(semFonte) > 0 ? `${n(semFonte)} risco(s) sem fonte` : undefined,
      norma: "NR-01 1.5.7.3.2" },
    { label: "Riscos avaliados e classificados",
      sev: sevSe(n(naoAvaliados) > 0, "bloqueante"),
      detail: n(naoAvaliados) > 0 ? `${n(naoAvaliados)} risco(s) sem classificação` : undefined,
      norma: "NR-01 1.5.7.3.2" },
    { label: "Justificativa técnica de severidade e probabilidade",
      sev: sevSe(n(semJustificativa) > 0, "alerta"),
      detail: n(semJustificativa) > 0 ? `${n(semJustificativa)} risco(s) sem justificativa registrada` : undefined,
      norma: "NR-01 1.5.4.4.2 — critérios documentados" },
    { label: "Matriz de risco documentada e versionada",
      sev: (pgr as any).matriz_versao_id ? "ok" : "bloqueante",
      detail: (pgr as any).matriz_versao_id ? "Versão travada neste PGR" : "PGR sem matriz travada",
      norma: "NR-01 1.5.4.4.2" },
    { label: "Riscos ergonômicos/psicossociais com avaliação vinculada",
      sev: sevSe(n(ergoSemAvaliacao) > 0, "alerta"),
      detail: n(ergoSemAvaliacao) > 0
        ? `${n(ergoSemAvaliacao)} risco(s) sem AEP/AET ou avaliação registrada`
        : undefined,
      norma: "NR-17 — questionário isolado não é gerenciamento" },
    { label: "Avaliação quantitativa com unidade, limite e fonte",
      sev: sevSe(n(quantSemFonteLimite) > 0, "alerta"),
      detail: n(quantSemFonteLimite) > 0
        ? `${n(quantSemFonteLimite)} medição(ões) sem fonte do limite` : undefined },
    { label: "Hierarquia de controles observada",
      sev: sevSe(n(soEpi) > 0, "alerta"),
      detail: n(soEpi) > 0
        ? `${n(soEpi)} risco(s) tratados apenas com EPI/medida administrativa`
        : undefined,
      norma: "NR-01 1.5.5.1.2 — EPI não é controle suficiente por si só" },
  ];

  // ---------------------------------------------------------------------------
  // Plano de ação
  // ---------------------------------------------------------------------------
  const plano: Item[] = [
    { label: "Riscos que exigem ação possuem ação vinculada",
      sev: exigemAcao.length === 0 ? "info"
        : sevSe(n(semAcao) > 0, "bloqueante"),
      detail: exigemAcao.length === 0
        ? "Nenhum risco na faixa que exige ação"
        : n(semAcao) > 0
          ? `${n(semAcao)} de ${exigemAcao.length} risco(s) sem ação`
          : `${exigemAcao.length} risco(s) cobertos`,
      norma: "NR-01 1.5.5.2.1" },
    { label: "Ações com responsável definido",
      sev: sevSe(n(acoesSemResponsavel) > 0, "bloqueante"),
      detail: n(acoesSemResponsavel) > 0 ? `${n(acoesSemResponsavel)} ação(ões) sem responsável` : undefined },
    { label: "Ações com prazo definido",
      sev: sevSe(n(acoesSemPrazo) > 0, "bloqueante"),
      detail: n(acoesSemPrazo) > 0 ? `${n(acoesSemPrazo)} ação(ões) sem prazo` : undefined },
    { label: "Ações com forma de acompanhamento e indicador",
      sev: sevSe(n(acoesSemAcompanhamento) > 0, "recomendacao"),
      detail: n(acoesSemAcompanhamento) > 0
        ? `${n(acoesSemAcompanhamento)} ação(ões) sem acompanhamento/indicador` : undefined },
    { label: "Ações concluídas com verificação de eficácia",
      sev: sevSe(n(concluidasSemVerificacao) > 0, "alerta"),
      detail: n(concluidasSemVerificacao) > 0
        ? `${n(concluidasSemVerificacao)} ação(ões) concluídas sem aferição — concluir não encerra o risco`
        : undefined,
      norma: "NR-01 1.5.4.4.6" },
    { label: "Ações dentro do prazo",
      sev: sevSe(n(atrasadas) > 0, "alerta"),
      detail: n(atrasadas) > 0 ? `${n(atrasadas)} ação(ões) com prazo vencido` : "Sem atrasos" },
  ];

  // ---------------------------------------------------------------------------
  // Governança e emissão
  // ---------------------------------------------------------------------------
  const governanca: Item[] = [
    { label: "Responsável técnico declarado",
      sev: temRT ? "ok" : "bloqueante",
      norma: "NR-01 1.5.7.2 — documento datado e assinado" },
    { label: "Revisão da avaliação dentro do prazo",
      sev: !pgr.proxima_revisao ? "recomendacao" : revisaoVencida ? "bloqueante" : "ok",
      detail: !pgr.proxima_revisao
        ? "Próxima revisão não definida"
        : revisaoVencida
          ? `Vencida em ${pgr.proxima_revisao.split("-").reverse().join("/")}`
          : `Até ${pgr.proxima_revisao.split("-").reverse().join("/")}`,
      norma: pgr.sgsst_certificado
        ? "Até 3 anos — organização certificada em SGSST"
        : "Máx. 2 anos (NR-01 1.5.4.4.6)" },
    { label: "PDF gerado", sev: ultimoPdf ? "ok" : "bloqueante",
      detail: ultimoPdf ? `Última versão: PDF v${ultimoPdf.pdf_versao}` : "Nenhum PDF gerado" },
    { label: "PDF atualizado em relação ao conteúdo",
      sev: !ultimoPdf ? "bloqueante" : pdfDesatualizado ? "alerta" : "ok",
      detail: pdfDesatualizado ? "Regenerar o PDF antes de publicar" : undefined },
    { label: "PDF final sem marca d'água de rascunho",
      sev: !ultimoPdf ? "bloqueante" : ultimoPdf.com_marca_dagua ? "alerta" : "ok" },
    { label: "Assinatura visual conferida com o PDF atual",
      sev: !temRT ? "info" : assinPdfAtual ? "ok" : "alerta",
      detail: !temRT ? "Sem responsável técnico declarado"
        : assinPdfAtual ? `Conferida com PDF v${ultimoPdf?.pdf_versao}`
        : "Falta assinatura visual do PDF atual" },
  ];

  const todos = [...normativos, ...plano, ...governanca];
  const bloqueantes = todos.filter((i) => i.sev === "bloqueante");
  const alertas = todos.filter((i) => i.sev === "alerta");
  const recomendacoes = todos.filter((i) => i.sev === "recomendacao");
  const podeEmitir = bloqueantes.length === 0;

  /* "info" é contexto, não conferência: não entra na conta de conformidade. */
  const conferencias = todos.filter((i) => i.sev !== "info");
  const conformes = todos.filter((i) => i.sev === "ok").length;
  const pct = conferencias.length ? Math.round((conformes / conferencias.length) * 100) : 0;

  /*
     O card do topo repetia, item por item, todas as pendências bloqueantes que
     já apareciam nos blocos logo abaixo — a mesma linha duas vezes na tela.
     Em lugar disso: os números no topo e um filtro. Quem abre a tela com
     pendência cai direto nela; quem quer o laudo inteiro clica em "Tudo".
  */
  const [somentePendencias, setSomentePendencias] = useState(!podeEmitir);
  const pendencias = todos.filter(ehPendencia);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden shadow-sm">
        <div className={`h-1 w-full ${podeEmitir ? "bg-emerald-500" : "bg-rose-500"}`} />
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                  podeEmitir ? ESTILO.ok.tile : ESTILO.bloqueante.tile
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold leading-tight">
                  Conformidade do documento
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {podeEmitir
                    ? "Nenhuma pendência bloqueante. Alertas e recomendações não impedem a emissão, mas devem ser avaliados pela revisão técnica."
                    : `${bloqueantes.length} ${
                        bloqueantes.length === 1 ? "pendência impede" : "pendências impedem"
                      } a emissão deste PGR.`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold leading-none tabular-nums">{pct}%</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                conforme
              </div>
            </div>
          </div>

          <div>
            <Progress value={pct} className="h-1.5" />
            <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
              {conformes} de {conferencias.length} conferências atendidas
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Contador sev="bloqueante" total={bloqueantes.length} />
            <Contador sev="alerta" total={alertas.length} />
            <Contador sev="recomendacao" total={recomendacoes.length} />
          </div>

          {status !== "rascunho" && status !== "em_revisao" && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              PGR <b className="font-semibold text-foreground">{status}</b> — abra uma revisão para
              alterar o conteúdo.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          Conferência item a item
        </h4>
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {[
            { id: true, texto: `Pendências (${pendencias.length})` },
            { id: false, texto: `Tudo (${todos.length})` },
          ].map((opcao) => (
            <button
              key={String(opcao.id)}
              type="button"
              onClick={() => setSomentePendencias(opcao.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                somentePendencias === opcao.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opcao.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Bloco
          titulo="Campos mínimos do inventário (NR-01)"
          itens={normativos}
          somentePendencias={somentePendencias}
        />
        <Bloco titulo="Plano de ação" itens={plano} somentePendencias={somentePendencias} />
        <Bloco
          titulo="Governança e emissão"
          itens={governanca}
          somentePendencias={somentePendencias}
        />
      </div>

      {/*
        A frase dizia que o sistema não implementa ICP-Brasil. Implementa: a
        Ficha de EPI sai assinada com certificado A1 e foi aprovada no
        validador do ITI. O que continua valendo é que ESTE documento, o PGR,
        ainda não passa por essa assinatura — e é isso que precisa estar
        escrito, em vez de uma negativa geral que ficou velha.
      */}
      <p className="rounded-xl border bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        O PGR é documento técnico interno: a validação é por assinatura visual e hash SHA-256. A
        assinatura digital ICP-Brasil já existe no sistema — hoje aplicada à Ficha de EPI —, mas
        ainda <b className="font-semibold">não</b> é aplicada a este documento.
      </p>
    </div>
  );
}
