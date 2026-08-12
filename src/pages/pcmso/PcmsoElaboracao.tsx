import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowLeft, ArrowRight, FileText, Loader2, Menu, Activity, CalendarDays, CheckCircle, FileBarChart
} from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";

import PcmsoCapaTab from "@/components/pcmso/PcmsoCapaTab";
import PcmsoCronogramaTab from "@/components/pcmso/PcmsoCronogramaTab";
import PcmsoMatrizTab from "@/components/pcmso/PcmsoMatrizTab";
import PcmsoRelatorioTab from "@/components/pcmso/PcmsoRelatorioTab";
import PcmsoEmissaoTab from "@/components/pcmso/PcmsoEmissaoTab";


type EtapaId = "configuracao" | "cronograma" | "matriz" | "relatorio" | "emissao";

interface Etapa {
  id: EtapaId;
  n: number;
  titulo: string;
  ajuda: string;
  icone: any;
}

const ETAPAS: Etapa[] = [
  { id: "configuracao", n: 1, titulo: "Configuração Básica", ajuda: "Dados do médico e vigência.", icone: FileText },
  { id: "cronograma", n: 2, titulo: "Cronograma de Ações", ajuda: "Calendário de saúde ocupacional.", icone: CalendarDays },
  { id: "matriz", n: 3, titulo: "Matriz de Saúde", ajuda: "Riscos e exames ocupacionais obrigatórios.", icone: Activity },
  { id: "relatorio", n: 4, titulo: "Relatório Analítico", ajuda: "Avaliação estatística anual de exames.", icone: FileBarChart },
  { id: "emissao", n: 5, titulo: "Revisão e Emissão", ajuda: "Validação e geração do PDF final.", icone: CheckCircle },
];

export default function PcmsoElaboracao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [menuAberto, setMenuAberto] = useState(false);

  const etapaSalva = params.get("etapa") || "configuracao";
  const etapaAtual = etapaSalva as EtapaId;
  const idx = Math.max(0, ETAPAS.findIndex((e) => e.id === etapaAtual));
  const etapa = ETAPAS[idx];

  const irPara = (e: EtapaId) => {
    const p = new URLSearchParams(params);
    p.set("etapa", e);
    setParams(p, { replace: false });
    setMenuAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { data: pcmso, isLoading } = useQuery({
    queryKey: ["pcmso-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pcmso_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Carregando PCMSO...</p>
      </div>
    );
  }

  if (!pcmso) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-xl">
        Documento não encontrado ou você não tem acesso.
      </div>
    );
  }

  // Renderiza a aba ativa
  let Conteudo = PcmsoCapaTab;
  if (etapaAtual === "cronograma") Conteudo = PcmsoCronogramaTab;
  else if (etapaAtual === "matriz") Conteudo = PcmsoMatrizTab;
  else if (etapaAtual === "relatorio") Conteudo = PcmsoRelatorioTab;
  else if (etapaAtual === "emissao") Conteudo = PcmsoEmissaoTab;

  // Sidebar List
  const renderedMenu = (
    <div className="flex flex-col space-y-1">
      {ETAPAS.map((e) => {
        const Icon = e.icone;
        const ativo = e.id === etapaAtual;
        return (
          <button
            key={e.id}
            onClick={() => irPara(e.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors font-medium text-sm ${
              ativo 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <div className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${ativo ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 truncate">{e.titulo}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] -m-4 sm:-m-8">
      {/* Header Fixo */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <div className="p-4 border-b">
                <div className="font-bold text-lg">Menu PCMSO</div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {renderedMenu}
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="icon" onClick={() => navigate("/pcmso/dashboard")} className="shrink-0 h-8 w-8 hidden sm:flex">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 truncate">
              <Badge variant="outline" className="shrink-0">v{pcmso.versao}</Badge>
              <Badge variant="outline" className={`shrink-0 ${PGR_STATUS_COLOR[pcmso.status as PgrStatus] || ""}`}>
                {PGR_STATUS_LABEL[pcmso.status as PgrStatus] || pcmso.status}
              </Badge>
              <h1 className="font-bold text-lg truncate hidden sm:block">PCMSO Documento</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-72 flex-col border-r bg-muted/10">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 px-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Etapas da Elaboração
              </h2>
            </div>
            {renderedMenu}
          </div>
        </aside>

        {/* Área Principal (Conteúdo da Aba) */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Título da Aba Ativa */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{etapa.titulo}</h2>
                  <p className="text-muted-foreground mt-1">{etapa.ajuda}</p>
                </div>
              </div>

              {/* Renderização do Componente da Aba */}
              <div className="mt-6">
                <Conteudo pcmso={pcmso} />
              </div>

              {/* Paginação entre abas */}
              <div className="flex items-center justify-between pt-8 border-t mt-12">
                {idx > 0 ? (
                  <Button variant="outline" onClick={() => irPara(ETAPAS[idx - 1].id)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
                  </Button>
                ) : <div />}
                
                {idx < ETAPAS.length - 1 ? (
                  <Button onClick={() => irPara(ETAPAS[idx + 1].id)}>
                    Próxima Etapa <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="mr-2 h-4 w-4" /> Concluir
                  </Button>
                )}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
