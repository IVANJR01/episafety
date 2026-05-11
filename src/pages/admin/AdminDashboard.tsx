import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Shield, Receipt, HardDrive, Users, Database, ArrowRight, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Stats {
  matrizes: number;
  filiais: number;
  usuarios: number;
  funcionarios: number;
  faturasAbertas: number;
  loading: boolean;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    matrizes: 0, filiais: 0, usuarios: 0, funcionarios: 0, faturasAbertas: 0, loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const [matrizes, filiais, usuarios, funcionarios, faturas] = await Promise.all([
          supabase.from("empresa_config" as any).select("id", { count: "exact", head: true }).is("empresa_pai_id", null),
          supabase.from("empresa_config" as any).select("id", { count: "exact", head: true }).not("empresa_pai_id", "is", null),
          supabase.from("usuarios_liberados" as any).select("id", { count: "exact", head: true }),
          supabase.from("funcionarios" as any).select("id", { count: "exact", head: true }),
          supabase.from("faturas" as any).select("id", { count: "exact", head: true }).in("situacao", ["aberto", "vencido"]),
        ]);
        setStats({
          matrizes: matrizes.count || 0,
          filiais: filiais.count || 0,
          usuarios: usuarios.count || 0,
          funcionarios: funcionarios.count || 0,
          faturasAbertas: faturas.count || 0,
          loading: false,
        });
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    }
    load();
  }, []);

  const cards = [
    { label: "Matrizes", value: stats.matrizes, icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Filiais / Unidades", value: stats.filiais, icon: GitBranchIcon, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Usuários liberados", value: stats.usuarios, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Funcionários", value: stats.funcionarios, icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Faturas em aberto", value: stats.faturasAbertas, icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  const shortcuts = [
    { to: "/admin/empresas", icon: Building2, title: "Empresas / Matrizes", desc: "Criar matriz, filial e usuário responsável." },
    { to: "/admin/usuarios", icon: Shield, title: "Usuários Liberados", desc: "Whitelist por e-mail, módulos e permissões." },
    { to: "/admin/faturas", icon: Receipt, title: "Faturamento", desc: "Cobranças, situação e bloqueio por inadimplência." },
    { to: "/admin/backups", icon: HardDrive, title: "Backups", desc: "Geração e download dos snapshots semanais." },
    { to: "/admin/cloud", icon: Database, title: "Infraestrutura (Cloud)", desc: "Banco, edge functions, storage, cron." },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            <Crown className="w-3.5 h-3.5 text-destructive" />
            Painel Administrativo
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Visão Geral</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bem-vindo, <strong>{user?.email}</strong>. Esta área é exclusiva para Super Admin.
          </p>
        </div>
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Ambiente Administrativo
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <c.icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold">{stats.loading ? "—" : c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Atalhos administrativos
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="hover:border-primary/40 transition-colors h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      {s.title}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inline icon to avoid extra import noise
function GitBranchIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
