import { useMemo } from "react";
import { Users, Building, Briefcase, TrendingUp, AlertCircle, CheckCircle2, Clock, ClipboardList, Zap } from "lucide-react";
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

interface Inspecao {
  id: string;
  numero: number;
  status: string;
  foto_antes: string | null;
  foto_antes_path: string | null;
}

interface Obra {
  id: string;
  nome: string;
  status: string;
}

interface PgrAcao {
  id: string;
  status: string;
  prioridade: string;
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
  const { data: funcionarios, loading: loadingFunc } = useSupabaseQuery<Funcionario>("funcionarios", "nome", true);
  const { data: inspecoes, loading: loadingInsp } = useSupabaseQuery<Inspecao>("conformidade", "numero", false);
  const { data: obras, loading: loadingObras } = useSupabaseQuery<Obra>("obras", "nome", true);
  const { data: pgr_acoes, loading: loadingAcoes } = useSupabaseQuery<PgrAcao>("pgr_acoes", null, true);

  const loading = loadingFunc || loadingInsp || loadingObras || loadingAcoes;

  const stats = useMemo(() => {
    // Funcionários
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

    // Inspeções
    const inspecoesComFoto = inspecoes.filter(i => i.foto_antes || i.foto_antes_path).length;
    const inspecoesStatus: Record<string, number> = {};
    inspecoes.forEach(i => {
      inspecoesStatus[i.status] = (inspecoesStatus[i.status] || 0) + 1;
    });

    // Obras
    const obrasStatus: Record<string, number> = {};
    obras.forEach(o => {
      obrasStatus[o.status] = (obrasStatus[o.status] || 0) + 1;
    });

    // PGR Ações
    const acoesStatus: Record<string, number> = {};
    pgr_acoes.forEach(a => {
      acoesStatus[a.status] = (acoesStatus[a.status] || 0) + 1;
    });

    return {
      // Funcionários
      totalFuncionarios: funcionarios.length,
      totalSetores: Object.keys(setoresMap).length,
      totalCargos: Object.keys(cargosMap).length,
      setoresData,
      cargosData,
      // Inspeções
      totalInspecoes: inspecoes.length,
      inspecoesComFoto,
      inspecoesStatus,
      // Obras
      totalObras: obras.length,
      obrasStatus,
      // PGR Ações
      totalAcoes: pgr_acoes.length,
      acoesStatus,
    };
  }, [funcionarios, inspecoes, obras, pgr_acoes]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Visão integrada dos cadastros e operações da empresa."
        />
        <KpiSkeleton count={5} />
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
      label: "Inspeções",
      value: stats.totalInspecoes,
      subtitle: `${stats.inspecoesComFoto} com foto`,
      icon: ClipboardList,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Locais de Trabalho",
      value: stats.totalObras,
      icon: Building,
      gradient: "from-amber-500/20 to-amber-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      borderColor: "border-amber-500/20",
    },
    {
      label: "Ações do PGR",
      value: stats.totalAcoes,
      icon: Zap,
      gradient: "from-red-500/20 to-red-500/5",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-500",
      borderColor: "border-red-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Visão integrada dos cadastros e operações da empresa."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {(c as any).subtitle && <p className="text-xs text-muted-foreground mt-1">{(c as any).subtitle}</p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inspeções Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/60 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Status das Inspeções</h2>
                  <p className="text-xs text-muted-foreground">{stats.totalInspecoes} inspeções cadastradas</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.inspecoesStatus).length === 0 ? (
                  <EmptyState icon={ClipboardList} title="Nenhuma inspeção cadastrada" description="Cadastre inspeções para ver o status aqui." bare />
                ) : (
                  Object.entries(stats.inspecoesStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        {status === "SOLUCIONADO" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {status === "EM ANDAMENTO" && <Clock className="w-4 h-4 text-amber-600" />}
                        {status === "PENDENTE" && <AlertCircle className="w-4 h-4 text-red-600" />}
                        <span className="text-sm font-medium">{status}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* PGR Ações Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="overflow-hidden border-border/60 hover:shadow-lg transition-shadow duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Zap className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Status das Ações do PGR</h2>
                  <p className="text-xs text-muted-foreground">{stats.totalAcoes} ações cadastradas</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.acoesStatus).length === 0 ? (
                  <EmptyState icon={Zap} title="Nenhuma ação cadastrada" description="Cadastre ações do PGR para ver o status aqui." bare />
                ) : (
                  Object.entries(stats.acoesStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        {status === "CONCLUÍDA" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {status === "EM PROGRESSO" && <Clock className="w-4 h-4 text-amber-600" />}
                        {status === "PENDENTE" && <AlertCircle className="w-4 h-4 text-red-600" />}
                        <span className="text-sm font-medium">{status}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailedisablesection Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico por Setor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
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
                  <EmptyState icon={Building} title="Nenhum setor cadastrado" description="Cadastre funcionários com setor para visualizar a distribuição." bare />
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
          transition={{ delay: 0.6, duration: 0.5 }}
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
                  <EmptyState icon={Briefcase} title="Nenhum cargo cadastrado" description="Cadastre funcionários com cargo/função para visualizar a distribuição." bare />
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
