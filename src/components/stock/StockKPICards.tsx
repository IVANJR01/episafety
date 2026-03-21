import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign, TrendingDown, TrendingUp, AlertTriangle, Users, Clock, BarChart3 } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  subtitle?: string;
}

function KPICard({ label, value, icon, color = "text-primary", subtitle }: KPICardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-primary/10 ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="font-bold text-lg leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface MatrizKPIProps {
  estoqueTotal: number;
  valorTotal: number;
  totalEntradas: number;
  totalSaidas: number;
  valorSaidas: number;
  itensBaixoEstoque: number;
  giroEstoque: number;
}

export function MatrizKPICards({ estoqueTotal, valorTotal, totalEntradas, totalSaidas, valorSaidas, itensBaixoEstoque, giroEstoque }: MatrizKPIProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        label="Estoque Matriz"
        value={`${estoqueTotal.toLocaleString("pt-BR")} un.`}
        icon={<Package className="w-5 h-5" />}
        subtitle={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      />
      <KPICard
        label="Total de Entradas"
        value={`${totalEntradas.toLocaleString("pt-BR")} un.`}
        icon={<TrendingUp className="w-5 h-5" />}
        color="text-emerald-600"
      />
      <KPICard
        label="Total de Saídas"
        value={`${totalSaidas.toLocaleString("pt-BR")} un.`}
        icon={<TrendingDown className="w-5 h-5" />}
        color="text-red-600"
        subtitle={`R$ ${valorSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      />
      <KPICard
        label="Giro de Estoque"
        value={giroEstoque > 0 ? `${giroEstoque.toFixed(1)} dias` : "—"}
        icon={<Clock className="w-5 h-5" />}
        color="text-blue-600"
        subtitle="Tempo médio na matriz"
      />
      {itensBaixoEstoque > 0 && (
        <KPICard
          label="Alertas de Estoque"
          value={`${itensBaixoEstoque} itens`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-amber-600"
          subtitle="Abaixo do mínimo"
        />
      )}
    </div>
  );
}

interface UnidadeKPIProps {
  recebidoMatriz: number;
  valorRecebido: number;
  entregueContratos: number;
  valorEntregue: number;
  estoqueAtual: number;
  itensBaixoEstoque: number;
}

export function UnidadeKPICards({ recebidoMatriz, valorRecebido, entregueContratos, valorEntregue, estoqueAtual, itensBaixoEstoque }: UnidadeKPIProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        label="Recebido da Matriz"
        value={`${recebidoMatriz.toLocaleString("pt-BR")} un.`}
        icon={<TrendingUp className="w-5 h-5" />}
        color="text-emerald-600"
        subtitle={`R$ ${valorRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      />
      <KPICard
        label="Entregue aos Contratos"
        value={`${entregueContratos.toLocaleString("pt-BR")} un.`}
        icon={<TrendingDown className="w-5 h-5" />}
        color="text-blue-600"
        subtitle={`R$ ${valorEntregue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
      />
      <KPICard
        label="Estoque Atual"
        value={`${estoqueAtual.toLocaleString("pt-BR")} un.`}
        icon={<Package className="w-5 h-5" />}
      />
      {itensBaixoEstoque > 0 && (
        <KPICard
          label="Estoque de Segurança"
          value={`${itensBaixoEstoque} alertas`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="text-amber-600"
          subtitle="Solicitar material à Matriz"
        />
      )}
    </div>
  );
}

interface ContratoKPIProps {
  consumoTotal: number;
  valorConsumido: number;
  custoColaborador: number;
  totalColaboradores: number;
  topMateriais: { nome: string; qtd: number }[];
}

export function ContratoKPICards({ consumoTotal, valorConsumido, custoColaborador, totalColaboradores, topMateriais }: ContratoKPIProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Consumo Total"
          value={`${consumoTotal.toLocaleString("pt-BR")} un.`}
          icon={<BarChart3 className="w-5 h-5" />}
          color="text-blue-600"
          subtitle={`R$ ${valorConsumido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <KPICard
          label="Custo por Colaborador"
          value={`R$ ${custoColaborador.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<Users className="w-5 h-5" />}
          color="text-primary"
          subtitle={`${totalColaboradores} colaboradores`}
        />
      </div>
      {topMateriais.length > 0 && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Top 5 Materiais mais consumidos</p>
            <div className="space-y-1.5">
              {topMateriais.slice(0, 5).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    <span className="truncate max-w-[200px]">{m.nome}</span>
                  </span>
                  <span className="font-semibold">{m.qtd} un.</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
