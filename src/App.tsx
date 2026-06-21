import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, storagePersister, QUERY_PERSIST_MAX_AGE } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { canAccessModule } from "@/lib/permissions";
import AppLayout from "@/components/AppLayout";
import OfflineBanner from "@/components/OfflineBanner";
import UpdateBanner from "@/components/UpdateBanner";
import InstallBanner from "@/components/InstallBanner";
import Dashboard from "@/pages/Dashboard";
import EPIs from "@/pages/EPIs";
import ControleEstoqueContrato from "@/pages/ControleEstoqueContrato";
import Funcionarios from "@/pages/Funcionarios";
import Entregas from "@/pages/Entregas";
import Relatorios from "@/pages/Relatorios";
import Empresas from "@/pages/Empresas";
import UsuariosLiberados from "@/pages/UsuariosLiberados";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import AdminEmpresas from "@/pages/AdminEmpresas";
import Install from "@/pages/Install";
import Privacidade from "@/pages/Privacidade";
import DDS from "@/pages/DDS";
import InspecoesSE from "@/pages/InspecoesSE";
import InspecoesDashboard from "@/pages/InspecoesDashboard";
import Treinamentos from "@/pages/Treinamentos";

import CadastroDashboard from "@/pages/CadastroDashboard";
import PcmsoGhe from "@/pages/aso/PcmsoGhe";
import CadastroGhe from "@/pages/cadastro/CadastroGhe";
import CentralPPP from "@/pages/CentralPPP";
import Backups from "@/pages/Backups";
import VideoTreinamentos from "@/pages/VideoTreinamentos";
import PortalTreinamentos from "@/pages/PortalTreinamentos";
import PortalRH from "@/pages/rh/PortalRH";

import Faturas from "@/pages/Faturas";
import AsoModule from "@/pages/aso/AsoModule";
import VerificarAso from "@/pages/VerificarAso";
import CatModule from "@/pages/cat/CatModule";
import CatNovo from "@/pages/cat/CatNovo";
import CatDetalhe from "@/pages/cat/CatDetalhe";
import CatValidar from "@/pages/cat/CatValidar";
import EsocialConfig from "@/pages/cat/EsocialConfig";
import PgrModule from "@/pages/pgr/PgrModule";
import PgrNovo from "@/pages/pgr/PgrNovo";
import PgrDetalhe from "@/pages/pgr/PgrDetalhe";
import PgrValidar from "@/pages/pgr/PgrValidar";
import PgrDashboard from "@/pages/pgr/PgrDashboard";
import LtcatModule from "@/pages/ltcat/LtcatModule";
import LtcatNovo from "@/pages/ltcat/LtcatNovo";
import LtcatDetalhe from "@/pages/ltcat/LtcatDetalhe";
import LtcatValidar from "@/pages/ltcat/LtcatValidar";
import LtcatDashboard from "@/pages/ltcat/LtcatDashboard";

import NotFound from "./pages/NotFound";
import NetworkErrorBoundary from "@/components/NetworkErrorBoundary";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCloud from "@/pages/admin/AdminCloud";
import EmpresaQuerySync from "@/components/EmpresaQuerySync";
import SetupMfa from "@/pages/SetupMfa";
import MfaBanner from "@/components/MfaBanner";
import MfaGate from "@/components/MfaGate";


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
  // Redirect to first accessible route
  const fallbacks = ["/epis", "/entregas", "/relatorios", "/cadastro/empresas", "/cadastro/funcionarios", "/cadastro/usuarios"];
  const moduleKeys = ["epis", "entregas", "relatorios", "cadastro_empresas", "cadastro_funcionarios", "cadastro_usuarios"];
  for (let i = 0; i < fallbacks.length; i++) {
    if (canAccessModule(modulosPermitidos, moduleKeys[i])) {
      return <Navigate to={fallbacks[i]} replace />;
    }
  }
  return <Dashboard />;
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
        <Route path="/epis" element={<EPIs />} />
        <Route path="/epis/controle-contrato" element={<NetworkErrorBoundary><ControleEstoqueContrato /></NetworkErrorBoundary>} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/cadastro" element={<CadastroDashboard />} />
        <Route path="/cadastro/empresas" element={<Empresas />} />
        <Route path="/cadastro/filiais" element={<Navigate to="/cadastro/empresas" replace />} />
        <Route path="/cadastro/funcionarios" element={<Funcionarios />} />
        <Route path="/cadastro/ghe" element={<CadastroGhe />} />
        <Route path="/cadastro/usuarios" element={<UsuariosLiberados />} />
        <Route path="/dds" element={<DDS />} />
        <Route path="/inspecoes-se" element={<InspecoesSE />} />
        <Route path="/inspecoes-se/dashboard" element={<InspecoesDashboard />} />
        <Route path="/treinamentos" element={<Treinamentos />} />
        <Route path="/exames" element={<Navigate to="/aso" replace />} />
        <Route path="/aso" element={<AsoModule />} />
        <Route path="/rh/asos" element={<PortalRH />} />
        <Route path="/cat" element={<CatModule />} />
        <Route path="/cat/novo" element={<CatNovo />} />
        <Route path="/cat/:id" element={<CatDetalhe />} />
        <Route path="/cat/:id/editar" element={<CatNovo />} />
        <Route path="/cat/validar/:id" element={<CatValidar />} />
        <Route path="/cat/esocial/config" element={<EsocialConfig />} />
        <Route path="/pgr" element={<PgrModule />} />
        <Route path="/pgr/dashboard" element={<PgrDashboard />} />
        <Route path="/pgr/novo" element={<PgrNovo />} />
        <Route path="/pgr/:id" element={<PgrDetalhe />} />
        <Route path="/pgr/:id/editar" element={<PgrNovo />} />
        <Route path="/pgr/validar/:id" element={<PgrValidar />} />
        <Route path="/ltcat" element={<LtcatModule />} />
        <Route path="/ltcat/novo" element={<LtcatNovo />} />
        <Route path="/ltcat/:id" element={<LtcatDetalhe />} />
        <Route path="/ltcat/:id/editar" element={<LtcatNovo />} />
        <Route path="/ltcat/validar/:id" element={<LtcatValidar />} />

        <Route path="/central-ppp" element={<CentralPPP />} />
        <Route path="/video-treinamentos" element={<VideoTreinamentos />} />
        <Route path="/admin/empresas" element={<AdminEmpresas />} />
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
  if (!loading && user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryProvider>
    <TooltipProvider>
      <OfflineBanner />
      <UpdateBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verificar-aso/:hash" element={<VerificarAso />} />
            <Route path="/setup-mfa" element={<SetupMfa />} />
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
