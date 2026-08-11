import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CentralDocumentacaoTab } from "@/components/documentacao/CentralDocumentacaoTab";
import { ListaDocumentos } from "@/components/documentacao/ListaDocumentos";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import { GesExposicoesTab } from "@/components/documentacao/GesExposicoesTab";
import PainelVencimentos from "@/pages/PainelVencimentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, CheckCircle2, Clock, Factory, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DocumentacaoSst() {
  const [searchParams] = useSearchParams();
  const abaUrl = searchParams.get("aba");
  
  // As 4 abas maestras exigidas
  const [activeTab, setActiveTab] = useState(
    ["basetecnica", "elaborar", "emitidos", "vencimentos"].includes(abaUrl || "") ? abaUrl! : "basetecnica",
  );

  // Sub-abas dentro da Base Técnica para organizar o espaço sem sobrecarregar a tela
  const [subAbaBase, setSubAbaBase] = useState("estrutura");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            Central de Documentação e Base Técnica
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os dados da estrutura ocupacional uma única vez e elabore dezenas de documentos legais.
          </p>
        </div>
      </div>

      {/* NAVEGAÇÃO PRINCIPAL (HUB eSST) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="pb-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full bg-slate-100/80 p-1.5 rounded-xl gap-1.5 h-auto">
            <TabsTrigger value="basetecnica" className="text-sm font-semibold px-4 py-3 flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-white">
              <Database className="w-4 h-4 text-indigo-600" /> Base Técnica
            </TabsTrigger>
            <TabsTrigger value="elaborar" className="text-sm font-semibold px-4 py-3 flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-white">
              <FileText className="w-4 h-4 text-emerald-600" /> Elaborar Documentos
            </TabsTrigger>
            <TabsTrigger value="emitidos" className="text-sm font-semibold px-4 py-3 flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-white">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Documentos Emitidos
            </TabsTrigger>
            <TabsTrigger value="vencimentos" className="text-sm font-semibold px-4 py-3 flex items-center gap-2 data-[state=active]:shadow-sm data-[state=active]:bg-white">
              <Clock className="w-4 h-4 text-amber-600" /> Vencimentos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA 1: BASE TÉCNICA (O motor de dados) */}
        <TabsContent value="basetecnica" className="mt-2 space-y-4">
          <Card className="border-indigo-100 shadow-sm bg-indigo-50/30">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-slate-800 text-base">Repositório Técnico</h3>
                <p className="text-sm text-slate-600">
                  Todo o mapeamento da empresa é feito aqui. Nenhuma informação de risco ou setor será redigitada nos documentos.
                </p>
              </div>
              <div className="flex bg-white rounded-lg p-1 border shadow-sm shrink-0">
                <Button 
                  variant={subAbaBase === "estrutura" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setSubAbaBase("estrutura")}
                  className={subAbaBase === "estrutura" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                >
                  <Factory className="w-4 h-4 mr-2" /> Estrutura Ocupacional
                </Button>
                <Button 
                  variant={subAbaBase === "riscos" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setSubAbaBase("riscos")}
                  className={subAbaBase === "riscos" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                >
                  <Users className="w-4 h-4 mr-2" /> Exposições e Riscos
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="pt-2">
            {subAbaBase === "estrutura" && <EstruturaOcupacionalTab />}
            {subAbaBase === "riscos" && <GesExposicoesTab />}
          </div>
        </TabsContent>

        {/* ABA 2: ELABORAR DOCUMENTOS */}
        <TabsContent value="elaborar" className="mt-2">
          <div className="space-y-4">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-emerald-900 mb-1">Catálogo de Programas e Laudos</h3>
              <p className="text-sm text-emerald-700">Selecione o documento que deseja gerar ou revisar. Os dados consumidos vêm automaticamente da sua Base Técnica validada.</p>
            </div>
            
            <CentralDocumentacaoTab onNavigateSubmodulo={setActiveTab} />
          </div>
        </TabsContent>

        {/* ABA 3: DOCUMENTOS EMITIDOS */}
        <TabsContent value="emitidos" className="mt-2">
          <div className="space-y-4">
             <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-1">Histórico Oficial</h3>
              <p className="text-sm text-blue-700">Versões imutáveis de todos os documentos gerados, prontos para assinatura e envio ao cliente.</p>
            </div>
            <ListaDocumentos />
          </div>
        </TabsContent>

        {/* ABA 4: VENCIMENTOS */}
        <TabsContent value="vencimentos" className="mt-2">
          <div className="bg-white rounded-xl overflow-hidden min-h-[600px] ring-1 ring-slate-200 shadow-sm p-1">
             <PainelVencimentos />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
