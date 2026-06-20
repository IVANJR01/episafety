import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileWarning, Settings, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import CatDashboard from "./CatDashboard";
import CatList from "./CatList";
import CatConfiguracoes from "./CatConfiguracoes";

export default function CatModule() {
  const [tab, setTab] = useState("dashboard");
  const navigate = useNavigate();
  const { canCreate } = usePermissions("cat");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileWarning className="h-7 w-7 text-primary" />
            CAT — Comunicação de Acidente de Trabalho
          </h1>
          <p className="text-sm text-muted-foreground">
            Registro, controle e preparação para envio ao eSocial (S-2210)
          </p>
        </div>
        {tab === "lista" && canCreate && (
          <Button onClick={() => navigate("/cat/novo")}>
            <Plus className="h-4 w-4 mr-2" />
            Nova CAT
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-1">
            <FileWarning className="h-4 w-4" />
            Lista de CATs
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1">
            <Settings className="h-4 w-4" />
            Catálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <CatDashboard />
        </TabsContent>
        <TabsContent value="lista" className="mt-4">
          <CatList />
        </TabsContent>
        <TabsContent value="configuracoes" className="mt-4">
          <CatConfiguracoes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
