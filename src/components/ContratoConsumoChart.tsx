import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, BarChart3 } from "lucide-react";

interface Props {
  filialId: string;
  contratoId: string;
  contratoNome: string;
}

interface MonthData {
  mes: string;
  entregas: number;
  quantidade: number;
  custo: number;
}

export default function ContratoConsumoChart({ filialId, contratoId, contratoNome }: Props) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Get entregas from last 12 months for employees in this contract
      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - 11);
      dataInicio.setDate(1);
      const inicioStr = dataInicio.toISOString().split("T")[0];

      const { data: entregas } = await supabase
        .from("entregas")
        .select("data, quantidade, epi_id, funcionario_id")
        .eq("empresa_id", filialId)
        .in("tipo", ["entrega", "substituicao"])
        .gte("data", inicioStr);

      // Get funcionarios in this contract
      const { data: funcs } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("empresa_id", filialId)
        .eq("contrato_id", contratoId);

      const funcIds = new Set((funcs || []).map(f => f.id));

      // Get EPI values for cost calc
      const epiIds = [...new Set((entregas || []).map(e => e.epi_id))];
      const { data: epis } = await supabase
        .from("epis")
        .select("id, valor")
        .in("id", epiIds.length > 0 ? epiIds : ["00000000-0000-0000-0000-000000000000"]);

      const epiValorMap: Record<string, number> = {};
      (epis || []).forEach(e => { epiValorMap[e.id] = Number(e.valor) || 0; });

      // Filter entregas by contract employees and aggregate by month
      const monthMap: Record<string, { entregas: number; quantidade: number; custo: number }> = {};

      // Initialize all 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - 11 + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { entregas: 0, quantidade: 0, custo: 0 };
      }

      (entregas || []).forEach(ent => {
        if (!funcIds.has(ent.funcionario_id)) return;
        const month = ent.data.substring(0, 7); // YYYY-MM
        if (!monthMap[month]) return;
        monthMap[month].entregas += 1;
        monthMap[month].quantidade += ent.quantidade;
        monthMap[month].custo += ent.quantidade * (epiValorMap[ent.epi_id] || 0);
      });

      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const chartData = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => ({
          mes: months[parseInt(key.split("-")[1]) - 1] + "/" + key.split("-")[0].substring(2),
          entregas: val.entregas,
          quantidade: val.quantidade,
          custo: Math.round(val.custo * 100) / 100,
        }));

      setData(chartData);
      setLoading(false);
    })();
  }, [filialId, contratoId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando gráfico...
      </div>
    );
  }

  const hasData = data.some(d => d.quantidade > 0);
  if (!hasData) {
    return (
      <div className="text-xs text-muted-foreground p-3 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Sem dados de consumo nos últimos 12 meses para este contrato.
      </div>
    );
  }

  return (
    <div className="border-b px-3 py-3 space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        Consumo Mensal — {contratoNome} (últimos 12 meses)
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Quantity chart */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 text-center">Quantidade entregue</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value: number) => [`${value} un.`, "Quantidade"]}
              />
              <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Cost chart */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 text-center">Custo (R$)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Custo"]}
              />
              <Bar dataKey="custo" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
