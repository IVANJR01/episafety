import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FileText, CheckCircle2, XCircle, AlertTriangle, Clock, Users } from "lucide-react";
import { differenceInDays, parseISO, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_LABELS: Record<string, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno: "Retorno",
  mudanca_risco: "Mudança de Risco",
  demissional: "Demissional",
};

function Kpi({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AsoDashboard() {
  const { empresaScopeIds } = useAuth();
  const scopeKey = (empresaScopeIds || []).join(",");

  const { data: asos = [] } = useQuery({
    queryKey: ["aso-dashboard", scopeKey],
    queryFn: async () => {
      let q = supabase.from("asos")
        .select("id, tipo_exame, status_aptidao, data_emissao, data_vencimento, status, empresa_id");
      
      const ids = empresaScopeIds || [];
      if (ids.length > 0) {
        q = q.in("empresa_id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const today = new Date();
    const ativos = asos.filter((a: any) => a.status !== "cancelado");
    const aptos = ativos.filter((a: any) => a.status_aptidao === "apto").length;
    const inaptos = ativos.filter((a: any) => a.status_aptidao === "inapto").length;
    const restricao = ativos.filter((a: any) => a.status_aptidao === "apto_restricao").length;
    let vencidos = 0, vencendo = 0, validos = 0;
    ativos.forEach((a: any) => {
      if (!a.data_vencimento) return;
      const d = differenceInDays(parseISO(a.data_vencimento), today);
      if (d < 0) vencidos++;
      else if (d <= 30) vencendo++;
      else validos++;
    });
    const porTipo = Object.entries(TIPO_LABELS).map(([k, label]) => ({
      tipo: label,
      total: ativos.filter((a: any) => a.tipo_exame === k).length,
    }));
    // por mês últimos 6
    const meses: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = startOfMonth(subMonths(today, i));
      const key = format(m, "yyyy-MM");
      const label = format(m, "MMM/yy", { locale: ptBR });
      const total = ativos.filter((a: any) => a.data_emissao?.startsWith(key)).length;
      meses.push({ mes: label, total });
    }
    const statusPie = [
      { name: "Apto", value: aptos, color: "hsl(var(--primary))" },
      { name: "Apto c/ restrição", value: restricao, color: "hsl(45 93% 47%)" },
      { name: "Inapto", value: inaptos, color: "hsl(var(--destructive))" },
    ];
    return { total: ativos.length, aptos, inaptos, restricao, vencidos, vencendo, validos, porTipo, meses, statusPie };
  }, [asos]);

  return (
    <div className="space-y-4">
      {(stats.vencidos > 0 || stats.vencendo > 0) && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="text-sm">
              <strong>Atenção:</strong>{" "}
              {stats.vencidos > 0 && <span className="text-destructive">{stats.vencidos} ASO(s) vencido(s)</span>}
              {stats.vencidos > 0 && stats.vencendo > 0 && " · "}
              {stats.vencendo > 0 && <span className="text-orange-600">{stats.vencendo} vencendo em 30 dias</span>}
              . Acesse a aba <em>Relatórios</em> para detalhes.
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Total ASOs" value={stats.total} icon={FileText} color="bg-primary/10 text-primary" />
        <Kpi label="Aptos" value={stats.aptos} icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-600" />
        <Kpi label="Inaptos" value={stats.inaptos} icon={XCircle} color="bg-destructive/10 text-destructive" />
        <Kpi label="Apto c/ restrição" value={stats.restricao} icon={AlertTriangle} color="bg-amber-500/10 text-amber-600" />
        <Kpi label="Vencendo 30d" value={stats.vencendo} icon={Clock} color="bg-orange-500/10 text-orange-600" />
        <Kpi label="Vencidos" value={stats.vencidos} icon={AlertTriangle} color="bg-destructive/10 text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">ASOs por mês</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.meses}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por aptidão</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {stats.statusPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">ASOs por tipo de exame</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.porTipo}>
                <XAxis dataKey="tipo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
