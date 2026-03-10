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
  const valorEstoqueAtual = useMemo(() => {
    return epis.reduce((sum, e) => sum + (e.valor || 0) * e.estoque, 0);
  }, [epis]);

  const custoMensalData = useMemo(() => {
    const mesesSaida: Record<string, number> = {};
    entregas.forEach(e => {
      const epi = epis.find(ep => ep.id === e.epi_id);
      const valor = epi?.valor || 0;
      const mes = e.data?.substring(0, 7);
      if (mes) {
        mesesSaida[mes] = (mesesSaida[mes] || 0) + valor * e.quantidade;
      }
    });
    const meses = Object.keys(mesesSaida).sort().slice(-6);
    return meses.map(mes => ({
      mes: mes.split("-").reverse().join("/"),
      saida: Number(mesesSaida[mes].toFixed(2)),
      estoque: Number(valorEstoqueAtual.toFixed(2)),
    }));
  }, [entregas, epis, valorEstoqueAtual]);

  // valorEstoqueAtual already defined above

  const estoqueChartData = useMemo(() => {
    const items = epis
      .filter(e => (e.valor || 0) * e.estoque > 0)
      .map(e => ({
        nome: e.nome.length > 25 ? e.nome.substring(0, 22) + "..." : e.nome,
        valor: Number(((e.valor || 0) * e.estoque).toFixed(2)),
      }))
      .sort((a, b) => b.valor - a.valor);

    const top = items.slice(0, 5);
    const rest = items.slice(5);
    if (rest.length > 0) {
      top.push({ nome: "Outros", valor: Number(rest.reduce((s, d) => s + d.valor, 0).toFixed(2)) });
    }
    return top;
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

  // Consumo mensal por EPI com detalhamento por mês
  const { mediaMensalEPI, mesesOrdenados } = useMemo(() => {
    if (entregas.length === 0) return { mediaMensalEPI: [], mesesOrdenados: [] as string[] };

    const mesesSet = new Set<string>();
    const consumoPorEpi: Record<string, Record<string, number>> = {};

    entregas.forEach(e => {
      const mes = e.data?.substring(0, 7);
      if (!mes) return;
      mesesSet.add(mes);
      if (!consumoPorEpi[e.epi_id]) consumoPorEpi[e.epi_id] = {};
      consumoPorEpi[e.epi_id][mes] = (consumoPorEpi[e.epi_id][mes] || 0) + e.quantidade;
    });

    const mesesOrdenados = Array.from(mesesSet).sort().slice(-6);
    const totalMeses = mesesOrdenados.length || 1;

    const items = epis
      .map(epi => {
        const mesesEpi = consumoPorEpi[epi.id] || {};
        const totalEntregue = Object.values(mesesEpi).reduce((s, v) => s + v, 0);
        const media = totalEntregue / totalMeses;
        const mesesEstoque = media > 0 ? epi.estoque / media : null;

        return {
          id: epi.id,
          nome: epi.nome,
          totalEntregue,
          media: Number(media.toFixed(1)),
          estoqueAtual: epi.estoque,
          mesesEstoque: mesesEstoque !== null ? Number(mesesEstoque.toFixed(1)) : null,
          porMes: mesesEpi,
        };
      })
      .filter(e => e.totalEntregue > 0)
      .sort((a, b) => b.media - a.media);

    return { mediaMensalEPI: items, mesesOrdenados };
  }, [entregas, epis]);

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
    <div className="space-y-5 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Visão geral da Segurança do Trabalho</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-3 sm:p-5">
              <div className={`p-2 sm:p-3 rounded-xl bg-muted ${s.color}`}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{s.label}</p>
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
            Custo Mensal de EPIs — Saída vs Estoque
          </CardTitle>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--primary))' }} />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Saída (Total):</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">R$ {valorSaida.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(142, 71%, 45%)' }} />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Estoque Atual:</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">R$ {valorEstoqueAtual.toFixed(2)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {custoMensalData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado de custo disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={custoMensalData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toFixed(2)}`,
                    name === "saida" ? "Saída Mensal" : "Estoque Atual"
                  ]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend
                  formatter={(value: string) => value === "saida" ? "Saída Mensal" : "Estoque Atual"}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="saida" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="estoque" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
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
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={estoqueChartData}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="42%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  label={({ nome, percent, x, y, midAngle }: any) => {
                    const RADIAN = Math.PI / 180;
                    const radius = 105;
                    const cx2 = x + (midAngle > 90 && midAngle < 270 ? -8 : 8);
                    return (
                      <text
                        x={cx2}
                        y={y}
                        textAnchor={midAngle > 90 && midAngle < 270 ? "end" : "start"}
                        dominantBaseline="central"
                        style={{ fontSize: '11px', fill: 'hsl(var(--foreground))' }}
                      >
                        {nome} ({(percent * 100).toFixed(0)}%)
                      </text>
                    );
                  }}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                >
                  {estoqueChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  formatter={(value: string) => {
                    const item = estoqueChartData.find(d => d.nome === value);
                    return `${value} — R$ ${item?.valor.toFixed(2) || "0.00"}`;
                  }}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Média mensal de consumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Média Mensal de Consumo por EPI
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Base para planejamento de compras — quanto maior o consumo, mais atenção ao reabastecimento
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {mediaMensalEPI.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma entrega registrada para calcular média</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead className="text-right">Média/Mês</TableHead>
                  <TableHead className="text-right">Custo Médio/Mês</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead className="text-right">Duração Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mediaMensalEPI.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{e.media} un.</TableCell>
                    <TableCell className="text-right font-mono text-sm">R$ {e.custoMedio.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{e.estoqueAtual} un.</TableCell>
                    <TableCell className="text-right">
                      {e.mesesEstoque !== null ? (
                        <span className={`font-mono text-sm font-semibold ${e.mesesEstoque <= 1 ? "text-destructive" : e.mesesEstoque <= 3 ? "text-warning" : "text-green-600"}`}>
                          {e.mesesEstoque} {e.mesesEstoque === 1 ? "mês" : "meses"}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
