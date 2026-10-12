import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PgrDocumento, PgrStatus, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, ShieldCheck, History,
  Sparkles, CheckCircle2, AlertTriangle, Layers, ListChecks,
  Building2, UserCheck, Clock, FileDown, Check
} from "lucide-react";
import PgrPdfTab from "./PgrPdfTab";
import PgrPendenciasPainel, { usePgrPendencias } from "./PgrPendenciasPainel";
import PgrChecklistTab from "./PgrChecklistTab";
import HistoricoRevisoes from "./HistoricoRevisoes";

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
  canExport: boolean;
  canAssinar: boolean;
  onIrParaEtapa?: (etapa: string) => void;
}

export default function PgrEmissaoDashboard({
  pgr,
  canEdit,
  canExport,
  canAssinar,
  onIrParaEtapa,
}: Props) {
  const [tabAtiva, setTabAtiva] = useState<string>("emissao");

  // Estatísticas rápidas de conformidade e contagens para o Hero Header
  const { pendencias, resumo, isLoading: carregandoPendencias } = usePgrPendencias(
    pgr.id,
    pgr.resp_tec_nome
  );

  const { data: contagens } = useQuery({
    queryKey: ["pgr-emissao-contagens", pgr.id],
    queryFn: async () => {
      const [invRes, acoesRes] = await Promise.all([
        (supabase.from as any)("pgr_inventario_itens")
          .select("id", { count: "exact", head: true })
          .eq("pgr_id", pgr.id),
        (supabase.from as any)("pgr_acoes")
          .select("id", { count: "exact", head: true })
          .eq("pgr_id", pgr.id),
      ]);
      return {
        totalRiscos: invRes.count ?? 0,
        totalAcoes: acoesRes.count ?? 0,
      };
    },
  });

  const temBloqueio = (resumo?.bloqueios || 0) > 0;
  const status = pgr.status as PgrStatus;

  const corStatus: Record<PgrStatus, { bg: string; text: string; dot: string }> = {
    rascunho: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300", dot: "bg-amber-400" },
    em_revisao_tecnica: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-300", dot: "bg-sky-400" },
    aguardando_aprovacao: { bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-300", dot: "bg-indigo-400" },
    aguardando_assinatura: { bg: "bg-violet-500/15 border-violet-500/30", text: "text-violet-300", dot: "bg-violet-400" },
    vigente: { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" },
    em_revisao: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300", dot: "bg-amber-400" },
    substituido: { bg: "bg-slate-500/15 border-slate-500/30", text: "text-slate-300", dot: "bg-slate-400" },
    arquivado: { bg: "bg-slate-500/15 border-slate-500/30", text: "text-slate-300", dot: "bg-slate-400" },
  };

  const statusVisual = corStatus[status] || corStatus.rascunho;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HERO PANEL: VISUAL EXECUTIVO PREMIUM                                      */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        {/* Glows de ambientação sutis */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Painel Executivo
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusVisual.bg} ${statusVisual.text}`}>
                  <span className={`w-2 h-2 rounded-full ${statusVisual.dot} animate-pulse`} />
                  {PGR_STATUS_LABEL[status] || status}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80 font-mono">
                  Versão {pgr.versao}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Revisão e Emissão do PGR
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Central oficial de emissão, geração de relatórios (PDF, Word, Excel) e validação técnica de conformidade com a NR-01.
              </p>
            </div>

            {/* Ação rápida direta no Header */}
            <div className="flex items-center gap-3 shrink-0">
              <Button
                size="lg"
                onClick={() => setTabAtiva("emissao")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all hover:scale-[1.02]"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Ir para Emissão
              </Button>
            </div>
          </div>

          {/* KPI CARDS: DADOS CHAVE COMPACTOS E MODERNOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* 1. Status Normativo NR-01 */}
            <div
              onClick={() => setTabAtiva("validacao")}
              className="cursor-pointer group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 font-medium">Conformidade NR-01</span>
                <div className="flex items-center gap-1.5">
                  {temBloqueio ? (
                    <span className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {resumo.bloqueios} pendência(s)
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> 100% Conforme
                    </span>
                  )}
                </div>
              </div>
              <ShieldCheck className={`w-7 h-7 ${temBloqueio ? "text-amber-400/40" : "text-emerald-400/40"} group-hover:scale-110 transition-transform`} />
            </div>

            {/* 2. Riscos Inventariados */}
            <div
              onClick={() => onIrParaEtapa?.("inventario")}
              className="cursor-pointer group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 font-medium">Inventário de Riscos</span>
                <div className="text-sm font-semibold text-white">
                  {contagens?.totalRiscos ?? "—"} itens avaliados
                </div>
              </div>
              <Layers className="w-7 h-7 text-indigo-400/40 group-hover:scale-110 transition-transform" />
            </div>

            {/* 3. Ações no Plano */}
            <div
              onClick={() => onIrParaEtapa?.("acoes")}
              className="cursor-pointer group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 font-medium">Plano de Ação</span>
                <div className="text-sm font-semibold text-white">
                  {contagens?.totalAcoes ?? "—"} medidas cadastradas
                </div>
              </div>
              <ListChecks className="w-7 h-7 text-sky-400/40 group-hover:scale-110 transition-transform" />
            </div>

            {/* 4. Responsável Técnico */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0 pr-1">
                <span className="text-xs text-slate-400 font-medium">Responsável Técnico</span>
                <div className="text-sm font-semibold text-white truncate" title={pgr.resp_tec_nome || "Não definido"}>
                  {pgr.resp_tec_nome || "Pendente"}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {pgr.resp_tec_registro || "Sem registro"}
                </div>
              </div>
              <UserCheck className="w-7 h-7 text-slate-500/40 shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABS DE NAVEGAÇÃO LIMPA E ORGANIZADA                                      */}
      {/* ========================================================================= */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full space-y-6">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 p-1.5 bg-muted/80 backdrop-blur-sm rounded-xl border border-border/60 h-auto gap-1">
          <TabsTrigger
            value="emissao"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold rounded-lg text-xs md:text-sm"
          >
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>1. Documento Oficial</span>
          </TabsTrigger>

          <TabsTrigger
            value="validacao"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold rounded-lg text-xs md:text-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>2. Checklist NR-01</span>
            {temBloqueio && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {resumo.bloqueios}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="historico"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold rounded-lg text-xs md:text-sm"
          >
            <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>3. Histórico (20 anos)</span>
          </TabsTrigger>
        </TabsList>

        {/* --------------------------------------------------------------------- */}
        {/* ABA 1: DOCUMENTO OFICIAL & EXPORTAÇÕES                                */}
        {/* --------------------------------------------------------------------- */}
        <TabsContent value="emissao" className="space-y-4 focus-visible:outline-none">
          <PgrPdfTab
            pgr={pgr}
            canEdit={canEdit}
            canExport={canExport}
            canAssinar={canAssinar}
          />
        </TabsContent>

        {/* --------------------------------------------------------------------- */}
        {/* ABA 2: CHECKLIST & CONFERÊNCIA NORMATIVA                              */}
        {/* --------------------------------------------------------------------- */}
        <TabsContent value="validacao" className="space-y-6 focus-visible:outline-none">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">O que falta para emitir</h2>
            <p className="text-sm text-muted-foreground">
              Pendências técnicas que impedem a publicação da versão final do PGR.
            </p>
            <PgrPendenciasPainel
              pgrId={pgr.id}
              respTecNome={pgr.resp_tec_nome}
              onIrParaEtapa={onIrParaEtapa}
            />
          </div>

          <div className="space-y-2 border-t pt-6">
            <h2 className="text-lg font-semibold tracking-tight">Conferência normativa detalhada</h2>
            <p className="text-sm text-muted-foreground">
              Checagem item a item contra os requisitos mandatórios da Norma Regulamentadora nº 01 (NR-01).
            </p>
            <PgrChecklistTab pgr={pgr} />
          </div>
        </TabsContent>

        {/* --------------------------------------------------------------------- */}
        {/* ABA 4: HISTÓRICO DE REVISÕES                                          */}
        {/* --------------------------------------------------------------------- */}
        <TabsContent value="historico" className="space-y-4 focus-visible:outline-none">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Histórico de atualizações e revisões</h2>
            <p className="text-sm text-muted-foreground">
              Atendimento ao item 1.5.7.3.3.1 da NR-01: o histórico de todas as alterações deste PGR deve ser mantido disponível por 20 anos.
            </p>
          </div>
          <HistoricoRevisoes pgrId={pgr.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
