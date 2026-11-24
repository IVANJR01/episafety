import { Suspense, type ReactNode } from "react";
import { carregarPagina } from "@/lib/carregarPagina";
/*
 * Telas de EPI dentro do arquivo principal, de propósito.
 *
 * As outras telas são arquivos à parte, baixados só ao abrir (o sistema
 * abre 3x mais rápido assim). Mas uma tela à parte só funciona sem
 * internet se o aparelho tiver conseguido baixá-la antes — e isso dependia
 * de o sistema ficar aberto um tempo com sinal. Para o trabalho de campo
 * isso não pode depender de nada: o arquivo principal é baixado sempre que
 * o sistema abre (senão nada aparece), então tudo o que está nele funciona
 * offline desde a primeira abertura.
 */
import Dashboard from "@/pages/Dashboard";
import EPIs from "@/pages/EPIs";
import ControleEstoqueContrato from "@/pages/ControleEstoqueContrato";
import SolicitacoesMateriais from "@/pages/epis/SolicitacoesMateriais";
import Funcionarios from "@/pages/Funcionarios";
import Entregas from "@/pages/Entregas";
import Relatorios from "@/pages/Relatorios";
import Auth from "@/pages/Auth";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import AvisoErroGlobal from "@/components/AvisoErroGlobal";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, storagePersister, QUERY_PERSIST_MAX_AGE } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { canAccessModule } from "@/lib/permissions";
import AppLayout from "@/components/AppLayout";
import OfflineBanner from "@/components/OfflineBanner";
import UpdateBanner from "@/components/UpdateBanner";
import InstallBanner from "@/components/InstallBanner";
const DossieColaborador = carregarPagina(() => import("@/pages/DossieColaborador"));
const PainelVencimentos = carregarPagina(() => import("@/pages/PainelVencimentos"));
const DossieColaboradores = carregarPagina(() => import("@/pages/DossieColaboradores"));
const HistoricoVersoes = carregarPagina(() => import("@/pages/HistoricoVersoes"));
const ConfiguracaoTiposDocumento = carregarPagina(() => import("@/pages/ConfiguracaoTiposDocumento"));
const Empresas = carregarPagina(() => import("@/pages/Empresas"));
const UsuariosLiberados = carregarPagina(() => import("@/pages/UsuariosLiberados"));
const VerificarFicha = carregarPagina(() => import("@/pages/VerificarFicha"));
const AdminEmissor = carregarPagina(() => import("@/pages/admin/AdminEmissor"));
const ResetPassword = carregarPagina(() => import("@/pages/ResetPassword"));
const AdminEmpresas = carregarPagina(() => import("@/pages/AdminEmpresas"));
const Install = carregarPagina(() => import("@/pages/Install"));
const Privacidade = carregarPagina(() => import("@/pages/Privacidade"));
const Planos = carregarPagina(() => import("@/pages/Planos"));
const Termos = carregarPagina(() => import("@/pages/Termos"));
const DDS = carregarPagina(() => import("@/pages/DDS"));
const InspecoesModule = carregarPagina(() => import("@/pages/InspecoesModule"));
const InspecoesDashboard = carregarPagina(() => import("@/pages/InspecoesDashboard"));

const CadastroDashboard = carregarPagina(() => import("@/pages/CadastroDashboard"));
const EstruturaGhePage = carregarPagina(() => import("@/pages/cadastro/EstruturaGhePage"));
const LimpezaCadastros = carregarPagina(() => import("@/pages/cadastro/LimpezaCadastros"));
const CentralPPP = carregarPagina(() => import("@/pages/CentralPPP"));
const Backups = carregarPagina(() => import("@/pages/Backups"));
const VideoTreinamentos = carregarPagina(() => import("@/pages/VideoTreinamentos"));
const PortalTreinamentos = carregarPagina(() => import("@/pages/PortalTreinamentos"));
const PortalRH = carregarPagina(() => import("@/pages/rh/PortalRH"));

