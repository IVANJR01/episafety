import { useMemo } from "react";
import { Users, Building, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Funcionario {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
}

const COLORS = [
  "hsl(210, 70%, 55%)", "hsl(160, 60%, 45%)", "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 55%)", "hsl(350, 65%, 55%)", "hsl(190, 70%, 45%)",
  "hsl(100, 50%, 45%)", "hsl(25, 75%, 50%)", "hsl(240, 55%, 60%)",
  "hsl(330, 60%, 50%)",
];

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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Funcionários", value: stats.totalFuncionarios, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Setores", value: stats.totalSetores, icon: Building, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Funções / Cargos", value: stats.totalCargos, icon: Briefcase, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Cadastro</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`p-3 rounded-xl ${c.bg}`}>
                <c.icon className={`w-6 h-6 ${c.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gráfico por Setor */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" /> Funcionários por Setor
            </h2>
            {stats.setoresData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, stats.setoresData.length * 40)}>
                <BarChart data={stats.setoresData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} tick={{ fill: "hsl(var(--foreground))" }} />
                  <Tooltip formatter={(v: number) => [v, "Funcionários"]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {stats.setoresData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico por Cargo */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-600" /> Funcionários por Função / Cargo
            </h2>
            {stats.cargosData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, stats.cargosData.length * 40)}>
                <BarChart data={stats.cargosData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} tick={{ fill: "hsl(var(--foreground))" }} />
                  <Tooltip formatter={(v: number) => [v, "Funcionários"]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {stats.cargosData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
