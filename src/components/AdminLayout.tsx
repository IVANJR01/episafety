import { useState } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Shield,
  Receipt,
  HardDrive,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  Crown,
  Database,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import EmpresaQuerySync from "@/components/EmpresaQuerySync";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  description?: string;
}

const adminNav: NavItem[] = [
  { path: "/admin", label: "Visão Geral", icon: LayoutDashboard, description: "Resumo do ambiente" },
  { path: "/admin/empresas", label: "Empresas (Matriz)", icon: Building2, description: "Gerenciar matrizes e filiais" },
  { path: "/admin/usuarios", label: "Usuários Liberados", icon: Shield, description: "Whitelist e permissões" },
  { path: "/admin/faturas", label: "Faturamento", icon: Receipt, description: "Cobrança e situação" },
  { path: "/admin/backups", label: "Backups", icon: HardDrive, description: "JSON / SQL semanal" },
  { path: "/admin/cloud", label: "Infraestrutura", icon: Database, description: "Banco, edge functions, storage" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isSuperAdmin, loading, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 flex flex-col border-r border-sidebar-border ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-destructive/15 flex items-center justify-center">
              <Crown className="w-5 h-5 text-destructive" />
            </div>
            <div className="leading-tight">
              <h1 className="font-bold text-base tracking-tight text-sidebar-primary-foreground">Painel Admin</h1>
              <p className="text-[10px] text-sidebar-foreground/50 font-medium uppercase tracking-wider">Super Admin</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {adminNav.map((item) => {
            const active =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-[11px] text-sidebar-foreground/45 truncate font-normal">
                      {item.description}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Voltar ao app</span>
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sair</span>
          </button>
          <div className="px-3 pt-2 text-[10px] text-sidebar-foreground/40 truncate">{user?.email}</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-destructive" />
            <span className="font-semibold text-sm">Painel Admin</span>
          </div>
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <EmpresaQuerySync />
          {children}
        </main>
      </div>
    </div>
  );
}