const Faturas = carregarPagina(() => import("@/pages/Faturas"));
const AsoModule = carregarPagina(() => import("@/pages/aso/AsoModule"));
const VerificarAso = carregarPagina(() => import("@/pages/VerificarAso"));
const AprovacaoPublica = carregarPagina(() => import("@/pages/AprovacaoPublica"));
const PgrModule = carregarPagina(() => import("@/pages/pgr/PgrModule"));
const PgrNovo = carregarPagina(() => import("@/pages/pgr/PgrNovo"));
const PgrWizard = carregarPagina(() => import("@/pages/pgr/PgrWizard"));
const PgrEstruturaTecnica = carregarPagina(() => import("@/pages/pgr/PgrEstruturaTecnica"));
const PgrComparar = carregarPagina(() => import("@/pages/pgr/PgrComparar"));
const LevantamentoCampo = carregarPagina(() => import("@/pages/campo/LevantamentoCampo"));
const PcmsoDashboard = carregarPagina(() => import("@/pages/pcmso/PcmsoDashboard"));
const PcmsoElaboracao = carregarPagina(() => import("@/pages/pcmso/PcmsoElaboracao"));
const PgrValidar = carregarPagina(() => import("@/pages/pgr/PgrValidar"));
const PcmsoValidar = carregarPagina(() => import("@/pages/pcmso/PcmsoValidar"));
const PgrDashboard = carregarPagina(() => import("@/pages/pgr/PgrDashboard"));
const MatrizRiscoAdmin = carregarPagina(() => import("@/pages/cadastro/MatrizRiscoAdmin"));
const LtcatModule = carregarPagina(() => import("@/pages/ltcat/LtcatModule"));
const LtcatNovo = carregarPagina(() => import("@/pages/ltcat/LtcatNovo"));
const LtcatDetalhe = carregarPagina(() => import("@/pages/ltcat/LtcatDetalhe"));
const LtcatValidar = carregarPagina(() => import("@/pages/ltcat/LtcatValidar"));
const LtcatDashboard = carregarPagina(() => import("@/pages/ltcat/LtcatDashboard"));
const PppNovo = carregarPagina(() => import("@/pages/ppp/PppNovo"));
const PppDetalhe = carregarPagina(() => import("@/pages/ppp/PppDetalhe"));
const PppValidar = carregarPagina(() => import("@/pages/ppp/PppValidar"));
const PppDashboard = carregarPagina(() => import("@/pages/ppp/PppDashboard"));
const S2240Mapeamentos = carregarPagina(() => import("@/pages/esocial/S2240Mapeamentos"));
const S2240Dashboard = carregarPagina(() => import("@/pages/esocial/S2240Dashboard"));
const OrdemServico = carregarPagina(() => import("@/pages/programas/OrdemServico"));
const OrdemServicoNovo = carregarPagina(() => import("@/pages/programas/OrdemServicoNovo"));
const OrdemServicoDetalhe = carregarPagina(() => import("@/pages/programas/OrdemServicoDetalhe"));
const GerarDocumentos = carregarPagina(() => import("@/pages/programas/GerarDocumentos"));
const LaudoInsalubridade = carregarPagina(() => import("@/pages/programas/LaudoInsalubridade"));
const LaudoPericulosidade = carregarPagina(() => import("@/pages/programas/LaudoPericulosidade"));

const DocumentacaoSst = carregarPagina(() => import("@/pages/DocumentacaoSst"));
const EstruturaOcupacionalPage = carregarPagina(() => import("@/pages/cadastro/EstruturaOcupacionalPage"));
const ArquivoDigitalModule = carregarPagina(() => import("@/pages/arquivo-digital/ArquivoDigitalModule"));
const SstExpressDashboard = carregarPagina(() => import("@/pages/sst-express/SstExpressDashboard"));
const ExtintoresDashboard = carregarPagina(() => import("@/pages/extintores/ExtintoresDashboard"));
const ExtintorQrView = carregarPagina(() => import("@/pages/extintores/ExtintorQrView"));
const NotFound = carregarPagina(() => import("./pages/NotFound"));
import NetworkErrorBoundary from "@/components/NetworkErrorBoundary";
import AdminLayout from "@/components/AdminLayout";
const AdminDashboard = carregarPagina(() => import("@/pages/admin/AdminDashboard"));
const AdminCloud = carregarPagina(() => import("@/pages/admin/AdminCloud"));
import EmpresaQuerySync from "@/components/EmpresaQuerySync";
const SetupMfa = carregarPagina(() => import("@/pages/SetupMfa"));
import MfaBanner from "@/components/MfaBanner";
import MfaGate from "@/components/MfaGate";
const Fase3PortalRHTest = carregarPagina(() => import("@/pages/homolog/Fase3PortalRHTest"));
const Fase3AllTest = carregarPagina(() => import("@/pages/homolog/Fase3AllTest"));
const AssinaturaRemota = carregarPagina(() => import("@/pages/AssinaturaRemota"));



