import type { ReactNode } from "react";
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
import Dashboard from "@/pages/Dashboard";
import EPIs from "@/pages/EPIs";
import ControleEstoqueContrato from "@/pages/ControleEstoqueContrato";
import SolicitacoesMateriais from "@/pages/epis/SolicitacoesMateriais";
import Funcionarios from "@/pages/Funcionarios";
import DossieColaborador from "@/pages/DossieColaborador";
import PainelVencimentos from "@/pages/PainelVencimentos";
import DossieColaboradores from "@/pages/DossieColaboradores";
import HistoricoVersoes from "@/pages/HistoricoVersoes";
import ConfiguracaoTiposDocumento from "@/pages/ConfiguracaoTiposDocumento";
import Entregas from "@/pages/Entregas";
import Relatorios from "@/pages/Relatorios";
import Empresas from "@/pages/Empresas";
import UsuariosLiberados from "@/pages/UsuariosLiberados";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import AdminEmpresas from "@/pages/AdminEmpresas";
import Install from "@/pages/Install";
import Privacidade from "@/pages/Privacidade";
import Termos from "@/pages/Termos";
import DDS from "@/pages/DDS";
import InspecoesSE from "@/pages/InspecoesSE";
import InspecoesDashboard from "@/pages/InspecoesDashboard";
import Obras from "@/pages/Obras";
import Treinamentos from "@/pages/Treinamentos";

import CadastroDashboard from "@/pages/CadastroDashboard";
import EstruturaGhePage from "@/pages/cadastro/EstruturaGhePage";
import CentralPPP from "@/pages/CentralPPP";
import Backups from "@/pages/Backups";
import VideoTreinamentos from "@/pages/VideoTreinamentos";
import PortalTreinamentos from "@/pages/PortalTreinamentos";
import PortalRH from "@/pages/rh/PortalRH";
import ComercialDashboard from "@/pages/comercial/ComercialDashboard";
import Orcamentos from "@/pages/comercial/Orcamentos";
import OrcamentoEditor from "@/pages/comercial/OrcamentoEditor";
import Clientes from "@/pages/comercial/Clientes";
import Catalogo from "@/pages/comercial/Catalogo";

import Faturas from "@/pages/Faturas";
import AsoModule from "@/pages/aso/AsoModule";
import VerificarAso from "@/pages/VerificarAso";
import AprovacaoPublica from "@/pages/AprovacaoPublica";
import CatModule from "@/pages/cat/CatModule";
import CatNovo from "@/pages/cat/CatNovo";
import CatDetalhe from "@/pages/cat/CatDetalhe";
import CatValidar from "@/pages/cat/CatValidar";
import EsocialConfig from "@/pages/cat/EsocialConfig";
import PgrModule from "@/pages/pgr/PgrModule";
import PgrNovo from "@/pages/pgr/PgrNovo";
import PgrDetalhe from "@/pages/pgr/PgrDetalhe";
import PgrWizard from "@/pages/pgr/PgrWizard";
import PgrEstruturaTecnica from "@/pages/pgr/PgrEstruturaTecnica";
import PgrComparar from "@/pages/pgr/PgrComparar";
import LevantamentoCampo from "@/pages/campo/LevantamentoCampo";
import PcmsoDashboard from "@/pages/pcmso/PcmsoDashboard";
import PcmsoElaboracao from "@/pages/pcmso/PcmsoElaboracao";
import PgrValidar from "@/pages/pgr/PgrValidar";
import PgrDashboard from "@/pages/pgr/PgrDashboard";
import MatrizRiscoAdmin from "@/pages/cadastro/MatrizRiscoAdmin";
import LtcatModule from "@/pages/ltcat/LtcatModule";
import LtcatNovo from "@/pages/ltcat/LtcatNovo";
import LtcatDetalhe from "@/pages/ltcat/LtcatDetalhe";
import LtcatValidar from "@/pages/ltcat/LtcatValidar";
import LtcatDashboard from "@/pages/ltcat/LtcatDashboard";
import PppModule from "@/pages/ppp/PppModule";
import PppNovo from "@/pages/ppp/PppNovo";
import PppDetalhe from "@/pages/ppp/PppDetalhe";
import PppValidar from "@/pages/ppp/PppValidar";
import PppDashboard from "@/pages/ppp/PppDashboard";
import S2240Mapeamentos from "@/pages/esocial/S2240Mapeamentos";
import S2240Dashboard from "@/pages/esocial/S2240Dashboard";
import ProgramasHome from "@/pages/programas/ProgramasHome";
import OrdemServico from "@/pages/programas/OrdemServico";
import OrdemServicoNovo from "@/pages/programas/OrdemServicoNovo";
import OrdemServicoDetalhe from "@/pages/programas/OrdemServicoDetalhe";
import GerarDocumentos from "@/pages/programas/GerarDocumentos";
import LaudoInsalubridade from "@/pages/programas/LaudoInsalubridade";
import LaudoPericulosidade from "@/pages/programas/LaudoPericulosidade";

