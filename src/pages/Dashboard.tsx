import { Package, Users, ClipboardList, AlertTriangle, DollarSign, TrendingUp, FileBarChart, ShieldCheck, ArrowUpRight, ArrowDownRight, Boxes } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, AreaChart, Area } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

const MotionCard = motion.create(Card);

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface EPI { id: string; nome: string; estoque: number; estoque_minimo: number; valor: number | null; }
interface Funcionario { id: string; nome: string; }
interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; created_at: string; tipo: string; }
interface ContratoMovimentacao {
  id: string;
  contrato_id: string;
  epi_id: string;
  tipo: string;
  quantidade: number;
  created_at: string;
}
interface Contrato { id: string; nome: string; }

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: entregas } = useSupabaseQuery<Entrega>("entregas", "created_at");

  const [movimentacoes, setMovimentacoes] = useState<ContratoMovimentacao[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);

  useEffect(() => {
    async function fetchContractData() {
      const [movRes, contRes] = await Promise.all([
        (supabase.from as any)("contrato_epis_movimentacoes")
          .select("id, contrato_id, epi_id, tipo, quantidade, created_at")
          .eq("tipo", "saida")
          .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: true }),
        (supabase.from as any)("contratos").select("id, nome"),
      ]);
      if (movRes.data) setMovimentacoes(movRes.data);
      if (contRes.data) setContratos(contRes.data);
    }
    fetchContractData();
  }, []);

  const alertasEstoque = epis.filter(e => e.estoque <= e.estoque_minimo);

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
    "hsl(24, 95%, 53%)",
    "hsl(199, 89%, 48%)",
    "hsl(142, 71%, 45%)",
    "hsl(262, 83%, 58%)",
    "hsl(346, 77%, 50%)",
    "hsl(47, 95%, 53%)",
    "hsl(173, 80%, 40%)",
    "hsl(25, 95%, 53%)",
  ];

  const { contratoChartData, contratoNomes } = useMemo(() => {
    if (movimentacoes.length === 0 || contratos.length === 0) {
      return { contratoChartData: [], contratoNomes: [] as string[] };
    }

    const contratoMap = new Map(contratos.map(c => [c.id, c.nome]));
    const mesesSet = new Set<string>();
    const porMesContrato: Record<string, Record<string, number>> = {};

    movimentacoes.forEach(m => {
      const mes = m.created_at?.substring(0, 7);
      if (!mes) return;
      mesesSet.add(mes);
      const nomeContrato = contratoMap.get(m.contrato_id) || "Sem contrato";
      if (!porMesContrato[mes]) porMesContrato[mes] = {};
      porMesContrato[mes][nomeContrato] = (porMesContrato[mes][nomeContrato] || 0) + m.quantidade;
    });

    const meses = Array.from(mesesSet).sort().slice(-12);
    const allContratos = Array.from(new Set(
      movimentacoes.map(m => contratoMap.get(m.contrato_id) || "Sem contrato")
    )).sort();

    const chartData = meses.map(mes => {
      const row: Record<string, any> = { mes: mes.split("-").reverse().join("/") };
      allContratos.forEach(c => {
        row[c] = porMesContrato[mes]?.[c] || 0;
      });
      return row;
    });

    return { contratoChartData: chartData, contratoNomes: allContratos };
  }, [movimentacoes, contratos]);

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

  const recentEntregas = entregas.slice(0, 20).map(e => ({
    ...e,
    funcionarioNome: funcionarios.find(f => f.id === e.funcionario_id)?.nome || "—",
    epiNome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
  }));

  // Compliance score (items in stock / total items)
  const complianceScore = epis.length > 0
    ? Math.round((epis.filter(e => e.estoque > e.estoque_minimo).length / epis.length) * 100)
    : 100;

  const heroStats = [
    {
      label: "EPIs Cadastrados",
      value: epis.length,
      icon: Package,
      gradient: "from-[hsl(24,95%,53%)] to-[hsl(24,95%,40%)]",
      iconBg: "bg-white/20",
      textColor: "text-white",
    },
    {
      label: "Funcionários Ativos",
      value: funcionarios.length,
      icon: Users,
      gradient: "from-[hsl(199,89%,48%)] to-[hsl(199,89%,35%)]",
      iconBg: "bg-white/20",
      textColor: "text-white",
    },
    {
      label: "Entregas Realizadas",
      value: entregas.length,
      icon: ClipboardList,
      gradient: "from-[hsl(142,71%,45%)] to-[hsl(142,71%,32%)]",
      iconBg: "bg-white/20",
      textColor: "text-white",
    },
    {
      label: "Alertas de Estoque",
      value: alertasEstoque.length,
      icon: AlertTriangle,
      gradient: alertasEstoque.length > 0
        ? "from-[hsl(0,72%,51%)] to-[hsl(0,72%,38%)]"
        : "from-[hsl(142,71%,45%)] to-[hsl(142,71%,32%)]",
      iconBg: "bg-white/20",
      textColor: "text-white",
    },
  ];

  return (
    <motion.div
      className="space-y-6 sm:space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={fadeUp} custom={0} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <motion.div
              className="w-1.5 h-8 rounded-full bg-primary"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestão de EPIs
            </h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Painel de controle de segurança do trabalho
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3.5 sm:ml-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            complianceScore >= 80 ? "bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,32%)]" :
            complianceScore >= 50 ? "bg-warning/10 text-warning" :
            "bg-destructive/10 text-destructive"
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Conformidade: {complianceScore}%
          </div>
        </div>
      </motion.div>

      {/* Hero Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {heroStats.map((s, i) => (
          <MotionCard
            key={s.label}
            variants={fadeUp}
            custom={i + 1}
            className={`bg-gradient-to-br ${s.gradient} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group overflow-hidden relative`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            <CardContent className="relative flex items-center gap-3 p-4 sm:p-5">
              <div className={`${s.iconBg} p-2.5 sm:p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300`}>
                <s.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-sm">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-white/80 leading-tight font-medium">{s.label}</p>
              </div>
            </CardContent>
          </MotionCard>
        ))}
      </div>

      {/* Financial Overview — Two big cards */}
      <motion.div variants={fadeUp} custom={5} className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-md border-border/50 hover:shadow-lg transition-shadow">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Boxes className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Valor em Estoque</p>
                  <p className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight">
                    R$ {valorEstoqueAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[hsl(142,71%,45%)] bg-[hsl(142,71%,45%)]/10 px-2 py-1 rounded-full text-xs font-semibold">
                <ArrowUpRight className="w-3 h-3" />
                Ativo
              </div>
            </div>
            <Progress value={Math.min(100, (epis.filter(e => e.estoque > 0).length / Math.max(epis.length, 1)) * 100)} className="h-2" />
            <p className="text-[10px] text-muted-foreground mt-1.5">{epis.filter(e => e.estoque > 0).length} de {epis.length} EPIs com estoque</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50 hover:shadow-lg transition-shadow">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <DollarSign className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total de Saídas</p>
                  <p className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight">
                    R$ {valorSaida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-1 rounded-full text-xs font-semibold">
                <ArrowDownRight className="w-3 h-3" />
                Saída
              </div>
            </div>
            <Progress value={valorEstoqueAtual > 0 ? Math.min(100, (valorSaida / valorEstoqueAtual) * 100) : 0} className="h-2 [&>div]:bg-destructive" />
            <p className="text-[10px] text-muted-foreground mt-1.5">{entregas.length} entregas realizadas no período</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cost Evolution Chart — Area chart */}
      <motion.div variants={fadeUp} custom={6}>
      <Card className="shadow-md border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Evolução de Custos</CardTitle>
                <p className="text-xs text-muted-foreground">Saída mensal vs Valor em estoque</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Saída:</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">R$ {valorSaida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[hsl(142,71%,45%)]/5 border border-[hsl(142,71%,45%)]/20 px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(142,71%,45%)]" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Estoque:</span>
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">R$ {valorEstoqueAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {custoMensalData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado de custo disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={custoMensalData}>
                <defs>
                  <linearGradient id="gradSaida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradEstoque" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fill: 'hsl(220, 10%, 45%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(220, 10%, 45%)', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                    name === "saida" ? "Saída Mensal" : "Estoque Atual"
                  ]}
                  contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 15%, 88%)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Legend formatter={(value: string) => value === "saida" ? "Saída Mensal" : "Estoque Atual"} wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="saida" stroke="hsl(24, 95%, 53%)" strokeWidth={2.5} fill="url(#gradSaida)" />
                <Area type="monotone" dataKey="estoque" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} fill="url(#gradEstoque)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Contract consumption chart */}
      {contratoChartData.length > 0 && (
        <motion.div variants={fadeUp} custom={7}>
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[hsl(262,83%,58%)]/10">
                  <FileBarChart className="w-4 h-4 text-[hsl(262,83%,58%)]" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Consumo por Contrato</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Quantidade de EPIs consumidos por contrato — últimos 12 meses
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={contratoChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fill: 'hsl(220, 10%, 45%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(220, 10%, 45%)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 15%, 88%)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [`${value} un.`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {contratoNomes.map((nome, i) => (
                    <Bar
                      key={nome}
                      dataKey={nome}
                      stackId="contratos"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={i === contratoNomes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stock value chart */}
      <motion.div variants={fadeUp} custom={8}>
      <Card className="shadow-md border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Valor do Estoque por EPI</CardTitle>
              <p className="text-xs text-muted-foreground">
                Total: <span className="font-bold font-mono text-foreground">R$ {valorEstoqueAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {estoqueChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum EPI com valor em estoque</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(250, estoqueChartData.length * 52)}>
              <BarChart data={estoqueChartData} layout="vertical" margin={{ left: isMobile ? 8 : 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'hsl(220, 10%, 45%)', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <YAxis type="category" dataKey="nome" width={isMobile ? 100 : 140} tick={{ fill: 'hsl(220, 25%, 10%)', fontSize: isMobile ? 11 : 12 }} />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Valor"]}
                  contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 15%, 88%)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={24}>
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
          <TabsList className="w-full grid grid-cols-3 h-11">
            <TabsTrigger value="consumo" className="text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Consumo
            </TabsTrigger>
            <TabsTrigger value="alertas" className="text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Alertas
              {alertasEstoque.length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 animate-pulse">{alertasEstoque.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="entregas" className="text-xs font-semibold">
              <ClipboardList className="w-3.5 h-3.5 mr-1" /> Entregas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consumo">
            <Card className="shadow-md border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">Média Mensal de Consumo</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Planejamento de compras</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {mediaMensalEPI.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2 p-3">
                    {mediaMensalEPI.map(e => (
                      <div key={e.id} className="rounded-xl border border-border/60 p-3 space-y-2 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm leading-tight">{e.nome}</span>
                          {e.mesesEstoque !== null && (
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                              e.mesesEstoque <= 1 ? "bg-destructive/10 text-destructive animate-pulse" :
                              e.mesesEstoque <= 3 ? "bg-warning/10 text-warning" :
                              "bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,32%)]"
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
            <Card className={`shadow-md border-border/50 ${alertasEstoque.length > 0 ? "border-destructive/30" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${alertasEstoque.length > 0 ? "bg-destructive/10" : "bg-[hsl(142,71%,45%)]/10"}`}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${alertasEstoque.length > 0 ? "text-destructive" : "text-[hsl(142,71%,45%)]"}`} />
                  </div>
                  <CardTitle className="text-sm font-bold">Alertas de Estoque</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertasEstoque.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <ShieldCheck className="w-10 h-10 text-[hsl(142,71%,45%)]" />
                    <p className="text-sm font-medium text-[hsl(142,71%,32%)]">Todos os estoques estão OK!</p>
                  </div>
                ) : alertasEstoque.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                    <span><span className="font-semibold">{a.nome}</span> — estoque crítico</span>
                    <span className="text-destructive font-mono text-xs font-bold bg-destructive/10 px-2 py-0.5 rounded-full">{a.estoque} un.</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entregas">
            <Card className="shadow-md border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[hsl(199,89%,48%)]/10">
                    <ClipboardList className="w-3.5 h-3.5 text-[hsl(199,89%,48%)]" />
                  </div>
                  <CardTitle className="text-sm font-bold">Últimas Entregas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {recentEntregas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {recentEntregas.map(e => (
                      <div key={e.id} className="rounded-xl bg-muted/40 p-3 space-y-0.5 hover:bg-muted/60 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm">{e.funcionarioNome}</span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">{e.data}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{e.epiNome} ({e.quantidade}x)</p>
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
          {/* Desktop: Consumption table */}
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Média Mensal de Consumo por EPI</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Base para planejamento de compras — quanto maior o consumo, mais atenção ao reabastecimento
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {mediaMensalEPI.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma entrega registrada para calcular média</p>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-30 font-bold">EPI</TableHead>
                        {mesesOrdenados.map(m => (
                          <TableHead key={m} className="text-center whitespace-nowrap">
                            {m.split("-").reverse().join("/")}
                          </TableHead>
                        ))}
                        <TableHead className="text-right font-bold">Média/Mês</TableHead>
                        <TableHead className="text-right font-bold">Estoque</TableHead>
                        <TableHead className="text-right font-bold">Duração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mediaMensalEPI.map(e => (
                        <TableRow key={e.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold sticky left-0 bg-card z-10 max-w-[180px] truncate">{e.nome}</TableCell>
                          {mesesOrdenados.map(m => (
                            <TableCell key={m} className="text-center font-mono text-sm">
                              {e.porMes[m] || <span className="text-muted-foreground/40">0</span>}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono text-sm font-bold text-primary">{e.media}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{e.estoqueAtual}</TableCell>
                          <TableCell className="text-right">
                            {e.mesesEstoque !== null ? (
                              <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded-full ${
                                e.mesesEstoque <= 1 ? "bg-destructive/10 text-destructive" :
                                e.mesesEstoque <= 3 ? "bg-warning/10 text-warning" :
                                "bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,32%)]"
                              }`}>
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

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Alerts */}
            <Card className={`shadow-md border-border/50 ${alertasEstoque.length > 0 ? "border-destructive/30" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${alertasEstoque.length > 0 ? "bg-destructive/10" : "bg-[hsl(142,71%,45%)]/10"}`}>
                    <AlertTriangle className={`w-4 h-4 ${alertasEstoque.length > 0 ? "text-destructive" : "text-[hsl(142,71%,45%)]"}`} />
                  </div>
                  <CardTitle className="text-base font-bold">Alertas de Estoque</CardTitle>
                  {alertasEstoque.length > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full px-2 py-0.5 animate-pulse">
                      {alertasEstoque.length}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertasEstoque.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <ShieldCheck className="w-12 h-12 text-[hsl(142,71%,45%)]" />
                    <p className="text-sm font-medium text-[hsl(142,71%,32%)]">Todos os estoques dentro do limite!</p>
                  </div>
                ) : alertasEstoque.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors">
                    <span><span className="font-semibold">{a.nome}</span> — estoque crítico</span>
                    <span className="text-destructive font-mono text-xs font-bold bg-destructive/10 px-2.5 py-0.5 rounded-full">{a.estoque} un.</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent deliveries */}
            <Card className="shadow-md border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[hsl(199,89%,48%)]/10">
                    <ClipboardList className="w-4 h-4 text-[hsl(199,89%,48%)]" />
                  </div>
                  <CardTitle className="text-base font-bold">Últimas Entregas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {recentEntregas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrega registrada</p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {recentEntregas.map(e => (
                      <div key={e.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="min-w-0 flex-1 mr-2">
                          <span className="font-semibold">{e.funcionarioNome}</span>
                          <p className="text-xs text-muted-foreground truncate">{e.epiNome} ({e.quantidade}x)</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{e.data}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
}
