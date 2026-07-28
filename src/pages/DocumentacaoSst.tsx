import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { CentralDocumentacaoTab } from "@/components/documentacao/CentralDocumentacaoTab";
import { ListaDocumentos } from "@/components/documentacao/ListaDocumentos";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import { GesExposicoesTab } from "@/components/documentacao/GesExposicoesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Building2,
  Layers,
} from "lucide-react";


export default function DocumentacaoSst() {
  const [activeTab, setActiveTab] = useState("central");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* HEADER GERAL */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Documentação
            </h1>
            <p className="text-sm text-slate-500">
              Documentos legais de segurança e saúde no trabalho da empresa.
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO DOS SUBMÓDULOS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="pb-2">
            <TabsList className="grid grid-cols-3 w-full sm:inline-flex sm:w-auto bg-slate-100 p-1.5 rounded-xl gap-1 h-auto">
              <TabsTrigger value="central" className="text-sm font-medium px-4 py-2.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" /> Documentos
              </TabsTrigger>
              <TabsTrigger value="estrutura" className="text-sm font-medium px-4 py-2.5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" /> Estrutura
              </TabsTrigger>
              <TabsTrigger value="ges" className="text-sm font-medium px-4 py-2.5 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" /> GES
              </TabsTrigger>
            </TabsList>
          </div>

          {/* SUBMÓDULO 1: DOCUMENTOS — a lista dos documentos existentes vem
              primeiro; os tipos disponíveis ficam abaixo, como ponto de partida
              para quem ainda não criou nenhum. */}
          <TabsContent value="central" className="mt-4 space-y-8">
            <ListaDocumentos />
            <div className="border-t pt-6">
              <CentralDocumentacaoTab onNavigateSubmodulo={setActiveTab} />
            </div>
          </TabsContent>

          {/* SUBMÓDULO 2: ESTRUTURA OCUPACIONAL */}
          <TabsContent value="estrutura" className="mt-4">
            <EstruturaOcupacionalTab />
          </TabsContent>

          {/* SUBMÓDULO 3: GES & EXPOSIÇÕES */}
          <TabsContent value="ges" className="mt-4">
            <GesExposicoesTab />
          </TabsContent>

          {/* SUBMÓDULOS DE DOCUMENTOS ESPECÍFICOS INTEGRADOS */}
        </Tabs>
      </div>
  );
}