import DocumentacaoSst from "@/pages/DocumentacaoSst";
import ArquivoDigitalModule from "@/pages/arquivo-digital/ArquivoDigitalModule";
import NotFound from "./pages/NotFound";
import NetworkErrorBoundary from "@/components/NetworkErrorBoundary";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCloud from "@/pages/admin/AdminCloud";
import EmpresaQuerySync from "@/components/EmpresaQuerySync";
import SetupMfa from "@/pages/SetupMfa";
import MfaBanner from "@/components/MfaBanner";
import MfaGate from "@/components/MfaGate";
import Fase3PortalRHTest from "@/pages/homolog/Fase3PortalRHTest";
import Fase3AllTest from "@/pages/homolog/Fase3AllTest";
import AssinaturaRemota from "@/pages/AssinaturaRemota";



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
    { path: "/cat", key: "cat" },
    { path: "/pgr", key: "pgr" },
    { path: "/ltcat", key: "ltcat" },
    { path: "/ppp", key: "ppp" },
    { path: "/inspecoes-se", key: "inspecoes_se" },
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
      <Routes>
        <Route path="/" element={<NetworkErrorBoundary><DashboardGuard /></NetworkErrorBoundary>} />
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
        
        {/* A tela de GES era duplicada: /cadastro/ghe montava o mesmo
            componente da aba GES em Documentação. Vira redirecionamento para
            não quebrar links já existentes (ex.: os do PCMSO). */}
        <Route path="/cadastro/ghe" element={<Navigate to="/documentacao-sst?aba=ges" replace />} />
        <Route path="/cadastro/ghe/:id/estrutura" element={<EstruturaGhePage />} />
        <Route path="/cadastro/usuarios" element={<UsuariosLiberados />} />
        <Route path="/dds" element={<DDS />} />
        <Route path="/inspecoes-se" element={<InspecoesSE />} />
        <Route path="/inspecoes-se/dashboard" element={<InspecoesDashboard />} />
        <Route path="/inspecoes-se/obras" element={<Obras />} />
        <Route path="/treinamentos" element={<Navigate to="/arquivo-digital" replace />} />
        <Route path="/exames" element={<Navigate to="/aso" replace />} />
        <Route path="/aso" element={<AsoModule />} />
        <Route path="/rh/asos" element={<PortalRH />} />
        <Route path="/comercial" element={<ComercialDashboard />} />
        <Route path="/comercial/orcamentos" element={<Orcamentos />} />
        <Route path="/comercial/orcamentos/novo" element={<OrcamentoEditor />} />
        <Route path="/comercial/orcamentos/:id" element={<OrcamentoEditor />} />
        <Route path="/comercial/clientes" element={<Clientes />} />
        <Route path="/comercial/catalogo" element={<Catalogo />} />
        <Route path="/cat" element={<CatModule />} />
        <Route path="/cat/novo" element={<CatNovo />} />
        <Route path="/cat/:id" element={<CatDetalhe />} />
        <Route path="/cat/:id/editar" element={<CatNovo />} />
        <Route path="/cat/validar/:id" element={<CatValidar />} />
        <Route path="/cat/esocial/config" element={<EsocialConfig />} />
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
        <Route path="/pgr/:id/classico" element={<PgrDetalhe />} />
        <Route path="/pgr/:id/editar" element={<PgrNovo />} />
        <Route path="/pgr/validar/:id" element={<PgrValidar />} />
        <Route path="/ltcat" element={<LtcatModule />} />
        <Route path="/ltcat/dashboard" element={<LtcatDashboard />} />
        <Route path="/ltcat/novo" element={<LtcatNovo />} />
        <Route path="/ltcat/:id" element={<LtcatDetalhe />} />
        <Route path="/ltcat/:id/editar" element={<LtcatNovo />} />
        <Route path="/ltcat/validar/:id" element={<LtcatValidar />} />

        {/* Módulo Programas — landing + reuso de rotas existentes + stubs */}
        <Route path="/programas" element={<ProgramasHome />} />
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
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verificar-aso/:hash" element={<VerificarAso />} />
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
            <Route path="/admin/cloud" element={<AdminLayout><AdminCloud /></AdminLayout>} />
            <Route path="/*" element={<ProtectedRoute />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryProvider>
);

export default App;
