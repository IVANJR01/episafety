import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EPIs from "@/pages/EPIs";
import Funcionarios from "@/pages/Funcionarios";
import Entregas from "@/pages/Entregas";
import Relatorios from "@/pages/Relatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/epis" element={<EPIs />} />
            <Route path="/funcionarios" element={<Funcionarios />} />
            <Route path="/entregas" element={<Entregas />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
