import { Link, Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Users, Clock, History, Settings, HardDriveDownload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ArquivoDigitalModule() {
  const location = useLocation();
  
  // Extrai a última parte da URL para definir a aba ativa
  // Ex: /arquivo-digital/vencimentos -> "vencimentos"
  const currentTab = location.pathname.split("/").pop() || "dossies";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dossiê do Colaborador"
        subtitle="Gestão centralizada do dossiê dos colaboradores, vencimentos e histórico de arquivos."
      />

      <Tabs value={currentTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dossies" asChild>
            <Link to="/arquivo-digital/dossies" className="gap-1.5 flex items-center">
              <Users className="w-4 h-4" />
              Dossiês
            </Link>
          </TabsTrigger>
          <TabsTrigger value="vencimentos" asChild>
            <Link to="/arquivo-digital/vencimentos" className="gap-1.5 flex items-center">
              <Clock className="w-4 h-4" />
              Vencimentos
            </Link>
          </TabsTrigger>
          <TabsTrigger value="historico" asChild>
            <Link to="/arquivo-digital/historico" className="gap-1.5 flex items-center">
              <History className="w-4 h-4" />
              Histórico
            </Link>
          </TabsTrigger>
          <TabsTrigger value="configuracao" asChild>
            <Link to="/arquivo-digital/configuracao" className="gap-1.5 flex items-center">
              <Settings className="w-4 h-4" />
              Tipos de Documento
            </Link>
          </TabsTrigger>

        </TabsList>
      </Tabs>

      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
}
