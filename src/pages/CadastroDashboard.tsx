import { useMemo } from "react";
import { Users, Building, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";

interface Funcionario {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
}

export default function CadastroDashboard() {
  const { data: funcionarios, loading } = useSupabaseQuery<Funcionario>("funcionarios", "nome", true);

  const stats = useMemo(() => {
    const setores = new Set(funcionarios.map(f => f.setor).filter(Boolean));
    const cargos = new Set(funcionarios.map(f => f.cargo).filter(Boolean));
    return {
      totalFuncionarios: funcionarios.length,
      totalSetores: setores.size,
      totalCargos: cargos.size,
      setoresList: Array.from(setores).sort() as string[],
      cargosList: Array.from(cargos).sort() as string[],
    };
  }, [funcionarios]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Funcionários", value: stats.totalFuncionarios, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Setores", value: stats.totalSetores, icon: Building, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Funções / Cargos", value: stats.totalCargos, icon: Briefcase, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Cadastro</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`p-3 rounded-xl ${c.bg}`}>
                <c.icon className={`w-6 h-6 ${c.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Setores */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" /> Setores ({stats.totalSetores})
            </h2>
            {stats.setoresList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.setoresList.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cargos */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-600" /> Funções / Cargos ({stats.totalCargos})
            </h2>
            {stats.cargosList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.cargosList.map(c => (
                  <span key={c} className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
