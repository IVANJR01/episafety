import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ListChecks, FileText, PenLine, Send, Activity } from "lucide-react";
import { PgrDocumento, PgrStatus, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import { isAtrasada } from "@/lib/pgrAcoes";

interface Props { pgr: PgrDocumento }

export default function PgrResumoCards({ pgr }: Props) {
  const pgrId = pgr.id;

  const { data: inv = [] } = useQuery({
    queryKey: ["pgr-resumo-inv", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("id,classificacao").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-resumo-acoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acoes")
        .select("id,status,prazo").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: pdf } = useQuery({
    queryKey: ["pgr-resumo-pdf", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("*").eq("pgr_id", pgrId).order("pdf_versao", { ascending: false }).limit(1).maybeSingle();
      return data as any;
    },
  });

  const { data: assin } = useQuery({
    queryKey: ["pgr-resumo-assin", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("*").eq("pgr_id", pgrId).order("assinado_em", { ascending: false }).limit(1).maybeSingle();
      return data as any;
    },
  });

  const altoCrit = inv.filter((i: any) => i.classificacao === "alto" || i.classificacao === "critico").length;
  const ativas = acoes.filter((a: any) => a.status !== "cancelada");
  const concluidas = acoes.filter((a: any) => a.status === "concluida").length;
  const totalAtivas = ativas.length;
  const pct = totalAtivas ? Math.round((concluidas / totalAtivas) * 100) : 0;
  const atrasadas = acoes.filter((a: any) => isAtrasada(a)).length;

  const desatualizado = pdf && (pgr as any).conteudo_atualizado_em &&
    new Date((pgr as any).conteudo_atualizado_em).getTime() > new Date(pdf.gerado_em).getTime() + 500;

  const status = pgr.status as PgrStatus;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      <KCard icon={AlertTriangle} label="Riscos alto/crítico" value={altoCrit}
             tone={altoCrit > 0 ? "warn" : "ok"} />
      <KCard icon={Activity} label="Ações atrasadas" value={atrasadas}
             tone={atrasadas > 0 ? "fail" : "ok"} />
      <KCard icon={ListChecks} label="Conclusão do plano" value={`${pct}%`}
             tone={pct >= 80 ? "ok" : pct >= 40 ? "warn" : "fail"}
             detail={`${concluidas}/${totalAtivas}`} />
      <KCard icon={FileText} label="PDF"
             value={pdf ? `v${pdf.pdf_versao}` : "—"}
             tone={!pdf ? "fail" : desatualizado || pdf.com_marca_dagua ? "warn" : "ok"}
             detail={!pdf ? "Não gerado" :
                     pdf.com_marca_dagua ? "Rascunho" :
                     desatualizado ? "Desatualizado" : "Atualizado"} />
      <KCard icon={PenLine} label="Assinatura"
             value={assin ? `v${assin.pdf_versao}` : "—"}
             tone={assin ? "ok" : "warn"}
             detail={assin ? assin.responsavel_nome : "Sem assinatura"} />
      <KCard icon={Send} label="Status"
             value={PGR_STATUS_LABEL[status]}
             tone={status === "vigente" ? "ok" :
                   status === "rascunho" || status === "em_revisao" ? "warn" : "info"} />
    </div>
  );
}

function KCard({ icon: Icon, label, value, tone, detail }: {
  icon: any; label: string; value: any; tone: "ok"|"warn"|"fail"|"info"; detail?: string;
}) {
  const colorBg =
    tone === "ok" ? "bg-emerald-50 border-emerald-200" :
    tone === "warn" ? "bg-amber-50 border-amber-200" :
    tone === "fail" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200";
  const colorTxt =
    tone === "ok" ? "text-emerald-800" :
    tone === "warn" ? "text-amber-800" :
    tone === "fail" ? "text-red-800" : "text-slate-700";
  return (
    <Card className={`border ${colorBg}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <Icon className={`h-4 w-4 ${colorTxt}`} />
        </div>
        <div className={`text-lg font-bold mt-1 ${colorTxt}`}>{value}</div>
        {detail && <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div>}
      </CardContent>
    </Card>
  );
}
