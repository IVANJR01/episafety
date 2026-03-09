import { Package, Users, ClipboardList, AlertTriangle } from "lucide-react";
import { epiStorage, funcionarioStorage, entregaStorage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const epis = epiStorage.getAll();
  const funcionarios = funcionarioStorage.getAll();
  const entregas = entregaStorage.getAll();
  const alertas = epis.filter(e => e.estoque <= e.estoqueMinimo);

  const stats = [
    { label: "EPIs Cadastrados", value: epis.length, icon: Package, color: "text-primary" },
    { label: "Funcionários", value: funcionarios.length, icon: Users, color: "text-success" },
    { label: "Entregas Realizadas", value: entregas.length, icon: ClipboardList, color: "text-muted-foreground" },
    { label: "Alertas de Estoque", value: alertas.length, icon: AlertTriangle, color: "text-warning" },
  ];

  // Last 5 deliveries
  const recentEntregas = entregas.slice(-5).reverse().map(e => ({
    ...e,
    funcionarioNome: funcionarios.find(f => f.id === e.funcionarioId)?.nome || "—",
    epiNome: epis.find(ep => ep.id === e.epiId)?.nome || "—",
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema de EPIs</p>
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

      {alertas.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Alertas de Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertas.map(a => (
                <div key={a.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-warning/5">
                  <span className="font-medium">{a.nome}</span>
                  <span className="text-warning font-mono text-xs">{a.estoque} / {a.estoqueMinimo} mín.</span>
                </div>
              ))}
            </div>
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
  );
}
