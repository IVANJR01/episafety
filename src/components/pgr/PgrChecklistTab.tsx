import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Info, ShieldCheck } from "lucide-react";
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

const ICONE: Record<Severidade, typeof CheckCircle2> = {
  bloqueante: XCircle,
  alerta: AlertTriangle,
  recomendacao: Info,
  ok: CheckCircle2,
  info: Info,
};

const COR: Record<Severidade, string> = {
  bloqueante: "text-red-600",
  alerta: "text-amber-600",
  recomendacao: "text-blue-600",
  ok: "text-emerald-600",
  info: "text-slate-500",
};

const BADGE: Record<Severidade, string> = {
  bloqueante: "bg-red-100 text-red-800 border-red-300",
  alerta: "bg-amber-100 text-amber-800 border-amber-300",
  recomendacao: "bg-blue-100 text-blue-800 border-blue-300",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-300",
  info: "bg-slate-100 text-slate-700 border-slate-300",
};

const SEV_LABEL: Record<Severidade, string> = {
  bloqueante: "Bloqueante",
  alerta: "Alerta",
  recomendacao: "Recomendação",
  ok: "OK",
  info: "Info",
};

function Row({ item }: { item: Item }) {
  const Icon = ICONE[item.sev];
  return (
    <li className="flex items-start gap-2 py-1.5 border-b last:border-0">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${COR[item.sev]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm flex flex-wrap items-center gap-2">
          {item.label}
          {item.sev !== "ok" && item.sev !== "info" && (
            <Badge variant="outline" className={`${BADGE[item.sev]} text-[10px]`}>
              {SEV_LABEL[item.sev]}
            </Badge>
          )}
        </div>
        {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
        {item.norma && <div className="text-[10px] text-muted-foreground italic">{item.norma}</div>}
      </div>
    </li>
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
    (i) => !(i.justificativa_severidade || "").trim() || !(i.justificativa_probabilidade || "").trim(),
  );
  const naoAvaliados = inventario.filter((i) => !i.classificacao);
  const ergoSemAvaliacao = inventario.filter(
    (i) => (i.grupo === "ergonomico" || i.grupo === "psicossocial")
      && !medicoes.some((m) => m.inventario_item_id === i.id),
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
      norma: "NR-01 1.5.7.3.2 alínea f" },
    { label: "Todo perigo tem fonte ou circunstância",
      sev: sevSe(n(semFonte) > 0, "bloqueante"),
      detail: n(semFonte) > 0 ? `${n(semFonte)} risco(s) sem fonte` : undefined,
      norma: "NR-01 1.5.7.3.2 alínea d" },
    { label: "Riscos avaliados e classificados",
      sev: sevSe(n(naoAvaliados) > 0, "bloqueante"),
      detail: n(naoAvaliados) > 0 ? `${n(naoAvaliados)} risco(s) sem classificação` : undefined,
      norma: "NR-01 1.5.7.3.2 alínea k" },
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
      norma: "NR-01 1.5.4.4.3 — EPI não é controle suficiente por si só" },
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
      norma: "NR-01 1.5.5.1" },
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
      norma: "NR-01 1.5.7.3.2 — documento datado e assinado" },
    { label: "Aprovador / responsável pela organização declarado",
      sev: temAprovador ? "ok" : "recomendacao",
      detail: temAprovador ? undefined : "Nenhum aprovador cadastrado em Responsáveis" },
    { label: "Gatilhos de revisão tratados",
      sev: sevSe(n(gatilhosAbertos) > 0, "bloqueante"),
      detail: n(gatilhosAbertos) > 0
        ? `${n(gatilhosAbertos)} gatilho(s) em aberto — tratar ou dispensar com justificativa`
        : "Nenhum gatilho pendente",
      norma: "NR-01 1.5.4.4.5" },
    { label: "Revisão da avaliação dentro do prazo",
      sev: !pgr.proxima_revisao ? "recomendacao" : revisaoVencida ? "bloqueante" : "ok",
      detail: !pgr.proxima_revisao
        ? "Próxima revisão não definida"
        : revisaoVencida
          ? `Vencida em ${pgr.proxima_revisao.split("-").reverse().join("/")}`
          : `Até ${pgr.proxima_revisao.split("-").reverse().join("/")}`,
      norma: pgr.sgsst_certificado
        ? "Até 3 anos — organização certificada em SGSST"
        : "Máx. 2 anos (NR-01 1.5.4.4.4)" },
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

  const Bloco = ({ titulo, itens }: { titulo: string; itens: Item[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent><ul>{itens.map((it, i) => <Row key={i} item={it} />)}</ul></CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className={podeEmitir ? "border-emerald-300" : "border-red-300"}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> O que falta para emitir?
            </span>
            <Badge variant="outline" className={podeEmitir ? BADGE.ok : BADGE.bloqueante}>
              {podeEmitir ? "Sem bloqueios" : `${bloqueantes.length} bloqueante(s)`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={BADGE.bloqueante}>Bloqueantes: {bloqueantes.length}</Badge>
            <Badge variant="outline" className={BADGE.alerta}>Alertas: {alertas.length}</Badge>
            <Badge variant="outline" className={BADGE.recomendacao}>Recomendações: {recomendacoes.length}</Badge>
          </div>
          {bloqueantes.length > 0 ? (
            <ul className="mt-1">{bloqueantes.map((it, i) => <Row key={i} item={it} />)}</ul>
          ) : (
            <p className="text-sm text-emerald-700">
              Nenhuma pendência bloqueante. Alertas e recomendações não impedem a emissão,
              mas devem ser avaliados pela revisão técnica.
            </p>
          )}
          {status !== "rascunho" && status !== "em_revisao" && (
            <p className="text-xs text-muted-foreground">
              PGR <b>{status}</b> — abra uma revisão para alterar o conteúdo.
            </p>
          )}
        </CardContent>
      </Card>

      <Bloco titulo="Campos mínimos do inventário (NR-01)" itens={normativos} />
      <Bloco titulo="Plano de ação" itens={plano} />
      <Bloco titulo="Governança e emissão" itens={governanca} />

      <div className="text-[11px] text-muted-foreground">
        Documento técnico interno com assinatura visual e hash SHA-256. Esta fase <b>não</b> implementa
        ICP-Brasil, certificado digital, eSocial S-2240 ou integração com órgãos externos.
      </div>
    </div>
  );
}
