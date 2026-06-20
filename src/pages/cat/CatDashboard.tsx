import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileCheck2, FilePlus2, Skull, Send, Clock } from "lucide-react";
import { CatRow, prazoLegal } from "@/lib/catTypes";

export default function CatDashboard() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();

  const { data: cats = [] } = useQuery({
    queryKey: ["cat-dashboard", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("cat_comunicacoes").select("id, empresa_id, status, data_acidente, obito, esocial_status");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("data_acidente", { ascending: false });
      if (error) throw error;
      return (data || []) as CatRow[];
    },
  });

  const abertas = cats.filter((c) => ["rascunho", "pronto_para_envio"].includes(c.status)).length;
  const concluidas = cats.filter((c) => ["concluida", "enviada_esocial"].includes(c.status)).length;
  const fatais = cats.filter((c) => c.obito).length;
  const criticas = cats.filter((c) => prazoLegal(c).critico).length;
  const pendentesESocial = cats.filter(
    (c) => c.status === "concluida" && c.esocial_status !== "enviada"
  ).length;
  const mesAtual = cats.filter((c) => {
    const d = new Date(c.data_acidente);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const cards = [
    { label: "CATs abertas", value: abertas, icon: FilePlus2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "CATs concluídas", value: concluidas, icon: FileCheck2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
    { label: "Prazo crítico", value: criticas, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Acidentes fatais", value: fatais, icon: Skull, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "Pendentes eSocial", value: pendentesESocial, icon: Send, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
    { label: "Registradas no mês", value: mesAtual, icon: Clock, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className={c.bg}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {criticas > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="text-sm">
              <strong>{criticas}</strong> CAT(s) com prazo crítico de comunicação.
              Acidentes fatais exigem comunicação <strong>imediata</strong>; demais casos têm
              prazo de <strong>24 horas</strong>.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
