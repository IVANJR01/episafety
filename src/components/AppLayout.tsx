import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, ClipboardList, BarChart3, Menu, LogOut, Building2, ChevronDown, FolderOpen, Shield, ShieldCheck, Crown, X, Settings, MessageSquare, HardHat, Download, GraduationCap, Stethoscope, HardDrive, GitBranch, Video, FileText, Bell, Boxes, RefreshCw, FileWarning, Briefcase, Network, BookOpen, Flame, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessModule, MODULOS } from "@/lib/permissions";
import { APP_VERSION } from "@/lib/version";
import { forceAppUpdate } from "@/lib/appUpdate";
import SuporteButton from "@/components/SuporteButton";
import TermsAcceptanceBanner from "@/components/TermsAcceptanceBanner";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  moduleKey: string;
  description?: string;
}

interface EmpresaSwitcherInfo {
  nome: string;
  empresa_pai_id: string | null;
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
  { path: "/epis/solicitacoes-materiais", label: "Solicitação de Materiais", icon: ClipboardList, moduleKey: "solicitacoes_materiais" },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3, moduleKey: "relatorios" },
];

// Gestão de ASO — mantida como array vazio para não quebrar refs.
// ASO agora aparece dentro de "Gestão Documental" como "ASO / Saúde Ocupacional".
const asoItems: NavItem[] = [];

// Portal RH — acesso restrito do RH a ASOs liberados
const portalRhItems: NavItem[] = [
  { path: "/rh/asos", label: "Portal RH — ASO", icon: Briefcase, moduleKey: "portal_rh" },
];

// Gestão Documental SST (ASO incluído; sem Portal RH, sem eSocial)
// PGR e LTCAT foram movidos para o módulo "Programas".
const gestaoDocItems: NavItem[] = [
  { path: "/aso", label: "Exames", icon: Stethoscope, moduleKey: "aso" },
  { path: "/cat", label: "CAT — Acidente de Trabalho", icon: FileWarning, moduleKey: "cat" },
  { path: "/treinamentos", label: "Capacitações", icon: GraduationCap, moduleKey: "treinamentos" },
  { path: "/dds", label: "Listas de Presença", icon: MessageSquare, moduleKey: "dds" },
  { path: "/video-treinamentos", label: "Vídeos / Conteúdos", icon: Video, moduleKey: "video_treinamentos" },
];

// Arquivo Digital SST — o dossiê do colaborador e tudo que o alimenta.
//
// Vencidos / Vencendo / Não enviados eram três itens de menu apontando
// para a MESMA tela, que já traz esses mesmos filtros como cartões
// clicáveis no topo. Três atalhos para uma tela só é menu comprido sem
// nada a mais: viraram um item, e o filtro se escolhe lá dentro.
const arquivoDigitalItems: NavItem[] = [
  { path: "/arquivo-digital/dossies", label: "Dossiê de Colaboradores", icon: FolderOpen, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/vencimentos", label: "Pendências e Vencimentos", icon: Bell, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/historico", label: "Histórico de Versões", icon: GitBranch, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/tipos", label: "Configuração de Tipos", icon: Settings, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/importar-drive", label: "Importar do Drive", icon: HardDrive, moduleKey: "arquivo_digital" },
];

// Programas — Módulo Mestre Unificado
const programasItems: NavItem[] = [
  { path: "/documentacao-sst", label: "Central Documentação SST", icon: ShieldCheck, moduleKey: "pgr" },
  { path: "/programas/ordem-servico", label: "Ordens de Serviço", icon: ClipboardList, moduleKey: "pgr" },
];

// Comercial — Orçamentos, Clientes, Catálogo
const comercialItems: NavItem[] = [
  { path: "/comercial", label: "Dashboard Comercial", icon: LayoutDashboard, moduleKey: "comercial" },
  { path: "/comercial/orcamentos", label: "Orçamentos e Cotações", icon: FileText, moduleKey: "comercial" },
  { path: "/comercial/clientes", label: "Clientes", icon: Users, moduleKey: "comercial" },
  { path: "/comercial/catalogo", label: "Catálogo de Serviços", icon: BookOpen, moduleKey: "comercial" },
];

