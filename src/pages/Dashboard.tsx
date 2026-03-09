import { Package, Users, ClipboardList, AlertTriangle, Search, GraduationCap, FileText, Stethoscope } from "lucide-react";
import { epiStorage, funcionarioStorage, entregaStorage, inspecaoStorage, treinamentoStorage, ordemServicoStorage, exameStorage } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const epis = epiStorage.getAll();
  const funcionarios = funcionarioStorage.getAll();
  const entregas = entregaStorage.getAll();
  const inspecoes = inspecaoStorage.getAll();
  const treinamentos = treinamentoStorage.getAll();
  const ordensServico = ordemServicoStorage.getAll();
  const exames = exameStorage.getAll();

  const alertasEstoque = epis.filter(e => e.estoque <= e.estoqueMinimo);

  // Exames vencendo em 30 dias
  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
  const examesVencendo = exames.filter(e => {
    if (!e.dataVencimento) return false;
    const venc = new Date(e.dataVencimento);
    return venc <= em30dias && venc >= hoje;
  });

  const stats = [
    { label: "EPIs Cadastrados", value: epis.length, icon: Package, color: "text-primary" },
    { label: "Funcionários", value: funcionarios.length, icon: Users, color: "text-success" },
    { label: "Entregas", value: entregas.length, icon: ClipboardList, color: "text-muted-foreground" },
    { label: "Inspeções", value: inspecoes.length, icon: Search, color: "text-primary" },
    { label: "Treinamentos", value: treinamentos.length, icon: GraduationCap, color: "text-success" },
    { label: "Ordens de Serviço", value: ordensServico.length, icon: FileText, color: "text-muted-foreground" },
    { label: "Exames (PCMSO)", value: exames.length, icon: Stethoscope, color: "text-primary" },
    { label: "Alertas", value: alertasEstoque.length + examesVencendo.length, icon: AlertTriangle, color: "text-warning" },
  ];

  const recentEntregas = entregas.slice(-5).reverse().map(e => ({
    ...e,
    funcionarioNome: funcionarios.find(f => f.id === e.funcionarioId)?.nome || "—",
    epiNome: epis.find(ep => ep.id === e.epiId)?.nome || "—",
  }));

  const inspecoesPendentes = inspecoes.filter(i => i.status !== "concluida").slice(0, 5);

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alertas */}
        {(alertasEstoque.length > 0 || examesVencendo.length > 0) && (
          <Card className="border-warning/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertasEstoque.map(a => (
                <div key={a.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-warning/5">
                  <span><span className="font-medium">{a.nome}</span> — estoque baixo</span>
                  <span className="text-warning font-mono text-xs">{a.estoque} un.</span>
                </div>
              ))}
              {examesVencendo.map(e => (
                <div key={e.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-warning/5">
                  <span><span className="font-medium">{funcionarios.find(f => f.id === e.funcionarioId)?.nome}</span> — exame vencendo</span>
                  <span className="text-warning font-mono text-xs">{e.dataVencimento}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Últimas Entregas */}
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

        {/* Inspeções Pendentes */}
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
                      <span className="text-muted-foreground"> — {i.local}</span>
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
