import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, AlertTriangle, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { getCachedData, isOnline } from "@/lib/offlineStorage";
import { isNetworkFailure } from "@/lib/offlineViewCache";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiSkeleton } from "@/components/ui/list-skeleton";

interface Stats {
  total: number;
  pendentes: number;
  solucionados: number;
  byGravidade: { name: string; value: number; fill: string }[];
  byStatus: { name: string; value: number; fill: string }[];
}

interface ConformidadeResumo {
  status: string;
  gravidade: string;
  empresa_id: string | null;
}

const GRAVIDADE_COLORS: Record<string, string> = {
  "LEVE": "hsl(var(--info))",
  "MODERADO": "hsl(var(--warning))",
  "GRAVE": "hsl(var(--destructive))",
  "RISCO CRÍTICO": "hsl(var(--foreground))",
};

const STATUS_COLORS: Record<string, string> = {
  "PENDENTE": "hsl(var(--warning))",
  "SOLUCIONADO": "hsl(var(--success))",
};

const LOAD_TIMEOUT_MS = 3000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs = LOAD_TIMEOUT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
};

function buildStats(data: ConformidadeResumo[]): Stats {
  const total = data.length;
  const pendentes = data.filter(d => d.status === "PENDENTE").length;
  const solucionados = data.filter(d => d.status === "SOLUCIONADO").length;

  const byStatus: Stats["byStatus"] = [];
  if (pendentes > 0) byStatus.push({ name: "Pendente", value: pendentes, fill: STATUS_COLORS.PENDENTE });
  if (solucionados > 0) byStatus.push({ name: "Solucionado", value: solucionados, fill: STATUS_COLORS.SOLUCIONADO });

  const gravCounts: Record<string, number> = {};
  data.forEach(d => {
    gravCounts[d.gravidade] = (gravCounts[d.gravidade] || 0) + 1;
  });

  const gravidadeOrder = ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"];
  const byGravidade = gravidadeOrder
    .filter(g => gravCounts[g])
    .map(g => ({
      name: g.charAt(0) + g.slice(1).toLowerCase(),
      value: gravCounts[g],
      fill: GRAVIDADE_COLORS[g] || "hsl(var(--muted-foreground))",
    }));

  return { total, pendentes, solucionados, byGravidade, byStatus };
}

export default function InspecoesDashboard() {
  const { empresaId } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, pendentes: 0, solucionados: 0, byGravidade: [], byStatus: [] });
  const [loading, setLoading] = useState(true);
  const cachedData = useMemo(() => {
    const cached = getCachedData<ConformidadeResumo>("conformidades") || [];
    return empresaId ? cached.filter(item => item.empresa_id === empresaId) : cached;
  }, [empresaId]);

  useEffect(() => {
    async function load() {
      if (!empresaId) {
        setStats(buildStats([]));
        setLoading(false);
        return;
      }

      setLoading(true);

      if (!isOnline()) {
        setStats(buildStats(cachedData));
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await withTimeout(
          (supabase
            .from("conformidades")
            .select("status, gravidade, empresa_id")
            .eq("empresa_id", empresaId)) as any
        ) as any;

        if (error) throw error;

        setStats(buildStats((data || []) as ConformidadeResumo[]));
      } catch (error) {
        if (cachedData.length > 0 || isNetworkFailure(error)) {
          setStats(buildStats(cachedData));
        } else {
          setStats(buildStats([]));
        }
      } finally {
        setLoading(false);
      }
    }

    void load();

    const handleOnline = () => void load();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [cachedData, empresaId]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Dashboard de Inspeções"
          subtitle="Visão geral das conformidades, gravidades e resolução."
        />
        <KpiSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard de Inspeções"
        subtitle="Visão geral das conformidades, gravidades e resolução."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Total de Inspeções" value={stats.total} icon={<ClipboardList className="w-5 h-5" />} color="text-primary" tone="bg-primary/10" />
        <KPICard label="Pendentes" value={stats.pendentes} icon={<Clock className="w-5 h-5" />} color="text-warning" tone="bg-warning/10" />
        <KPICard label="Solucionados" value={stats.solucionados} icon={<CheckCircle2 className="w-5 h-5" />} color="text-success" tone="bg-success/10" />
        <KPICard label="Taxa de Resolução" value={stats.total > 0 ? `${Math.round((stats.solucionados / stats.total) * 100)}%` : "—"} icon={<AlertTriangle className="w-5 h-5" />} color="text-info" tone="bg-info/10" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie Chart - Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byStatus.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                      {stats.byStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} registro(s)`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Gravidade */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Gravidade</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byGravidade.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byGravidade} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v} registro(s)`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {stats.byGravidade.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color, tone }: { label: string; value: number | string; icon: React.ReactNode; color: string; tone: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${tone} ${color}`}>{icon}</div>
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="font-bold text-lg leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
