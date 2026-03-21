import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DistributionItem {
  nome: string;
  valor: number;
  percentual: number;
}

const COLORS = [
  "hsl(24, 95%, 53%)",   // primary orange
  "hsl(210, 70%, 50%)",  // blue
  "hsl(142, 72%, 40%)",  // green
  "hsl(0, 72%, 51%)",    // red
  "hsl(270, 60%, 55%)",  // purple
  "hsl(38, 92%, 50%)",   // amber
  "hsl(180, 60%, 40%)",  // teal
];

interface Props {
  data: DistributionItem[];
  title: string;
}

export default function StockDistributionChart({ data, title }: Props) {
  if (data.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                dataKey="valor"
                nameKey="nome"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string, entry: any) => {
                  const item = data.find(d => d.nome === value);
                  return `${value} (${item?.percentual.toFixed(1)}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
