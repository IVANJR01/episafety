import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HardHat, LayoutDashboard, Package, Users, ClipboardList, BarChart3, Menu, Search, FileText, GraduationCap, Stethoscope, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/epis", label: "Controle de EPI", icon: Package },
  { path: "/entregas", label: "Entregas", icon: ClipboardList },
  { path: "/funcionarios", label: "Funcionários", icon: Users },
  { path: "/inspecoes", label: "Inspeções", icon: Search },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="p-2 rounded-lg bg-primary">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-sidebar-primary-foreground">EPI Control</h1>
            <p className="text-xs text-sidebar-foreground/60">Segurança do Trabalho</p>
          </div>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <p className="text-xs text-sidebar-foreground/40 text-center truncate">{user?.email}</p>
          <button onClick={signOut} className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex items-center gap-4 px-6 py-4 bg-background/80 backdrop-blur-sm border-b border-border lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">EPI Control</span>
        </header>
        <div className="p-6 lg:p-8 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
