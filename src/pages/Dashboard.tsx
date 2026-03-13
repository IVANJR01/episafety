import { Package, Users, ClipboardList, AlertTriangle, DollarSign, TrendingUp, GraduationCap } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

interface EPI { id: string; nome: string; estoque: number; estoque_minimo: number; valor: number | null; }
interface Funcionario { id: string; nome: string; }
interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; created_at: string; tipo: string; }

export default function Dashboard() {
  const isMobile = useIsMobile();
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

    const mesesOrdenados = Array.from(mesesSet).sort().slice(-12);
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
          ) : isMobile ? (
            <ResponsiveContainer width="100%" height={Math.max(200, estoqueChartData.length * 48)}>
              <BarChart data={estoqueChartData} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {estoqueChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(250, estoqueChartData.length * 48)}>
              <BarChart data={estoqueChartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <YAxis type="category" dataKey="nome" width={140} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Valor"]}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {estoqueChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Mobile: Tabs | Desktop: stacked */}
      {isMobile ? (
        <Tabs defaultValue="consumo" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="consumo" className="text-xs">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Consumo
            </TabsTrigger>
            <TabsTrigger value="alertas" className="text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Alertas
              {alertasEstoque.length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5">{alertasEstoque.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="entregas" className="text-xs">
              <ClipboardList className="w-3.5 h-3.5 mr-1" /> Entregas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consumo">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Média Mensal de Consumo
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Planejamento de compras</p>
              </CardHeader>
              <CardContent className="p-0">
                {mediaMensalEPI.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2 p-3">
                    {mediaMensalEPI.map(e => (
                      <div key={e.id} className="rounded-lg border border-border p-3 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm leading-tight">{e.nome}</span>
                          {e.mesesEstoque !== null && (
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                              e.mesesEstoque <= 1 ? "bg-destructive/10 text-destructive" :
                              e.mesesEstoque <= 3 ? "bg-warning/10 text-warning" :
                              "bg-green-500/10 text-green-600"
                            }`}>
                              {e.mesesEstoque}m
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Média: <strong className="text-foreground">{e.media}/mês</strong></span>
                          <span>Estoque: <strong className="text-foreground">{e.estoqueAtual}</strong></span>
                          <span>Total: <strong className="text-foreground">{e.totalEntregue}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alertas">
            <Card className={alertasEstoque.length > 0 ? "border-warning/30" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Alertas de Estoque
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertasEstoque.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta no momento ✅</p>
                ) : alertasEstoque.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-sm p-2.5 rounded-lg bg-warning/5">
                    <span><span className="font-medium">{a.nome}</span> — estoque baixo</span>
                    <span className="text-warning font-mono text-xs font-bold">{a.estoque} un.</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entregas">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Últimas Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                {recentEntregas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2">
                    {recentEntregas.map(e => (
                      <div key={e.id} className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{e.funcionarioNome}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{e.data}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{e.epiNome} ({e.quantidade}x)</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {/* Desktop: original layout */}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10">EPI</TableHead>
                        {mesesOrdenados.map(m => (
                          <TableHead key={m} className="text-center whitespace-nowrap">
                            {m.split("-").reverse().join("/")}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Média/Mês</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Duração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mediaMensalEPI.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium sticky left-0 bg-card z-10 max-w-[180px] truncate">{e.nome}</TableCell>
                          {mesesOrdenados.map(m => (
                            <TableCell key={m} className="text-center font-mono text-sm">
                              {e.porMes[m] || <span className="text-muted-foreground">0</span>}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono text-sm font-semibold">{e.media}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{e.estoqueAtual}</TableCell>
                          <TableCell className="text-right">
                            {e.mesesEstoque !== null ? (
                              <span className={`font-mono text-sm font-semibold ${e.mesesEstoque <= 1 ? "text-destructive" : e.mesesEstoque <= 3 ? "text-warning" : "text-green-600"}`}>
                                {e.mesesEstoque}m
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
        </>
      )}
    </div>
  );
}
