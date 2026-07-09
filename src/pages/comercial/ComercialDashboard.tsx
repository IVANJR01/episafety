import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatBRL, formatDate } from "@/lib/orcamentoCalc";
import { OrcamentoStatus, STATUS_LABEL } from "@/lib/orcamentoTypes";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FileText, TrendingUp, Users, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";

const CORES = ["#94a3b8", "#3b82f6", "#6366f1", "#22c55e", "#ef4444", "#f97316", "#71717a"];

export default function ComercialDashboard() {
  const { empresaId } = useAuth();
  const nav = useNavigate();

  const { data = [] } = useQuery({
    queryKey: ["orcamentos_dash", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("orcamentos")
        .select("id,total,status,data_emissao,data_validade,cliente_nome,aprovado_em");
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const isVenc = (o: any) => o.data_validade && o.data_validade < hoje && !["aprovado", "recusado", "cancelado"].includes(o.status);
    const em_aberto = data.filter((o: any) => ["rascunho", "enviado", "visualizado"].includes(o.status) && !isVenc(o));
    const aprovadas = data.filter((o: any) => o.status === "aprovado");
    const recusadas = data.filter((o: any) => o.status === "recusado");
    const vencidas = data.filter(isVenc);
    const decididas = aprovadas.length + recusadas.length;
    const mesAtual = new Date().toISOString().slice(0, 7);
    const aprovMes = aprovadas.filter((o: any) => (o.aprovado_em || "").slice(0, 7) === mesAtual);
    return {
      total: data.length,
      valorAberto: em_aberto.reduce((s: number, o: any) => s + Number(o.total || 0), 0),
      aprovadasCount: aprovadas.length,
      recusadasCount: recusadas.length,
      vencidasCount: vencidas.length,
      conversao: decididas ? (aprovadas.length / decididas) * 100 : 0,
      valorAprovMes: aprovMes.reduce((s: number, o: any) => s + Number(o.total || 0), 0),
      ticketMedio: aprovadas.length ? aprovadas.reduce((s: number, o: any) => s + Number(o.total || 0), 0) / aprovadas.length : 0,
    };
  }, [data]);

  const porStatus = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((o: any) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ name: STATUS_LABEL[k as OrcamentoStatus] || k, value: v }));
  }, [data]);

  const porMes = useMemo(() => {
    const map: Record<string, number> = {};
    data.filter((o: any) => o.status !== "recusado" && o.status !== "cancelado").forEach((o: any) => {
      const m = (o.data_emissao || "").slice(0, 7);
      if (!m) return;
      map[m] = (map[m] || 0) + Number(o.total || 0);
    });
    return Object.entries(map).sort().slice(-6).map(([k, v]) => ({ mes: k, total: v }));
  }, [data]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Dashboard Comercial"
        subtitle="Visão geral das propostas comerciais."
        actions={<Button onClick={() => nav("/comercial/orcamentos/novo")}><Plus className="w-4 h-4 mr-2" />Nova proposta</Button>}
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KPI icon={FileText} label="Total propostas" value={String(stats.total)} />
        <KPI icon={Clock} label="Valor em aberto" value={formatBRL(stats.valorAberto)} />
        <KPI icon={CheckCircle2} label="Aprovadas" value={String(stats.aprovadasCount)} accent="text-green-600" />
        <KPI icon={XCircle} label="Recusadas" value={String(stats.recusadasCount)} accent="text-red-600" />
        <KPI icon={Clock} label="Vencidas" value={String(stats.vencidasCount)} accent="text-orange-600" />
        <KPI icon={TrendingUp} label="Conversão" value={`${stats.conversao.toFixed(1)}%`} />
        <KPI icon={CheckCircle2} label="Aprovado no mês" value={formatBRL(stats.valorAprovMes)} accent="text-green-600" />
        <KPI icon={Users} label="Ticket médio" value={formatBRL(stats.ticketMedio)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Propostas por status</CardTitle></CardHeader>
          <CardContent>
            {porStatus.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                    {porStatus.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Faturamento previsto (últimos meses)</CardTitle></CardHeader>
          <CardContent>
            {porMes.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porMes}>
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                  <Bar dataKey="total" fill="#ea580c" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
        <div className={`text-lg md:text-xl font-bold mt-1 truncate ${accent || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
