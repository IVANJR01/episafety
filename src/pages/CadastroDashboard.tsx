import { useMemo } from "react";
import { Users, Building, Briefcase, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiSkeleton } from "@/components/ui/list-skeleton";

interface Funcionario {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
}

const COLORS = [
  "hsl(24, 95%, 53%)", "hsl(160, 60%, 45%)", "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 55%)", "hsl(350, 65%, 55%)", "hsl(190, 70%, 45%)",
  "hsl(100, 50%, 45%)", "hsl(25, 75%, 50%)", "hsl(240, 55%, 60%)",
  "hsl(330, 60%, 50%)",
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function CadastroDashboard() {
  const { data: funcionarios, loading } = useSupabaseQuery<Funcionario>("funcionarios", "nome", true);

  const stats = useMemo(() => {
    const setoresMap: Record<string, number> = {};
    const cargosMap: Record<string, number> = {};

    funcionarios.forEach(f => {
      if (f.setor) setoresMap[f.setor] = (setoresMap[f.setor] || 0) + 1;
      if (f.cargo) cargosMap[f.cargo] = (cargosMap[f.cargo] || 0) + 1;
    });

    const setoresData = Object.entries(setoresMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const cargosData = Object.entries(cargosMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalFuncionarios: funcionarios.length,
      totalSetores: Object.keys(setoresMap).length,
      totalCargos: Object.keys(cargosMap).length,
      setoresData,
      cargosData,
    };
  }, [funcionarios]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Cadastro"
          subtitle="Visão geral dos cadastros da empresa."
        />
        <KpiSkeleton count={3} />
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Funcionários",
      value: stats.totalFuncionarios,
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      label: "Setores",
      value: stats.totalSetores,
      icon: Building,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Funções / Cargos",
      value: stats.totalCargos,
      icon: Briefcase,
      gradient: "from-amber-500/20 to-amber-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3"
      >
        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Cadastro</h1>
          <p className="text-sm text-muted-foreground">Visão geral dos cadastros da empresa</p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((c, i) => (
          <motion.div
            key={c.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className={`relative overflow-hidden border ${c.borderColor} hover:shadow-lg transition-shadow duration-300`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} pointer-events-none`} />
              <CardContent className="relative flex items-center gap-4 p-6">
                <div className={`p-3.5 rounded-2xl ${c.iconBg} ring-1 ring-inset ring-white/10`}>
                  <c.icon className={`w-6 h-6 ${c.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-extrabold text-foreground">{c.value}</p>
                    <TrendingUp className={`w-4 h-4 mb-1.5 ${c.iconColor} opacity-60`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico por Setor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/60 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-0">
              <div className="flex items-center gap-2.5 px-6 pt-6 pb-4">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Building className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Funcionários por Setor</h2>
                  <p className="text-xs text-muted-foreground">{stats.setoresData.length} setores cadastrados</p>
                </div>
              </div>
              <div className="px-2 sm:px-6 pb-4 sm:pb-6">
                {stats.setoresData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Building className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum setor cadastrado</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, stats.setoresData.length * 44)}>
                    <BarChart data={stats.setoresData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                      <XAxis type="number" allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={100} fontSize={11} tick={{ fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v: number) => [v, "Funcionários"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: 13,
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={26}>
                        {stats.setoresData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gráfico por Cargo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/60 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-0">
              <div className="flex items-center gap-2.5 px-6 pt-6 pb-4">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Briefcase className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Funcionários por Função / Cargo</h2>
                  <p className="text-xs text-muted-foreground">{stats.cargosData.length} cargos cadastrados</p>
                </div>
              </div>
              <div className="px-2 sm:px-6 pb-4 sm:pb-6">
                {stats.cargosData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Briefcase className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum cargo cadastrado</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, stats.cargosData.length * 44)}>
                    <BarChart data={stats.cargosData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                      <XAxis type="number" allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={100} fontSize={11} tick={{ fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v: number) => [v, "Funcionários"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: 13,
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={26}>
                        {stats.cargosData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