/** Enquanto o arquivo da página chega: só um indicador, sem tela branca. */
function CarregandoPagina() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Carregando">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function QueryProvider({ children }: { children: ReactNode }) {
  if (!storagePersister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: storagePersister,
        maxAge: QUERY_PERSIST_MAX_AGE,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

function DashboardGuard() {
  const { modulosPermitidos, isSuperAdmin, loading } = useAuth();

  // Wait for permissions to load before deciding
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isSuperAdmin || canAccessModule(modulosPermitidos, "dashboard")) {
    return <Dashboard />;
  }
  // Redirect to first accessible route — Portal RH primeiro para perfis RH-only.
  const fallbacks = [
    { path: "/rh/asos", key: "portal_rh" },
    { path: "/rh/asos", key: "rh" },
    { path: "/aso", key: "aso" },
    { path: "/epis", key: "epis" },
    { path: "/epis/controle-contrato", key: "estoque_contrato" },
    { path: "/entregas", key: "entregas" },
    { path: "/relatorios", key: "relatorios" },
    { path: "/cadastro/empresas", key: "cadastro_empresas" },
    { path: "/cadastro/funcionarios", key: "cadastro_funcionarios" },
    { path: "/cadastro/usuarios", key: "cadastro_usuarios" },
    { path: "/pgr", key: "pgr" },
    { path: "/ltcat", key: "ltcat" },
    { path: "/ppp", key: "ppp" },
    { path: "/inspecoes-se", key: "inspecoes_se" },
    { path: "/extintores", key: "extintores" },
    { path: "/treinamentos", key: "treinamentos" },
    { path: "/dds", key: "dds" },
    { path: "/video-treinamentos", key: "video_treinamentos" },
  ];
  for (const f of fallbacks) {
    if (canAccessModule(modulosPermitidos, f.key)) {
      return <Navigate to={f.path} replace />;
    }
  }
  // Sem nenhuma permissão acessível — bloqueio explícito (mesma mensagem do ProtectedRoute).
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md p-8">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold">Acesso não autorizado</h1>
        <p className="text-muted-foreground text-sm">
          Seu usuário não possui permissões liberadas para acessar nenhum módulo. Contate o administrador.
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading, authorized, signOut, modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold">Acesso Não Autorizado</h1>
          <p className="text-muted-foreground text-sm">
            Seu e-mail (<strong>{user.email}</strong>) não está na lista de usuários liberados.
            Entre em contato com o administrador do sistema.
          </p>
          <button
            onClick={signOut}
            className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  // Usuário ativo mas sem nenhuma permissão efetiva → tela de bloqueio explícita.
  // Critério: não é Super Admin, não é Principal e modulos_permitidos está vazio.
  const hasNoEffectiveAccess =
    !isSuperAdmin && !isPrincipal && (!modulosPermitidos || modulosPermitidos.length === 0);

  if (hasNoEffectiveAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold">Acesso não autorizado</h1>
          <p className="text-muted-foreground text-sm">
            Seu usuário (<strong>{user.email}</strong>) não possui permissões liberadas para acessar o sistema.
            Contate o administrador.
          </p>
          <button
            onClick={signOut}
            className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  // If user only has video_treinamentos permission, show portal
  const isVideoOnly = !isSuperAdmin && !isPrincipal && modulosPermitidos.length > 0 &&
    modulosPermitidos.every(p => p.startsWith("video_treinamentos"));

  if (isVideoOnly) {
    return (
      <Routes>
        <Route path="/*" element={<PortalTreinamentos />} />
      </Routes>
    );
  }

  // RH-only profile: render the standalone Portal RH (no AppLayout sidebar)
  const isRhOnly = !isSuperAdmin && !isPrincipal && modulosPermitidos.length > 0 &&
    modulosPermitidos.every(p => p === "rh" || p.startsWith("rh:"));

  if (isRhOnly) {
    return (
      <Routes>
        <Route path="/rh/asos" element={<PortalRH />} />
        <Route path="/*" element={<Navigate to="/rh/asos" replace />} />
      </Routes>
    );
  }


  return (
    <AppLayout>
      <EmpresaQuerySync />
      <MfaBanner />
      <MfaGate>
      <Suspense fallback={<CarregandoPagina />}>
      <Routes>
        <Route path="/" element={<NetworkErrorBoundary><DashboardGuard /></NetworkErrorBoundary>} />
        <Route path="/sst-express" element={<NetworkErrorBoundary><SstExpressDashboard /></NetworkErrorBoundary>} />
        <Route path="/documentacao-sst" element={<NetworkErrorBoundary><DocumentacaoSst /></NetworkErrorBoundary>} />
        <Route path="/epis" element={<NetworkErrorBoundary><EPIs /></NetworkErrorBoundary>} />
        <Route path="/epis/controle-contrato" element={<NetworkErrorBoundary><ControleEstoqueContrato /></NetworkErrorBoundary>} />
        <Route path="/epis/solicitacoes-materiais" element={<NetworkErrorBoundary><SolicitacoesMateriais /></NetworkErrorBoundary>} />
        <Route path="/entregas" element={<NetworkErrorBoundary><Entregas /></NetworkErrorBoundary>} />
        <Route path="/relatorios" element={<NetworkErrorBoundary><Relatorios /></NetworkErrorBoundary>} />
        <Route path="/cadastro" element={<NetworkErrorBoundary><CadastroDashboard /></NetworkErrorBoundary>} />
        <Route path="/cadastro/empresas" element={<NetworkErrorBoundary><Empresas /></NetworkErrorBoundary>} />
        <Route path="/cadastro/filiais" element={<Navigate to="/cadastro/empresas" replace />} />
        <Route path="/cadastro/funcionarios" element={<NetworkErrorBoundary><Funcionarios /></NetworkErrorBoundary>} />
        {/* O dossiê morava sob /cadastro/funcionarios; agora tem casa própria
            no Arquivo Digital. A rota antiga segue redirecionando para não
            quebrar link que alguém já tenha salvo. */}
        <Route path="/cadastro/funcionarios/:id/dossie" element={<Navigate to="/arquivo-digital/dossies" replace />} />
        
        <Route path="/arquivo-digital" element={<ArquivoDigitalModule />}>
          <Route path="dossies" element={<NetworkErrorBoundary><DossieColaboradores /></NetworkErrorBoundary>} />
          <Route path="vencimentos" element={<NetworkErrorBoundary><PainelVencimentos /></NetworkErrorBoundary>} />
          <Route path="historico" element={<NetworkErrorBoundary><HistoricoVersoes /></NetworkErrorBoundary>} />
          <Route path="configuracao" element={<NetworkErrorBoundary><ConfiguracaoTiposDocumento /></NetworkErrorBoundary>} />

          <Route index element={<Navigate to="dossies" replace />} />
        </Route>
        
        {/* Standalone detail page without tabs */}
        <Route path="/arquivo-digital/dossie/:id" element={<NetworkErrorBoundary><DossieColaborador /></NetworkErrorBoundary>} />
        
        <Route path="/cadastro/estrutura" element={<NetworkErrorBoundary><EstruturaOcupacionalPage /></NetworkErrorBoundary>} />
        <Route path="/cadastro/estrutura-ocupacional" element={<Navigate to="/cadastro/estrutura" replace />} />
        <Route path="/estrutura-ocupacional" element={<Navigate to="/cadastro/estrutura" replace />} />
        
        {/* A tela de GES era duplicada: /cadastro/ghe montava o mesmo
            componente da aba GES em Documentação. Redireciona para o Cadastro Mestre. */}
        <Route path="/cadastro/ghe" element={<Navigate to="/cadastro/estrutura?aba=ges" replace />} />
        <Route path="/cadastro/ghe/:id/estrutura" element={<EstruturaGhePage />} />
        <Route path="/cadastro/limpeza" element={<NetworkErrorBoundary><LimpezaCadastros /></NetworkErrorBoundary>} />
        <Route path="/cadastro/usuarios" element={<UsuariosLiberados />} />
        <Route path="/dds" element={<DDS />} />
        <Route path="/inspecoes-se" element={<InspecoesModule />} />
        <Route path="/inspecoes-se/dashboard" element={<InspecoesDashboard />} />
        {/* Rota antiga do cadastro de locais: abre a aba, para link e favorito continuarem valendo. */}
        <Route path="/inspecoes-se/obras" element={<InspecoesModule abaInicial="locais" />} />
        <Route path="/extintores" element={<ExtintoresDashboard />} />
        <Route path="/treinamentos" element={<Navigate to="/arquivo-digital" replace />} />
        <Route path="/exames" element={<Navigate to="/aso" replace />} />
        <Route path="/aso" element={<AsoModule />} />
        <Route path="/rh/asos" element={<PortalRH />} />
        <Route path="/pgr" element={<PgrModule />} />
        <Route path="/pgr/dashboard" element={<PgrDashboard />} />
        
        {/* --- PCMSO Documentos --- */}
        <Route path="/pcmso/dashboard" element={<PcmsoDashboard />} />
        <Route path="/pcmso/elaborar/:id" element={<PcmsoElaboracao />} />
        <Route path="/pgr/matriz" element={<MatrizRiscoAdmin />} />
        <Route path="/pgr/novo" element={<PgrNovo />} />
        {/* Três modos de uso do mesmo PGR: assistente guiado (padrão),
            estrutura técnica em árvore e coleta de campo pelo celular. */}
        <Route path="/pgr/:id" element={<PgrWizard />} />
        <Route path="/pgr/:id/estrutura" element={<PgrEstruturaTecnica />} />
        <Route path="/pgr/:id/comparar" element={<PgrComparar />} />
        <Route path="/campo" element={<LevantamentoCampo />} />
        <Route path="/pgr/:id/editar" element={<PgrNovo />} />
        <Route path="/ltcat" element={<LtcatModule />} />
        <Route path="/ltcat/dashboard" element={<LtcatDashboard />} />
        <Route path="/ltcat/novo" element={<LtcatNovo />} />
        <Route path="/ltcat/:id" element={<LtcatDetalhe />} />
        <Route path="/ltcat/:id/editar" element={<LtcatNovo />} />
        <Route path="/ltcat/validar/:id" element={<LtcatValidar />} />

        {/* Módulo Programas — landing consolidada na Central de Documentação SST */}
        <Route path="/programas" element={<Navigate to="/documentacao-sst?aba=elaborar" replace />} />
        <Route path="/programas/gerar" element={<GerarDocumentos />} />
        <Route path="/programas/pgr" element={<Navigate to="/pgr" replace />} />
        <Route path="/programas/pcmso" element={<Navigate to="/pcmso/dashboard" replace />} />
        <Route path="/programas/ltcat" element={<Navigate to="/ltcat" replace />} />
        <Route path="/programas/ppp" element={<Navigate to="/central-ppp" replace />} />
        <Route path="/programas/ordem-servico" element={<OrdemServico />} />
        <Route path="/programas/ordem-servico/novo" element={<OrdemServicoNovo />} />
        <Route path="/programas/ordem-servico/:id" element={<OrdemServicoDetalhe />} />
        <Route path="/programas/ordem-servico/:id/editar" element={<OrdemServicoNovo />} />
        <Route path="/programas/laudo-insalubridade" element={<LaudoInsalubridade />} />
        <Route path="/programas/laudo-periculosidade" element={<LaudoPericulosidade />} />


        <Route path="/ppp" element={<Navigate to="/central-ppp" replace />} />
        <Route path="/ppp/dashboard" element={<PppDashboard />} />
        <Route path="/ppp/novo" element={<PppNovo />} />
        <Route path="/ppp/:id" element={<PppDetalhe />} />
        <Route path="/ppp/:id/editar" element={<PppNovo />} />
        <Route path="/ppp/validar/:id" element={<PppValidar />} />

        <Route path="/esocial/s2240/mapeamentos" element={<S2240Mapeamentos />} />
        <Route path="/esocial/s2240/dashboard" element={<S2240Dashboard />} />

        <Route path="/central-ppp" element={<CentralPPP />} />
        <Route path="/video-treinamentos" element={<VideoTreinamentos />} />
        {/* P0 #3 — /admin/empresas só existe em AdminLayout (guard Super Admin).
            A rota top-level abaixo (linha ~275) intercepta primeiro; nada aqui. */}
        <Route path="/faturas" element={<Faturas />} />
        <Route path="/backups" element={isSuperAdmin ? <Backups /> : <Navigate to="/" replace />} />
        <Route path="/configuracoes" element={<Navigate to="/cadastro/empresas" replace />} />
        <Route path="/funcionarios" element={<Navigate to="/cadastro/funcionarios" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </MfaGate>
    </AppLayout>
  );
}

function AuthPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get("redirect");
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";

  if (!loading && user) return <Navigate to={safeRedirect} replace />;
  return <Auth />;
}

// P0 #4 — /setup-mfa exige usuário autenticado. Deslogado vai para /login.
function SetupMfaGuarded() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <SetupMfa />;
}

