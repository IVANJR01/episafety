import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, Users, Stethoscope, Plus, ListChecks, Briefcase, Upload, Layers, BarChart3 } from "lucide-react";
import AsoDashboard from "./AsoDashboard";
import AsoList from "./AsoList";
import AsoMedicos from "./AsoMedicos";
import AsoNovo from "./AsoNovo";
import AsoCatalogo from "./AsoCatalogo";
import AsoFuncoes from "./AsoFuncoes";
import AsoImport from "./AsoImport";
import AsoLote from "./AsoLote";
import AsoRelatorios from "./AsoRelatorios";

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
            Gestão e Emissão de ASO
          </h1>
          <p className="text-sm text-muted-foreground">Atestado de Saúde Ocupacional — multiempresa</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="lista" className="gap-1"><ListChecks className="h-4 w-4" />ASOs</TabsTrigger>
          <TabsTrigger value="novo" className="gap-1"><Plus className="h-4 w-4" />Novo ASO</TabsTrigger>
          <TabsTrigger value="lote" className="gap-1"><Layers className="h-4 w-4" />Em lote</TabsTrigger>
          <TabsTrigger value="import" className="gap-1"><Upload className="h-4 w-4" />Importar</TabsTrigger>
          <TabsTrigger value="funcoes" className="gap-1"><Briefcase className="h-4 w-4" />Funções/Riscos</TabsTrigger>
          <TabsTrigger value="medicos" className="gap-1"><Stethoscope className="h-4 w-4" />Médicos</TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1"><Users className="h-4 w-4" />Exames</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1"><BarChart3 className="h-4 w-4" />Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><AsoDashboard /></TabsContent>
        <TabsContent value="lista" className="mt-4"><AsoList onEdit={openNovo} /></TabsContent>
        <TabsContent value="novo" className="mt-4"><AsoNovo editingId={editingId} onSaved={() => { setEditingId(null); setTab("lista"); }} /></TabsContent>
        <TabsContent value="lote" className="mt-4"><AsoLote /></TabsContent>
        <TabsContent value="import" className="mt-4"><AsoImport /></TabsContent>
        <TabsContent value="funcoes" className="mt-4"><AsoFuncoes /></TabsContent>
        <TabsContent value="medicos" className="mt-4"><AsoMedicos /></TabsContent>
        <TabsContent value="catalogo" className="mt-4"><AsoCatalogo /></TabsContent>
        <TabsContent value="relatorios" className="mt-4"><AsoRelatorios /></TabsContent>
      </Tabs>
    </div>
  );
}
