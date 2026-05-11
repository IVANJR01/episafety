import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Shield, Receipt, HardDrive, Users, Database, ArrowRight, Crown, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface Matriz { id: string; nome: string }

interface Stats {
  matrizes: number;
  filiais: number;
  usuarios: number;
  funcionarios: number;
  faturasAbertas: number;
  loading: boolean;
}

const ALL = "__all__";

export default function AdminDashboard() {
  const { user, empresaId, isSuperAdmin, setActiveEmpresaId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  // Sincroniza com a empresa ativa global (active_empresa_id)
  const [selected, setSelected] = useState<string>(empresaId || ALL);

  // Quando o seletor mudar, propaga para o contexto global do app
  function handleChange(value: string) {
    setSelected(value);
    if (value === ALL) {
      try { localStorage.removeItem("active_empresa_id"); } catch {}
    } else if (isSuperAdmin) {
      setActiveEmpresaId(value);
    }
    // Invalida caches do TanStack Query para forçar reload com novo escopo
    queryClient.invalidateQueries();
  }

  // Mantém em sincronia caso o empresaId global mude por outro lugar
  useEffect(() => {
    if (empresaId && empresaId !== selected) setSelected(empresaId);
  }, [empresaId]);

  const [stats, setStats] = useState<Stats>({
    matrizes: 0, filiais: 0, usuarios: 0, funcionarios: 0, faturasAbertas: 0, loading: true,
  });

  // Load matrizes once for selector
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id,nome")
        .is("empresa_pai_id", null)
        .order("nome");
      setMatrizes((data as Matriz[]) || []);
    })();
  }, []);

  // Reload stats whenever selection changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStats((s) => ({ ...s, loading: true }));
      try {
        // Resolve empresa scope: matriz + suas filiais
        let scopeIds: string[] | null = null;
        if (selected !== ALL) {
          const { data: filiais } = await (supabase.from as any)("empresa_config")
            .select("id")
            .eq("empresa_pai_id", selected);
          scopeIds = [selected, ...((filiais || []).map((f: any) => f.id))];
        }

        const applyScope = (q: any) => (scopeIds ? q.in("empresa_id", scopeIds) : q);

        const matrizesQ = selected === ALL
          ? supabase.from("empresa_config" as any).select("id", { count: "exact", head: true }).is("empresa_pai_id", null)
          : Promise.resolve({ count: 1 });

        const filiaisQ = selected === ALL
          ? supabase.from("empresa_config" as any).select("id", { count: "exact", head: true }).not("empresa_pai_id", "is", null)
          : supabase.from("empresa_config" as any).select("id", { count: "exact", head: true }).eq("empresa_pai_id", selected);

        const usuariosQ = applyScope(supabase.from("usuarios_liberados" as any).select("id", { count: "exact", head: true }));
        const funcionariosQ = applyScope(supabase.from("funcionarios" as any).select("id", { count: "exact", head: true }));
        const faturasQ = applyScope(
          supabase.from("faturas" as any).select("id", { count: "exact", head: true }).in("situacao", ["aberto", "vencido"])
        );

        const [m, f, u, fu, fa] = await Promise.all([matrizesQ, filiaisQ, usuariosQ, funcionariosQ, faturasQ]);
        if (cancelled) return;
        setStats({
          matrizes: (m as any).count || 0,
          filiais: (f as any).count || 0,
          usuarios: (u as any).count || 0,
          funcionarios: (fu as any).count || 0,
          faturasAbertas: (fa as any).count || 0,
          loading: false,
        });
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selected]);

  const cards = useMemo(() => ([
    { label: "Matrizes", value: stats.matrizes, icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: selected === ALL ? "Filiais / Unidades" : "Filiais desta matriz", value: stats.filiais, icon: GitBranchIcon, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Usuários liberados", value: stats.usuarios, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Funcionários", value: stats.funcionarios, icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Faturas em aberto", value: stats.faturasAbertas, icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
  ]), [stats, selected]);

  const shortcuts = [
    { to: "/admin/empresas", icon: Building2, title: "Empresas / Matrizes", desc: "Criar matriz, filial e usuário responsável." },
    { to: "/admin/usuarios", icon: Shield, title: "Usuários Liberados", desc: "Whitelist por e-mail, módulos e permissões." },
    { to: "/admin/faturas", icon: Receipt, title: "Faturamento", desc: "Cobranças, situação e bloqueio por inadimplência." },
    { to: "/admin/backups", icon: HardDrive, title: "Backups", desc: "Geração e download dos snapshots semanais." },
    { to: "/admin/cloud", icon: Database, title: "Infraestrutura (Cloud)", desc: "Banco, edge functions, storage, cron." },
  ];

  const selectedNome = selected === ALL ? "Todas as empresas" : (matrizes.find((m) => m.id === selected)?.nome || "—");

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

      {/* Empresa selector — isola dados por matriz e propaga para o app inteiro */}
      <Card className="border-2 border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span>
              Ao selecionar uma empresa, <strong>todo o aplicativo</strong> (Dashboard, EPIs, Funcionários, Entregas, etc.) passa a mostrar somente os dados dessa empresa. Use "Todas" apenas para consolidação administrativa.
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="w-4 h-4 text-primary" />
              Empresa em foco:
            </div>
            <Select value={selected} onValueChange={handleChange}>
              <SelectTrigger className="sm:w-[360px]">
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as empresas (consolidado)</SelectItem>
                {matrizes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="sm:ml-auto">
              {selectedNome}
            </Badge>
            {selected !== ALL && (
              <Button size="sm" onClick={() => navigate(`/?empresa_id=${selected}`)}>
                Abrir app desta empresa
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


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
