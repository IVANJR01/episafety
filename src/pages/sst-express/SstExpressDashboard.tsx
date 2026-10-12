import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SstInventario from "./SstInventario";
import SstPlanoAcao from "./SstPlanoAcao";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function SstExpressDashboard() {
  const [tab, setTab] = useState<"inventario" | "plano">("inventario");
  const { empresaAtivaId } = useAuth();

  if (!empresaAtivaId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Por favor, selecione uma empresa no menu lateral para acessar o Gerador Express.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Documentos Express</h1>
          <p className="text-muted-foreground mt-1">Preencha o inventário simplificado e gere os documentos SST.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Importar Planilha
          </Button>
          <Button className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
            <FileText className="w-4 h-4" /> Gerar PGR (Word)
          </Button>
        </div>
      </div>
      
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab("inventario")}
          className={`px-4 py-2 border-b-2 font-medium transition-colors ${
            tab === "inventario" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Inventário de Riscos
        </button>
        <button
          onClick={() => setTab("plano")}
          className={`px-4 py-2 border-b-2 font-medium transition-colors ${
            tab === "plano" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Plano de Ação (5W2H)
        </button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm p-4 overflow-hidden">
        {tab === "inventario" && <SstInventario />}
        {tab === "plano" && <SstPlanoAcao />}
      </div>
    </div>
  );
}
