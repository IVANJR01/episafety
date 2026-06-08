import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, ClipboardList, BarChart3, Menu, LogOut, Building2, ChevronDown, FolderOpen, Shield, Crown, X, Settings, MessageSquare, HardHat, Download, GraduationCap, Stethoscope, HardDrive, GitBranch, Video, FileText, Bell, Boxes, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessModule, MODULOS } from "@/lib/permissions";
import { APP_VERSION } from "@/lib/version";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  moduleKey: string;
  description?: string;
}

const mainNavItems: NavItem[] = [];

// Bottom nav: key shortcuts for mobile
const mobileBottomItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { path: "/epis", label: "EPIs", icon: Package, moduleKey: "epis" },
  { path: "/entregas", label: "Entregas", icon: ClipboardList, moduleKey: "entregas" },
  { path: "/cadastro", label: "Cadastro", icon: Users, moduleKey: "cadastro_funcionarios" },
];

const epiItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { path: "/epis", label: "Cadastro de EPIs", icon: Package, moduleKey: "epis" },
  { path: "/epis/controle-contrato", label: "Estoque por Unidade", icon: Boxes, moduleKey: "estoque_contrato" },
  { path: "/entregas", label: "Entregas", icon: ClipboardList, moduleKey: "entregas" },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3, moduleKey: "relatorios" },
];

const gestaoDocItems: NavItem[] = [
  { path: "/treinamentos", label: "Documentos", icon: GraduationCap, moduleKey: "treinamentos" },
  { path: "/exames", label: "Exames", icon: Stethoscope, moduleKey: "exames" },
  { path: "/aso", label: "Gestão de ASO", icon: FileText, moduleKey: "aso" },
  { path: "/rh/asos", label: "Portal RH — ASO", icon: FileText, moduleKey: "rh" },
  { path: "/central-ppp", label: "Central PPP", icon: FileText, moduleKey: "treinamentos" },
];

const afterCadastroItems: NavItem[] = [
  { path: "/dds", label: "Lista de Presença", icon: MessageSquare, moduleKey: "dds" },
  { path: "/video-treinamentos", label: "Treinamentos", icon: Video, moduleKey: "video_treinamentos" },
];

