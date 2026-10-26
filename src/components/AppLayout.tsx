import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, ClipboardList, BarChart3, Menu, LogOut, Building2, ChevronDown, FolderOpen, Shield, ShieldCheck, Crown, X, Settings, MessageSquare, HardHat, Download, GraduationCap, Stethoscope, HardDrive, GitBranch, Video, FileText, Bell, Boxes, RefreshCw, Briefcase, Network, BookOpen, Flame, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessModule, MODULOS } from "@/lib/permissions";
import { versaoParaMostrar } from "@/lib/verificarAtualizacao";
import { forceAppUpdate } from "@/lib/appUpdate";
import SuporteButton from "@/components/SuporteButton";
import TermsAcceptanceBanner from "@/components/TermsAcceptanceBanner";
import { pedirInstalacao } from "@/lib/instalarPwa";

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

export const mainNavItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
];

// Bottom nav: key shortcuts for mobile
export const mobileBottomItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { path: "/epis", label: "EPIs", icon: Package, moduleKey: "epis" },
  { path: "/entregas", label: "Entregas", icon: ClipboardList, moduleKey: "entregas" },
  { path: "/cadastro/funcionarios", label: "Colaboradores", icon: Users, moduleKey: "cadastro_funcionarios" },
];

// 🏢 CADASTRO MESTRE: Informações-base da organização, estrutura ocupacional e colaboradores
export const cadastroMestreItems: NavItem[] = [
  { path: "/cadastro/empresas", label: "Empresas / Unidades", icon: Building2, moduleKey: "cadastro_empresas" },
  { path: "/documentacao-sst?aba=ges", label: "Estrutura Ocupacional & GES", icon: Network, moduleKey: "pgr" },
  { path: "/cadastro/funcionarios", label: "Quadro de Colaboradores", icon: Users, moduleKey: "cadastro_funcionarios" },
  { path: "/arquivo-digital", label: "Dossiê do Colaborador", icon: FolderOpen, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/vencimentos", label: "Painel de Vencimentos", icon: Bell, moduleKey: "arquivo_digital" },
  { path: "/cadastro/limpeza", label: "Limpeza de Cadastros", icon: RefreshCw, moduleKey: "cadastro_empresas" },
];

// 📋 GESTÃO SST: Engenharia Ocupacional e Documentos Técnicos
export const gestaoSstItems: NavItem[] = [
  { path: "/documentacao-sst", label: "Documentação SST", icon: BookOpen, moduleKey: "pgr" },
  { path: "/pgr", label: "PGR — Gerenciamento de Riscos", icon: FileText, moduleKey: "pgr" },
  { path: "/pcmso/dashboard", label: "PCMSO — Saúde Ocupacional", icon: Stethoscope, moduleKey: "pgr" },
  { path: "/ltcat", label: "LTCAT — Laudo Técnico", icon: ShieldCheck, moduleKey: "ltcat" },
  { path: "/programas", label: "Laudos e Programas", icon: FileText, moduleKey: "pgr" },
  { path: "/central-ppp", label: "PPP — Perfil Previdenciário", icon: ClipboardList, moduleKey: "ppp" },
];

// 👥 COLABORADORES: Gestão do Quadro e Documentação Individual
export const colaboradoresItems: NavItem[] = [
  { path: "/cadastro/funcionarios", label: "Quadro de Colaboradores", icon: Users, moduleKey: "cadastro_funcionarios" },
  { path: "/arquivo-digital", label: "Dossiê do Colaborador", icon: FolderOpen, moduleKey: "arquivo_digital" },
  { path: "/arquivo-digital/vencimentos", label: "Painel de Vencimentos", icon: Bell, moduleKey: "arquivo_digital" },
];

// 🩺 SAÚDE OCUPACIONAL: Gestão Médica, ASO e Portal RH
export const saudeItems: NavItem[] = [
  { path: "/aso", label: "Exames e ASO", icon: Stethoscope, moduleKey: "aso" },
  { path: "/rh/asos", label: "Portal RH — ASO", icon: Briefcase, moduleKey: "portal_rh" },
];

// 🦺 GESTÃO DE EPIs: Ciclo de vida dos equipamentos e entregas
export const epiItems: NavItem[] = [
  { path: "/epis", label: "Cadastro de EPIs", icon: Package, moduleKey: "epis" },
  { path: "/epis/controle-contrato", label: "Estoque por Unidade", icon: Boxes, moduleKey: "estoque_contrato" },
  { path: "/epis/solicitacoes-materiais", label: "Solicitação de Materiais", icon: ClipboardList, moduleKey: "solicitacoes_materiais" },
  { path: "/entregas", label: "Entregas e Fichas", icon: ClipboardList, moduleKey: "entregas" },
  { path: "/relatorios", label: "Relatórios de EPIs", icon: BarChart3, moduleKey: "relatorios" },
];

// 🎓 TREINAMENTOS: Listas de presença e acervo audiovisual
export const treinamentosItems: NavItem[] = [
  { path: "/dds", label: "Listas de Presença / DDS", icon: MessageSquare, moduleKey: "dds" },
  { path: "/video-treinamentos", label: "Vídeos / Conteúdos", icon: Video, moduleKey: "video_treinamentos" },
];

// 🔎 INSPEÇÕES: Auditorias em campo, locais e extintores
export const inspecoesItems: NavItem[] = [
  { path: "/inspecoes-se/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "inspecoes_se" },
  { path: "/inspecoes-se", label: "Inspeções e Apontamentos", icon: ClipboardList, moduleKey: "inspecoes_se" },
  { path: "/inspecoes-se/obras", label: "Locais e Obras", icon: HardHat, moduleKey: "inspecoes_se" },
  { path: "/extintores", label: "Extintores (NR-23)", icon: Flame, moduleKey: "extintores" },
];

// 📊 RELATÓRIOS: Central consolidada
export const relatoriosNavItems: NavItem[] = [
  { path: "/relatorios", label: "Central de Relatórios", icon: BarChart3, moduleKey: "relatorios" },
];

// 💼 COMERCIAL: Orçamentos, clientes e catálogo
export const comercialItems: NavItem[] = [
  { path: "/comercial", label: "Dashboard Comercial", icon: LayoutDashboard, moduleKey: "comercial" },
  { path: "/comercial/orcamentos", label: "Orçamentos e Cotações", icon: FileText, moduleKey: "comercial" },
  { path: "/comercial/clientes", label: "Clientes", icon: Users, moduleKey: "comercial" },
  { path: "/comercial/catalogo", label: "Catálogo de Serviços", icon: BookOpen, moduleKey: "comercial" },
];

// ⚙️ ADMINISTRAÇÃO: Acessos e permissões
export const administracaoItems: NavItem[] = [
  { path: "/cadastro/usuarios", label: "Usuários Liberados", icon: Shield, moduleKey: "cadastro_usuarios" },
];

// Aliases para compatibilidade total com módulos e testes legados
export const asoItems: NavItem[] = [
  { path: "/aso", label: "Exames Ocupacionais", icon: Stethoscope, moduleKey: "aso" },
];
export const portalRhItems: NavItem[] = [
  { path: "/rh/asos", label: "Portal RH — ASO", icon: Briefcase, moduleKey: "portal_rh" },
];
export const gestaoDocItems: NavItem[] = gestaoSstItems;
export const cadastroItems: NavItem[] = cadastroMestreItems;
export const afterCadastroItems: NavItem[] = [];
export const esocialItems: NavItem[] = [
  { path: "/esocial/s2240/mapeamentos", label: "S-2240 — Mapeamentos", icon: Network, moduleKey: "esocial" },
  { path: "/esocial/s2240/dashboard", label: "S-2240 — Dashboard", icon: LayoutDashboard, moduleKey: "esocial" },
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
  // Ocultado temporariamente a pedido do cliente (módulo não está sendo usado/cobrado).
  /*
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
  */

  const canAccess = (moduleKey: string) => {
    if (isSuperAdmin || isPrincipal) return true;
    // Portal RH: aceita chave nova `portal_rh`, legado `rh`, ou compat por `aso`.
    if (moduleKey === "portal_rh") {
      return canAccessModule(modulosPermitidos, "portal_rh")
        || canAccessModule(modulosPermitidos, "rh")
        || canAccessModule(modulosPermitidos, "aso");
    }
    // Extintores: aceita permissão direta ou herda de inspeções
    if (moduleKey === "extintores") {
      return canAccessModule(modulosPermitidos, "extintores")
        || canAccessModule(modulosPermitidos, "inspecoes_se");
    }
    return canAccessModule(modulosPermitidos, moduleKey);
  };

  const isItemActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path.includes("?")) {
      const [pathname, search] = path.split("?");
      return location.pathname === pathname && location.search.includes(search);
    }
    if (path === "/documentacao-sst") {
      return location.pathname.startsWith("/documentacao-sst") && !location.search.includes("aba=ges");
    }
    if (path === "/arquivo-digital") {
      return location.pathname.startsWith("/arquivo-digital") && !location.pathname.startsWith("/arquivo-digital/vencimentos");
    }
    if (path === "/epis") {
      return location.pathname === "/epis";
    }
    if (path === "/cadastro/empresas") {
      return location.pathname.startsWith("/cadastro/empresas") || location.pathname.startsWith("/cadastro/filiais");
    }
    if (path === "/central-ppp") {
      return location.pathname.startsWith("/central-ppp") || location.pathname.startsWith("/ppp");
    }
    if (path === "/aso") {
      return location.pathname.startsWith("/aso") || location.pathname.startsWith("/exames");
    }
    if (path === "/comercial") {
      return location.pathname === "/comercial";
    }
    return location.pathname.startsWith(path);
  };

  const visibleMainItems = mainNavItems.filter((i) => canAccess(i.moduleKey));
  const visibleCadastroMestreItems = cadastroMestreItems.filter((i) => canAccess(i.moduleKey));
  const visibleGestaoSstItems = gestaoSstItems.filter((i) => canAccess(i.moduleKey));
  const visibleColaboradoresItems = colaboradoresItems.filter((i) => canAccess(i.moduleKey));
  const visibleSaudeItems = saudeItems.filter((i) => canAccess(i.moduleKey));
  const visibleEpiItems = epiItems.filter((i) => canAccess(i.moduleKey));
  const visibleTreinamentosItems = treinamentosItems.filter((i) => canAccess(i.moduleKey));
  const visibleInspecoesItems = inspecoesItems.filter((i) => canAccess(i.moduleKey));
  const visibleRelatoriosItems = relatoriosNavItems.filter((i) => canAccess(i.moduleKey));
  const visibleComercialItems = comercialItems.filter((i) => canAccess(i.moduleKey));
  const visibleAdministracaoItems = administracaoItems.filter((i) => canAccess(i.moduleKey));

  // Retrocompatibilidade para referências legadas
  const visibleCadastroItems = visibleCadastroMestreItems;
  const visibleAfterCadastroItems = afterCadastroItems.filter((i) => canAccess(i.moduleKey));
  const visibleAsoItems = visibleSaudeItems;
  const visiblePortalRhItems = portalRhItems.filter((i) => canAccess(i.moduleKey));
  const visibleGestaoDocItems = visibleGestaoSstItems;
  const visibleEsocialItems: NavItem[] = [];
  void esocialItems;

  const isCadastroMestreActive = visibleCadastroMestreItems.some((i) => isItemActive(i.path))
    || location.pathname.startsWith("/cadastro/empresas")
    || location.pathname.startsWith("/cadastro/filiais")
    || location.pathname.startsWith("/cadastro/funcionarios")
    || location.pathname.startsWith("/arquivo-digital")
    || location.pathname.startsWith("/cadastro/limpeza")
    || (location.pathname.startsWith("/documentacao-sst") && location.search.includes("aba=ges"))
    || location.pathname.startsWith("/cadastro/ghe");
  const isGestaoSstActive = visibleGestaoSstItems.some((i) => isItemActive(i.path)) || location.pathname.startsWith("/pgr") || location.pathname.startsWith("/pcmso") || location.pathname.startsWith("/ltcat") || location.pathname.startsWith("/programas") || location.pathname.startsWith("/central-ppp") || (location.pathname.startsWith("/documentacao-sst") && !location.search.includes("aba=ges"));
  const isSaudeActive = visibleSaudeItems.some((i) => isItemActive(i.path));
  const isEpiActive = visibleEpiItems.some((i) => isItemActive(i.path));
  const isTreinamentosActive = visibleTreinamentosItems.some((i) => isItemActive(i.path));
  const isInspecoesActive = visibleInspecoesItems.some((i) => isItemActive(i.path));
  const isRelatoriosActive = visibleRelatoriosItems.some((i) => isItemActive(i.path));
  const isComercialActive = visibleComercialItems.some((i) => isItemActive(i.path));
  const isAdministracaoActive = visibleAdministracaoItems.some((i) => isItemActive(i.path));

  const [cadastroMestreOpen, setCadastroMestreOpen] = useState(isCadastroMestreActive);
  const [gestaoSstOpen, setGestaoSstOpen] = useState(isGestaoSstActive);
  const [saudeOpen, setSaudeOpen] = useState(isSaudeActive);
  const [epiOpen, setEpiOpen] = useState(isEpiActive);
  const [treinamentosOpen, setTreinamentosOpen] = useState(isTreinamentosActive);
  const [inspecoesOpen, setInspecoesOpen] = useState(isInspecoesActive);
  const [comercialOpen, setComercialOpen] = useState(isComercialActive);
  const [administracaoOpen, setAdministracaoOpen] = useState(isAdministracaoActive);

  // Auto-expande o grupo ativo sempre que a rota mudar
  useEffect(() => {
    if (isCadastroMestreActive) setCadastroMestreOpen(true);
    if (isGestaoSstActive) setGestaoSstOpen(true);
    if (isSaudeActive) setSaudeOpen(true);
    if (isEpiActive) setEpiOpen(true);
    if (isTreinamentosActive) setTreinamentosOpen(true);
    if (isInspecoesActive) setInspecoesOpen(true);
    if (isComercialActive) setComercialOpen(true);
    if (isAdministracaoActive) setAdministracaoOpen(true);
  }, [location.pathname, location.search]);

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

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    const resultado = await pedirInstalacao(installPrompt);
    setInstallPrompt(null);
    if (resultado === "aceito") setShowInstallButton(false);
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
          {/* 🏠 Dashboard */}
          {visibleMainItems.map((item) => {
            const active = isItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {/* 🏢 CADASTRO MESTRE */}
          {visibleCadastroMestreItems.length > 0 && (
            <>
              <button
                onClick={() => setCadastroMestreOpen(!cadastroMestreOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isCadastroMestreActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Cadastro Mestre</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${cadastroMestreOpen ? "rotate-180" : ""}`} />
              </button>
              {cadastroMestreOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleCadastroMestreItems.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* 📋 GESTÃO SST */}
          {visibleGestaoSstItems.length > 0 && (
            <>
              <button
                onClick={() => setGestaoSstOpen(!gestaoSstOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isGestaoSstActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Gestão SST</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${gestaoSstOpen ? "rotate-180" : ""}`} />
              </button>
              {gestaoSstOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleGestaoSstItems.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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


          {/* 🩺 SAÚDE OCUPACIONAL */}
          {visibleSaudeItems.length > 0 && (
            <>
              <button
                onClick={() => setSaudeOpen(!saudeOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isSaudeActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Saúde Ocupacional</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${saudeOpen ? "rotate-180" : ""}`} />
              </button>
              {saudeOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleSaudeItems.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* 🦺 GESTÃO DE EPIs */}
          {visibleEpiItems.length > 0 && (
            <>
              <button
                onClick={() => setEpiOpen(!epiOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isEpiActive
                    ? "bg-sidebar-accent text-primary font-semibold"
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
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* 🎓 TREINAMENTOS */}
          {visibleTreinamentosItems.length > 0 && (
            <>
              <button
                onClick={() => setTreinamentosOpen(!treinamentosOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isTreinamentosActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Treinamentos</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${treinamentosOpen ? "rotate-180" : ""}`} />
              </button>
              {treinamentosOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleTreinamentosItems.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* 🔎 INSPEÇÕES */}
          {visibleInspecoesItems.length > 0 && (
            <>
              <button
                onClick={() => setInspecoesOpen(!inspecoesOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isInspecoesActive
                    ? "bg-sidebar-accent text-primary font-semibold"
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
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* 📊 RELATÓRIOS */}
          {visibleRelatoriosItems.length > 0 && (
            <>
              {visibleRelatoriosItems.map((item) => {
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-sidebar-accent text-primary font-semibold"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}

          {/* 💼 COMERCIAL */}
          {visibleComercialItems.length > 0 && (
            <>
              <button
                onClick={() => setComercialOpen(!comercialOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isComercialActive
                    ? "bg-sidebar-accent text-primary font-semibold"
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
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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

          {/* ⚙️ ADMINISTRAÇÃO */}
          {visibleAdministracaoItems.length > 0 && (
            <>
              <button
                onClick={() => setAdministracaoOpen(!administracaoOpen)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                  isAdministracaoActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">Administração</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${administracaoOpen ? "rotate-180" : ""}`} />
              </button>
              {administracaoOpen && (
                <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {visibleAdministracaoItems.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-accent text-primary font-semibold"
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
            <span>v{versaoParaMostrar()}{checking ? " verificando..." : " · Atualizar"}</span>
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
