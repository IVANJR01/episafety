import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Users, Stethoscope, Plus, ListChecks, Briefcase, Upload, Layers, BarChart3, Shield, MapPin, ClipboardList, Settings } from "lucide-react";
import AsoDashboard from "./AsoDashboard";
import AsoList from "./AsoList";
import AsoMedicos from "./AsoMedicos";
import AsoNovo from "./AsoNovo";
import AsoCatalogo from "./AsoCatalogo";
import AsoFuncoes from "./AsoFuncoes";
import AsoImport from "./AsoImport";
import AsoLote from "./AsoLote";
import AsoRelatorios from "./AsoRelatorios";
import PcmsoGhe from "./PcmsoGhe";
import AsoLocaisEmissao from "./AsoLocaisEmissao";
import AsoExames from "./AsoExames";
import AsoDiagnostico from "@/components/aso/AsoDiagnostico";

export default function AsoModule() {
  const [tab, setTab] = useState("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const openNovo = (id?: string) => {
    setEditingId(id ?? null);
    setTab("novo");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Exames
          </h1>
          <p className="text-sm text-muted-foreground">Controle de exames ocupacionais, ASOs, vencimentos e renovações.</p>

        </div>
      </div>

      <Tabs value={tab === "novo" ? "asos" : tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="asos" className="gap-1"><FileText className="h-4 w-4" />ASOs</TabsTrigger>
          <TabsTrigger value="exames" className="gap-1"><Stethoscope className="h-4 w-4" />Exames</TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1"><Settings className="h-4 w-4" />Config. Exames</TabsTrigger>
          <TabsTrigger value="pcmso" className="gap-1"><Shield className="h-4 w-4" />PCMSO / GHE</TabsTrigger>
          <TabsTrigger value="medicos" className="gap-1"><Users className="h-4 w-4" />Médicos</TabsTrigger>
          <TabsTrigger value="locais" className="gap-1"><MapPin className="h-4 w-4" />Locais</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1"><BarChart3 className="h-4 w-4" />Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><AsoDashboard /></TabsContent>
        <TabsContent value="asos" className="mt-4">
          {tab === "novo" ? (
            <AsoNovo editingId={editingId} onSaved={() => setTab("asos")} />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => openNovo()}><Plus className="h-4 w-4 mr-2" />Novo ASO</Button>
              </div>
              <AsoList onEdit={openNovo} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="exames" className="mt-4"><AsoExames /></TabsContent>
        <TabsContent value="catalogo" className="mt-4"><AsoCatalogo /></TabsContent>
        <TabsContent value="pcmso" className="mt-4"><PcmsoGhe /></TabsContent>
        <TabsContent value="medicos" className="mt-4"><AsoMedicos /></TabsContent>
        <TabsContent value="locais" className="mt-4"><AsoLocaisEmissao /></TabsContent>
        <TabsContent value="relatorios" className="mt-4"><AsoRelatorios /></TabsContent>
      </Tabs>
    </div>
  );
}