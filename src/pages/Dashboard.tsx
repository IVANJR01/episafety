import { Package, Users, ClipboardList, AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

interface EPI { id: string; nome: string; estoque: number; estoque_minimo: number; valor: number | null; }
interface Funcionario { id: string; nome: string; }
interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; created_at: string; }

export default function Dashboard() {
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: entregas } = useSupabaseQuery<Entrega>("entregas", "created_at");

  const alertasEstoque = epis.filter(e => e.estoque <= e.estoque_minimo);

  // Calculate monthly costs
  const custoMensal = useMemo(() => {
    const meses: Record<string, number> = {};
    entregas.forEach(e => {
      const epi = epis.find(ep => ep.id === e.epi_id);
      const valor = epi?.valor || 0;
      const mes = e.data?.substring(0, 7); // YYYY-MM
      if (mes) {
        meses[mes] = (meses[mes] || 0) + valor * e.quantidade;
      }
    });
    return Object.entries(meses)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, total]) => ({
        mes: mes.split("-").reverse().join("/"),
        total: Number(total.toFixed(2)),
      }));
  }, [entregas, epis]);

  const custoTotal = custoMensal.reduce((s, m) => s + m.total, 0);

  const valorEstoqueAtual = useMemo(() => {
    return epis.reduce((sum, e) => sum + (e.valor || 0) * e.estoque, 0);
  }, [epis]);

  const estoqueChartData = useMemo(() => {
    return epis
      .filter(e => (e.valor || 0) * e.estoque > 0)
      .map(e => ({
        nome: e.nome.length > 20 ? e.nome.substring(0, 20) + "..." : e.nome,
        valor: Number(((e.valor || 0) * e.estoque).toFixed(2)),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [epis]);

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(25, 95%, 53%)",
    "hsl(142, 71%, 45%)",
    "hsl(47, 95%, 53%)",
    "hsl(199, 89%, 48%)",
    "hsl(262, 83%, 58%)",
    "hsl(346, 77%, 50%)",
    "hsl(173, 80%, 40%)",
  ];

  const valorSaida = useMemo(() => {
    return entregas.reduce((sum, e) => {
      const epi = epis.find(ep => ep.id === e.epi_id);
      return sum + (epi?.valor || 0) * e.quantidade;
    }, 0);
  }, [entregas, epis]);

  const stats = [
    { label: "EPIs Cadastrados", value: epis.length, icon: Package, color: "text-primary" },
    { label: "Funcionários", value: funcionarios.length, icon: Users, color: "text-success" },
    { label: "Entregas", value: entregas.length, icon: ClipboardList, color: "text-muted-foreground" },
    { label: "Alertas", value: alertasEstoque.length, icon: AlertTriangle, color: "text-warning" },
  ];

  const recentEntregas = entregas.slice(0, 5).map(e => ({
    ...e,
    funcionarioNome: funcionarios.find(f => f.id === e.funcionario_id)?.nome || "—",
    epiNome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da Segurança do Trabalho</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`p-3 rounded-xl bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly cost chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Custo Mensal de EPIs
          </CardTitle>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Valor de Saída (Total):</span>
              <span className="text-sm font-bold font-mono text-foreground">R$ {valorSaida.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Valor do Estoque Atual:</span>
              <span className="text-sm font-bold font-mono text-foreground">R$ {valorEstoqueAtual.toFixed(2)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {custoMensal.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado de custo disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={custoMensal}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Custo"]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Stock value chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Valor do Estoque Atual por EPI
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-bold font-mono text-foreground">R$ {valorEstoqueAtual.toFixed(2)}</span>
          </p>
        </CardHeader>
        <CardContent>
          {estoqueChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum EPI com valor em estoque</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={estoqueChartData}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                >
                  {estoqueChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {alertasEstoque.length > 0 && (
          <Card className="border-warning/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Alertas de Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertasEstoque.map(a => (
                <div key={a.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-warning/5">
                  <span><span className="font-medium">{a.nome}</span> — estoque baixo</span>
                  <span className="text-warning font-mono text-xs">{a.estoque} un.</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimas Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEntregas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega registrada</p>
            ) : (
              <div className="space-y-2">
                {recentEntregas.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">{e.funcionarioNome}</span>
                      <span className="text-muted-foreground"> — {e.epiNome} ({e.quantidade}x)</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{e.data}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