const App = () => (
  <QueryProvider>
    <TooltipProvider>
      <AvisoErroGlobal />
      <OfflineBanner />
      <UpdateBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<CarregandoPagina />}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/install" element={<Install />} />
            {/* Página pública de vendas: sem login, sem menu, sem empresa
                ativa — quem chega aqui ainda não é cliente. Os valores moram
                em src/lib/planosDeVenda.ts. */}
            <Route path="/planos" element={<Planos />} />
            <Route path="/vendas" element={<Navigate to="/planos" replace />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verificar-aso/:hash" element={<VerificarAso />} />
            {/* Conferência da Ficha de EPI pelo código impresso: pública de
                propósito, porque quem consulta é o fiscal com o papel na mão. */}
            {/* Conferência do PGR pelo QR Code do rodapé: pública, porque
                quem lê o QR é o fiscal com o papel na mão — e estava atrás do
                login, o que tornava o QR impresso inútil. Mostra só a
                identificação do documento; o conteúdo do PGR continua restrito. */}
            <Route path="/pgr/validar/:id" element={<PgrValidar />} />
            {/* Mesma coisa para o PCMSO: o QR era impresso e a rota nem existia. */}
            <Route path="/pcmso/validar/:id" element={<PcmsoValidar />} />
            <Route path="/verificar" element={<VerificarFicha />} />
            <Route path="/verificar/:codigo" element={<VerificarFicha />} />
            {/* Selo Digital e Ficha de Inspeção do Extintor (NR-23 / NBR 12962):
                Pública para fiscalização do Corpo de Bombeiros / MTE / Brigada
                ler o histórico de inspeções pelo QR Code sem necessidade de login. */}
            <Route path="/extintores/qr/:qrToken" element={<ExtintorQrView />} />
            <Route path="/aprovacao-publica" element={<AprovacaoPublica />} />
            <Route path="/assinar/:id" element={<AssinaturaRemota />} />
            <Route path="/setup-mfa" element={<SetupMfaGuarded />} />
            <Route path="/homolog/fase3-portal-rh-test" element={<Fase3PortalRHTest />} />
            <Route path="/homolog/fase3-all" element={<Fase3AllTest />} />

            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/empresas" element={<AdminLayout><AdminEmpresas /></AdminLayout>} />
            <Route path="/admin/usuarios" element={<AdminLayout><UsuariosLiberados /></AdminLayout>} />
            <Route path="/admin/faturas" element={<AdminLayout><Faturas /></AdminLayout>} />
            <Route path="/admin/backups" element={<AdminLayout><Backups /></AdminLayout>} />
            <Route path="/admin/emissor" element={<AdminLayout><AdminEmissor /></AdminLayout>} />
            <Route path="/admin/cloud" element={<AdminLayout><AdminCloud /></AdminLayout>} />
            <Route path="/*" element={<ProtectedRoute />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryProvider>
);

export default App;
