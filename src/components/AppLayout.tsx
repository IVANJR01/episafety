import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, ClipboardList, BarChart3, Menu, LogOut, Building2, ChevronDown, FolderOpen, Shield, Crown, X, Settings, MessageSquare, HardHat, Download, GraduationCap, Stethoscope, HardDrive, GitBranch, Video, FileText, Bell, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessModule, MODULOS } from "@/lib/permissions";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  moduleKey: string;
  description?: string;
}

const mainNavItems: NavItem[] = [];

const epiItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { path: "/epis", label: "Cadastro de EPIs", icon: Package, moduleKey: "epis" },
  { path: "/epis/controle-contrato", label: "Estoque por Unidade", icon: Boxes, moduleKey: "estoque_contrato" },
  { path: "/entregas", label: "Entregas", icon: ClipboardList, moduleKey: "entregas" },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3, moduleKey: "relatorios" },
];

const gestaoDocItems: NavItem[] = [
  { path: "/treinamentos", label: "Controle de Documentos", icon: GraduationCap, moduleKey: "treinamentos" },
  { path: "/exames", label: "Controle de Exames", icon: Stethoscope, moduleKey: "exames" },
];

const afterCadastroItems: NavItem[] = [
  { path: "/dds", label: "Lista de Presença", icon: MessageSquare, moduleKey: "dds" },
  { path: "/inspecoes-se", label: "Inspeções", icon: HardHat, moduleKey: "inspecoes_se" },
  { path: "/video-treinamentos", label: "Treinamentos", icon: Video, moduleKey: "video_treinamentos" },
];

const cadastroItems: NavItem[] = [
  { path: "/cadastro", label: "Dashboard", icon: LayoutDashboard, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/empresas", label: "Empresas", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/cadastro/empresas", label: "Empresas / Unidades", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/cadastro/funcionarios", label: "Funcionários", icon: Users, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/usuarios", label: "Usuários Liberados", icon: Shield, moduleKey: "cadastro_usuarios" },
];

// Bottom nav shows max 5 items: main nav items + "Mais" for cadastro
const BOTTOM_NAV_MAX = 5;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user, modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [faturasAlerta, setFaturasAlerta] = useState(0);

  // Busca contagem de faturas pendentes/vencidas para o badge no sidebar
  useEffect(() => {
    if (!isSuperAdmin && !isPrincipal) return;
    async function checkFaturas() {
      const { data } = await (supabase.from as any)("faturas")
        .select("id, situacao, data_vencimento")
        .in("situacao", ["aberto", "vencido"]);
      if (data) {
        setFaturasAlerta(data.length);
      }
    }
    checkFaturas();
  }, [isSuperAdmin, isPrincipal]);

  const canAccess = (moduleKey: string) => isSuperAdmin || canAccessModule(modulosPermitidos, moduleKey);

  const visibleMainItems = mainNavItems.filter((i) => canAccess(i.moduleKey));
  const visibleEpiItems = epiItems.filter((i) => canAccess(i.moduleKey));
  const visibleCadastroItems = cadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleAfterCadastroItems = afterCadastroItems.filter((i) => canAccess(i.moduleKey));

  const isEpiActive = visibleEpiItems.some((i) => location.pathname === i.path);
  const isCadastroActive = visibleCadastroItems.some((i) => location.pathname === i.path);
  const [epiOpen, setEpiOpen] = useState(true);
  const [cadastroOpen, setCadastroOpen] = useState(isCadastroActive);

  // Bottom nav items: first 4 main items + "Mais" button
  const bottomNavItems = visibleMainItems.slice(0, 4);
  const hasMore = visibleCadastroItems.length > 0 || isSuperAdmin || isPrincipal;

  useEffect(() => {
    // Captura o evento beforeinstallprompt para usar no botão de instalação
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Verifica se já está instalado
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      const promptEvent = installPrompt as any;
      promptEvent.prompt();
      promptEvent.userChoice.then((result: any) => {
        if (result.outcome === "accepted") {
          setShowInstallButton(false);
        }
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img alt="EPISafety" className="w-10 h-10 object-contain" src="/lovable-uploads/ce69cec9-5062-4eb6-b0a8-e14b196a1ae3.png" />
            <div>
              <h1 className="font-bold text-sm text-sidebar-primary-foreground">EPISafety</h1>
              <p className="text-xs text-sidebar-foreground/60">Segurança do Trabalho</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
          {visibleMainItems.map((item) => {
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

          {visibleEpiItems.length > 0 && (
            <>
              <button
                onClick={() => setEpiOpen(!epiOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isEpiActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Gestão de EPIs</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${epiOpen ? "rotate-180" : ""}`} />
              </button>
              {epiOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleEpiItems.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                </div>
              )}
            </>
          )}

          {visibleCadastroItems.length > 0 && (
            <>
              <button
                onClick={() => setCadastroOpen(!cadastroOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isCadastroActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Cadastro</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${cadastroOpen ? "rotate-180" : ""}`} />
              </button>
              {cadastroOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleCadastroItems.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                </div>
              )}
            </>
          )}

          {visibleAfterCadastroItems.map((item) => {
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

          <Link
            to="/backups"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === "/backups"
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span className="truncate">Backups</span>
          </Link>

          {(isSuperAdmin || isPrincipal) && (
            <Link
              to="/faturas"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === "/faturas"
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">Faturas</span>
              {faturasAlerta > 0 && (
                <span className="relative ml-auto flex items-center">
                  <Bell className="w-4 h-4 text-destructive animate-bounce" />
                  <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {faturasAlerta}
                  </span>
                </span>
              )}
            </Link>
          )}

          {isSuperAdmin && (
            <Link
              to="/admin/empresas"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === "/admin/empresas"
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Crown className="w-4 h-4 shrink-0" />
              <span className="truncate">Admin Empresas</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          {showInstallButton && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              title="Instalar aplicativo na tela inicial"
            >
              <Download className="w-4 h-4" />
              <span>Instalar App</span>
            </button>
          )}
          <p className="text-xs text-sidebar-foreground/40 text-center truncate">{user?.email}</p>
          <button onClick={signOut} className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {/* iOS status bar background */}
        <div className="sticky top-0 z-40 h-[env(safe-area-inset-top,44px)] min-h-[44px] bg-primary lg:hidden" />

        {/* Mobile top header */}
        <header className="sticky top-[env(safe-area-inset-top,44px)] z-30 flex items-center justify-between px-4 py-3 bg-background border-b border-border lg:hidden">
          <div className="flex items-center gap-2">
            <img alt="EPISafety" className="w-7 h-7 object-contain" src="/lovable-uploads/ce69cec9-5062-4eb6-b0a8-e14b196a1ae3.png" />
            <span className="font-semibold text-sm">EPISafety</span>
          </div>
          <button onClick={signOut} className="p-2 text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl">{children}</div>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {bottomNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                <span className="truncate max-w-[60px]">{item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setMobileOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 text-[10px] font-medium transition-colors ${
                isCadastroActive || location.pathname === "/admin/empresas"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Menu className={`w-5 h-5 ${isCadastroActive ? "text-primary" : ""}`} />
              <span>Mais</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