// eSocial técnico / stub
const esocialItems: NavItem[] = [
  { path: "/cat/esocial/config", label: "S-2210 — CAT (config)", icon: Settings, moduleKey: "cat" },
  { path: "/esocial/s2240/mapeamentos", label: "S-2240 — Mapeamentos", icon: Network, moduleKey: "esocial" },
  { path: "/esocial/s2240/dashboard", label: "S-2240 — Dashboard", icon: LayoutDashboard, moduleKey: "esocial" },
];

const afterCadastroItems: NavItem[] = [];

const inspecoesItems: NavItem[] = [
  { path: "/inspecoes-se/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "inspecoes_se" },
  { path: "/inspecoes-se", label: "Listagem", icon: ClipboardList, moduleKey: "inspecoes_se" },
  { path: "/inspecoes-se/obras", label: "Cadastro de Local", icon: HardHat, moduleKey: "inspecoes_se" },
];

const cadastroItems: NavItem[] = [
  { path: "/cadastro", label: "Dashboard", icon: LayoutDashboard, moduleKey: "cadastro_funcionarios" },
  { path: "/cadastro/empresas", label: "Empresas / Unidades", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/cadastro/funcionarios", label: "Funcionários", icon: Users, moduleKey: "cadastro_funcionarios" },
  // "GES (PGR/PCMSO)" saiu daqui: /cadastro/ghe renderizava literalmente o
  // MESMO componente da aba GES em Documentação, só com outro título. Dois
  // caminhos de menu para a mesma tela. O GES agora tem um lugar só, em
  // Documentação › GES; a rota antiga continua existindo e redireciona para lá.
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
  const [empresasInfo, setEmpresasInfo] = useState<Record<string, EmpresaSwitcherInfo>>({});

  // Load empresa names for the switcher
  const showEmpresaSwitcher = empresasIds.length > 0 || isSuperAdmin || isPrincipal;
  useEffect(() => {
    if (empresasIds.length === 0) return;
    supabase.from("empresa_config").select("id, nome, empresa_pai_id").in("id", empresasIds).then(({ data }) => {
      if (data) {
        const map: Record<string, EmpresaSwitcherInfo> = {};
        data.forEach((e: any) => {
          map[e.id] = {
            nome: e.nome,
            empresa_pai_id: e.empresa_pai_id || null,
          };
        });
        setEmpresasInfo(map);
      }
    });
  }, [empresasIds]);

  const empresasSwitcherIds = useMemo(() => {
    if (!isSuperAdmin && !isPrincipal) return empresasIds;

    // Administradores alternam somente entre matrizes. Filiais continuam
    // dentro do escopo da matriz e permanecem disponíveis nos módulos.
    return empresasIds.filter((id) => {
      const empresa = empresasInfo[id];
      return empresa && !empresa.empresa_pai_id;
    });
  }, [empresasIds, empresasInfo, isSuperAdmin, isPrincipal]);

  const empresaSelecionadaId = useMemo(() => {
    if (!empresaId || (!isSuperAdmin && !isPrincipal)) return empresaId;
    return empresasInfo[empresaId]?.empresa_pai_id || empresaId;
  }, [empresaId, empresasInfo, isSuperAdmin, isPrincipal]);

  useEffect(() => {
    if (!empresaId || (!isSuperAdmin && !isPrincipal)) return;
    const matrizId = empresasInfo[empresaId]?.empresa_pai_id;
    if (matrizId && matrizId !== empresaId) {
      setActiveEmpresaId(matrizId);
    }
  }, [empresaId, empresasInfo, isSuperAdmin, isPrincipal, setActiveEmpresaId]);

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
    // Portal RH: aceita chave nova `portal_rh`, legado `rh`, ou compat por `aso`.
    if (moduleKey === "portal_rh") {
      return canAccessModule(modulosPermitidos, "portal_rh")
        || canAccessModule(modulosPermitidos, "rh")
        || canAccessModule(modulosPermitidos, "aso");
    }
    return canAccessModule(modulosPermitidos, moduleKey);
  };

  const visibleMainItems = mainNavItems.filter((i) => canAccess(i.moduleKey));
  const visibleEpiItems = epiItems.filter((i) => canAccess(i.moduleKey));
  const visibleCadastroItems = cadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleAfterCadastroItems = afterCadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleAsoItems = asoItems.filter((i) => canAccess(i.moduleKey));
  const visiblePortalRhItems = portalRhItems.filter((i) => canAccess(i.moduleKey));
  const visibleGestaoDocItems = gestaoDocItems.filter((i) => canAccess(i.moduleKey));
  const visibleArquivoDigitalItems = arquivoDigitalItems.filter((i) => canAccess(i.moduleKey));
  // eSocial ocultado temporariamente do menu (rotas/páginas/dados preservados).
  const visibleEsocialItems: NavItem[] = [];
  void esocialItems;
  const visibleInspecoesItems = inspecoesItems.filter((i) => canAccess(i.moduleKey));
  const visibleProgramasItems = programasItems.filter((i) => canAccess(i.moduleKey));
  const visibleComercialItems = comercialItems.filter((i) => canAccess(i.moduleKey));

  const isEpiActive = visibleEpiItems.some((i) => location.pathname === i.path);
  const isCadastroActive = visibleCadastroItems.some((i) => location.pathname === i.path);
  const isAsoActive = visibleAsoItems.some((i) => location.pathname.startsWith(i.path));
  const isPortalRhActive = visiblePortalRhItems.some((i) => location.pathname.startsWith(i.path));
  const isGestaoDocActive = visibleGestaoDocItems.some((i) => location.pathname === i.path);
  const isArquivoDigitalActive = location.pathname.startsWith("/arquivo-digital");
  const isEsocialActive = visibleEsocialItems.some((i) => location.pathname.startsWith(i.path));
  const isInspecoesActive = visibleInspecoesItems.some((i) => location.pathname === i.path);
  const isProgramasActive = location.pathname.startsWith("/programas") || location.pathname.startsWith("/pgr") || location.pathname.startsWith("/ltcat");
  const isComercialActive = location.pathname.startsWith("/comercial");
  const [epiOpen, setEpiOpen] = useState(true);
  const [cadastroOpen, setCadastroOpen] = useState(isCadastroActive);
  const [asoOpen, setAsoOpen] = useState(isAsoActive);
  const [portalRhOpen, setPortalRhOpen] = useState(isPortalRhActive);
  const [gestaoDocOpen, setGestaoDocOpen] = useState(isGestaoDocActive);
  const [arquivoDigitalOpen, setArquivoDigitalOpen] = useState(isArquivoDigitalActive);
  const [esocialOpen, setEsocialOpen] = useState(isEsocialActive);
  const [inspecoesOpen, setInspecoesOpen] = useState(isInspecoesActive);
  const [programasOpen, setProgramasOpen] = useState(isProgramasActive);
  const [comercialOpen, setComercialOpen] = useState(isComercialActive);

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
      toast.info("Limpando cache e carregando a versão mais recente...");
      await forceAppUpdate();
    } catch {
      toast.error("Erro ao verificar atualizações");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <TermsAcceptanceBanner />
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 flex flex-col ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <img alt="SafetySoluções" className="w-12 h-12 object-contain" src="/marca/8df588ff-740d-4376-9653-dc6f07556c80.png" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
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

          {visibleAsoItems.length > 0 && (
            <>
              <button
                onClick={() => setAsoOpen(!asoOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isAsoActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Gestão de ASO</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${asoOpen ? "rotate-180" : ""}`} />
              </button>
              {asoOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleAsoItems.map((item) => {
                    const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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

          {visiblePortalRhItems.length > 0 && (
            <>
              <button
                onClick={() => setPortalRhOpen(!portalRhOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isPortalRhActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Portal RH</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${portalRhOpen ? "rotate-180" : ""}`} />
              </button>
              {portalRhOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visiblePortalRhItems.map((item) => {
                    const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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

          {visibleProgramasItems.length > 0 && (
            <>
              <button
                onClick={() => setProgramasOpen(!programasOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isProgramasActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Programas</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${programasOpen ? "rotate-180" : ""}`} />
              </button>
              {programasOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleProgramasItems.map((item) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path !== "/programas" && location.pathname.startsWith(item.path + "/"));
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

          {visibleComercialItems.length > 0 && (
            <>
              <button
                onClick={() => setComercialOpen(!comercialOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isComercialActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Comercial</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${comercialOpen ? "rotate-180" : ""}`} />
              </button>
              {comercialOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleComercialItems.map((item) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path === "/comercial/orcamentos" && location.pathname.startsWith("/comercial/orcamentos"));
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

          {visibleArquivoDigitalItems.length > 0 && (
            <>
              <button
                onClick={() => setArquivoDigitalOpen(!arquivoDigitalOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isArquivoDigitalActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Arquivo Digital SST</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${arquivoDigitalOpen ? "rotate-180" : ""}`} />
              </button>
              {arquivoDigitalOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleArquivoDigitalItems.map((item) => {
                    // Três itens apontam para a mesma rota com filtro na URL,
                    // então comparar só o pathname marcaria os três de uma vez.
                    const active = `${location.pathname}${location.search}` === item.path;
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

          {visibleEsocialItems.length > 0 && (
            <>
              <button
                onClick={() => setEsocialOpen(!esocialOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isEsocialActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Network className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">eSocial (stub)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${esocialOpen ? "rotate-180" : ""}`} />
              </button>
              {esocialOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  <p className="text-[10px] text-sidebar-foreground/40 px-3 py-1 leading-tight">
                    Modo técnico/stub — sem certificado digital, SOAP, XMLDSig, ICP-Brasil, S-3000 ou envio real.
                  </p>
                  {visibleEsocialItems.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
          {/* Seletor de empresa para usuários multi-empresa ou Super Admin */}
          {(showEmpresaSwitcher || isSuperAdmin) && (
            <div className="px-2 mb-2 space-y-1">
              <label className="text-[10px] uppercase font-bold text-sidebar-foreground/40 px-2 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Empresa Ativa
              </label>
              <select
                value={empresaSelecionadaId || ""}
                onChange={(e) => setActiveEmpresaId(e.target.value)}
                className="w-full text-xs bg-sidebar-accent text-sidebar-foreground rounded-md px-2 py-2 border border-sidebar-border focus:outline-none focus:ring-1 focus:ring-primary truncate font-medium"
                title="Alternar empresa ativa"
              >
                {!empresaSelecionadaId && <option value="">Selecione...</option>}
                {empresasSwitcherIds.map(id => (
                  <option key={id} value={id}>
                    {empresasInfo[id]?.nome || id}
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
          <SuporteButton variant="sidebar" />
          <div className="flex items-center gap-2 px-4 text-[10px] text-sidebar-foreground/40">
            <Link to="/termos" className="hover:text-sidebar-foreground/70 hover:underline">Termos</Link>
            <span>·</span>
            <Link to="/privacidade" className="hover:text-sidebar-foreground/70 hover:underline">Privacidade</Link>
          </div>
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
              <img alt="SafetySoluções" className="w-8 h-8 object-contain" src="/marca/8df588ff-740d-4376-9653-dc6f07556c80.png" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
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
                {empresasSwitcherIds.map(id => (
                  <option key={id} value={id}>
                    {empresasInfo[id]?.nome || "..."}
                  </option>
                ))}
              </select>
            )}
            <SuporteButton variant="icon" className="text-muted-foreground hover:text-foreground" />
            <button onClick={signOut} className="p-2 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* `app-content` existe para o CSS soltar o teto de 1280px nas telas
            que são planilha, não formulário — ver index.css. */}
        <div className="app-content p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
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
