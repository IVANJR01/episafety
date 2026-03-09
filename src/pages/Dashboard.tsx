import { Package, Users, ClipboardList, AlertTriangle, Search } from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EPI { id: string; nome: string; estoque: number; estoque_minimo: number; }
interface Funcionario { id: string; nome: string; }
interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; }
interface Inspecao { id: string; titulo: string; local: string | null; data: string; status: string; }

export default function Dashboard() {
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: entregas } = useSupabaseQuery<Entrega>("entregas", "created_at");
  const { data: inspecoes } = useSupabaseQuery<Inspecao>("inspecoes");

  const alertasEstoque = epis.filter(e => e.estoque <= e.estoque_minimo);

  const stats = [
    { label: "EPIs Cadastrados", value: epis.length, icon: Package, color: "text-primary" },
    { label: "Funcionários", value: funcionarios.length, icon: Users, color: "text-success" },
    { label: "Entregas", value: entregas.length, icon: ClipboardList, color: "text-muted-foreground" },
    { label: "Inspeções", value: inspecoes.length, icon: Search, color: "text-primary" },
    { label: "Alertas", value: alertasEstoque.length, icon: AlertTriangle, color: "text-warning" },
  ];

  const recentEntregas = entregas.slice(0, 5).map(e => ({
    ...e,
    funcionarioNome: funcionarios.find(f => f.id === e.funcionario_id)?.nome || "—",
    epiNome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
  }));

  const inspecoesPendentes = inspecoes.filter(i => i.status !== "concluida").slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da Segurança do Trabalho</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inspeções Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {inspecoesPendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma inspeção pendente</p>
            ) : (
              <div className="space-y-2">
                {inspecoesPendentes.map(i => (
                  <div key={i.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/50">
                    <div>
                      <span className="font-medium">{i.titulo}</span>
                      <span className="text-muted-foreground"> — {i.local || "—"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{i.data}</span>
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