const inspecoesItems: NavItem[] = [
  { path: "/inspecoes-se/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "inspecoes_se" },
  { path: "/inspecoes-se", label: "Listagem", icon: ClipboardList, moduleKey: "inspecoes_se" },
];

const cadastroItems: NavItem[] = [
  { path: "/cadastro", label: "Dashboard", icon: LayoutDashboard, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/empresas", label: "Empresas / Unidades", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/cadastro/funcionarios", label: "Funcionários", icon: Users, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/ghe", label: "GHE/GES (PGR/PCMSO)", icon: ClipboardList, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/usuarios", label: "Usuários Liberados", icon: Shield, moduleKey: "cadastro_usuarios" },
];

// Bottom nav shows max 5 items: main nav items + "Mais" for cadastro
const BOTTOM_NAV_MAX = 5;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user, modulosPermitidos, isSuperAdmin, isPrincipal, empresaId, empresasIds, setActiveEmpresaId } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [faturasAlerta, setFaturasAlerta] = useState(0);
  const [checking, setChecking] = useState(false);
  const [empresasNomes, setEmpresasNomes] = useState<Record<string, string>>({});

  // Load empresa names for the switcher
  const showEmpresaSwitcher = empresasIds.length > 1;
  useEffect(() => {
    if (!showEmpresaSwitcher) return;
    supabase.from("empresa_config").select("id, nome").in("id", empresasIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((e: any) => { map[e.id] = e.nome; });
        setEmpresasNomes(map);
      }
    });
  }, [empresasIds, showEmpresaSwitcher]);

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

  const canAccess = (moduleKey: string) => {
    if (isSuperAdmin || isPrincipal) return true;
    // Portal RH is also available to anyone who can view ASOs
    if (moduleKey === "rh" && canAccessModule(modulosPermitidos, "aso")) return true;
    return canAccessModule(modulosPermitidos, moduleKey);
  };

  const visibleMainItems = mainNavItems.filter((i) => canAccess(i.moduleKey));
  const visibleEpiItems = epiItems.filter((i) => canAccess(i.moduleKey));
  const visibleCadastroItems = cadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleAfterCadastroItems = afterCadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleGestaoDocItems = gestaoDocItems.filter((i) => canAccess(i.moduleKey));
  const visibleInspecoesItems = inspecoesItems.filter((i) => canAccess(i.moduleKey));

  const isEpiActive = visibleEpiItems.some((i) => location.pathname === i.path);
  const isCadastroActive = visibleCadastroItems.some((i) => location.pathname === i.path);
  const isGestaoDocActive = visibleGestaoDocItems.some((i) => location.pathname === i.path);
  const isInspecoesActive = visibleInspecoesItems.some((i) => location.pathname === i.path);
  const [epiOpen, setEpiOpen] = useState(true);
  const [cadastroOpen, setCadastroOpen] = useState(isCadastroActive);
  const [gestaoDocOpen, setGestaoDocOpen] = useState(isGestaoDocActive);
  const [inspecoesOpen, setInspecoesOpen] = useState(isInspecoesActive);

  // Bottom nav items for mobile
  const visibleMobileBottomItems = mobileBottomItems.filter((i) => canAccess(i.moduleKey));
  const bottomNavItems = visibleMobileBottomItems.slice(0, 4);
  const hasMore = true; // Always show "Mais" for full sidebar access

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

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.update();
        // Give a moment for the SW to detect changes
        await new Promise((r) => setTimeout(r, 1500));
        if (reg.waiting) {
          toast.info("Nova versão disponível! Atualizando...");
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        } else {
          toast.success("Você já está na versão mais recente ✓");
        }
      } else {
        toast.success("Você já está na versão mais recente ✓");
      }
    } catch {
      toast.error("Erro ao verificar atualizações");
    } finally {
      setChecking(false);
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img alt="SafetySoluções" className="w-12 h-12 object-contain" src="https://api.freelovable.com.br/storage/v1/object/public/anexos/fceb5c8f-7aa0-4b1a-8be0-67008038fa6e.png" />
            <div className="leading-tight">
              <h1 className="font-bold text-base tracking-tight text-sidebar-primary-foreground">SafetySoluções</h1>
              <p className="text-[10px] text-sidebar-foreground/50 font-medium">Segurança do Trabalho</p>
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

          {visibleGestaoDocItems.length > 0 && (
            <>
              <button
                onClick={() => setGestaoDocOpen(!gestaoDocOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isGestaoDocActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Gestão Documental</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${gestaoDocOpen ? "rotate-180" : ""}`} />
              </button>
              {gestaoDocOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleGestaoDocItems.map((item) => {
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

          {visibleInspecoesItems.length > 0 && (
            <>
              <button
                onClick={() => setInspecoesOpen(!inspecoesOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isInspecoesActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <HardHat className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Inspeções</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${inspecoesOpen ? "rotate-180" : ""}`} />
              </button>
              {inspecoesOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleInspecoesItems.map((item) => {
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
            <div className="pt-2 mt-2 border-t border-sidebar-border">
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-destructive/10 text-destructive hover:bg-destructive/15"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">Painel Admin</span>
                <span className="text-[10px] uppercase tracking-wider opacity-70">Super</span>
              </Link>
            </div>
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
          {/* Company switcher for multi-empresa users */}
          {showEmpresaSwitcher && (
            <div className="px-2 mb-2">
              <select
                value={empresaId || ""}
                onChange={(e) => setActiveEmpresaId(e.target.value)}
                className="w-full text-xs bg-sidebar-accent text-sidebar-foreground rounded-md px-2 py-1.5 border border-sidebar-border focus:outline-none focus:ring-1 focus:ring-primary truncate"
                title="Alternar empresa"
              >
                {empresasIds.map(id => (
                  <option key={id} value={id}>
                    {empresasNomes[id] || id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-sidebar-foreground/40 text-center truncate">{user?.email}</p>
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className="flex items-center justify-center gap-1.5 text-[10px] text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors mx-auto"
            title="Verificar atualizações"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
            <span>v{APP_VERSION}{checking ? " verificando..." : " · Atualizar"}</span>
          </button>
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
        <header className="sticky top-[env(safe-area-inset-top,44px)] z-30 flex items-center justify-between px-4 py-2 bg-background border-b border-border lg:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <img alt="SafetySoluções" className="w-8 h-8 object-contain" src="https://api.freelovable.com.br/storage/v1/object/public/anexos/fceb5c8f-7aa0-4b1a-8be0-67008038fa6e.png" />
              <div className="flex flex-col">
                <span className="font-bold text-xs leading-none">SafetySoluções</span>
                <span className="text-[10px] text-muted-foreground">Multiempresa</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {showEmpresaSwitcher && (
              <select
                value={empresaId || ""}
                onChange={(e) => setActiveEmpresaId(e.target.value)}
                className="text-[10px] bg-muted border-none rounded-md px-1.5 py-1 focus:ring-1 focus:ring-primary max-w-[100px] truncate"
              >
                {empresasIds.map(id => (
                  <option key={id} value={id}>
                    {empresasNomes[id] || "..."}
                  </option>
                ))}
              </select>
            )}
            <button onClick={signOut} className="p-2 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border lg:hidden pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-stretch justify-around">
          {bottomNavItems.map((item) => {
            const active = item.path === "/" 
              ? location.pathname === "/" 
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 flex-1 text-[10px] font-medium transition-colors ${
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
          <button
            onClick={() => setMobileOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 flex-1 text-[10px] font-medium transition-colors ${
              mobileOpen
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
