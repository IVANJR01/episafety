import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EPIs from "@/pages/EPIs";
import Funcionarios from "@/pages/Funcionarios";
import Entregas from "@/pages/Entregas";
import Relatorios from "@/pages/Relatorios";
import Empresas from "@/pages/Empresas";
import UsuariosLiberados from "@/pages/UsuariosLiberados";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, authorized, signOut } = useAuth();

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

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/epis" element={<EPIs />} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/cadastro/empresas" element={<Empresas />} />
        <Route path="/cadastro/funcionarios" element={<Funcionarios />} />
        <Route path="/cadastro/usuarios" element={<UsuariosLiberados />} />
        {/* Redirect old routes */}
        <Route path="/configuracoes" element={<Navigate to="/cadastro/empresas" replace />} />
        <Route path="/funcionarios" element={<Navigate to="/cadastro/funcionarios" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
