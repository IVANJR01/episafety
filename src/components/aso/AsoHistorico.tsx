import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDown, Clock } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { gerarPdfAso } from "@/lib/asoPdf";

const TIPO: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", retorno: "Retorno",
  mudanca_risco: "Mudança de Risco", demissional: "Demissional",
};

export default function AsoHistorico({ funcionarioId }: { funcionarioId: string }) {
  const { data: asos = [], isLoading } = useQuery({
    queryKey: ["aso-historico", funcionarioId],
    queryFn: async () => (await supabase.from("asos").select("*, aso_medicos:medico_id (nome, crm, uf_crm)")
      .eq("funcionario_id", funcionarioId).order("data_emissao", { ascending: false })).data || [],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!asos.length) return <p className="text-sm text-muted-foreground italic">Nenhum ASO emitido para este funcionário.</p>;

  return (
    <div className="space-y-2">
      {asos.map((a: any) => {
        const d = a.data_vencimento ? differenceInDays(parseISO(a.data_vencimento), new Date()) : null;
        const status = a.status === "cancelado" ? { l: "Cancelado", c: "bg-muted text-muted-foreground" }
          : d === null ? { l: "—", c: "bg-muted" }
          : d < 0 ? { l: "Vencido", c: "bg-destructive/15 text-destructive" }
          : d <= 30 ? { l: "Vencendo", c: "bg-orange-500/15 text-orange-600" }
          : { l: "Válido", c: "bg-emerald-500/15 text-emerald-700" };
        return (
          <Card key={a.id}>
            <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{a.numero_aso}</div>
                  <div className="font-medium">{TIPO[a.tipo_exame] || a.tipo_exame}</div>
                  <div className="text-xs text-muted-foreground">
                    Emitido em {a.data_emissao && format(parseISO(a.data_emissao), "dd/MM/yyyy")}
                    {a.data_vencimento && ` · Validade ${format(parseISO(a.data_vencimento), "dd/MM/yyyy")}`}
                    {a.aso_medicos?.nome && ` · Dr(a). ${a.aso_medicos.nome}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={status.c + " border-0"}>{status.l}</Badge>
                <Button size="sm" variant="outline" onClick={() => gerarPdfAso(a.id)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
