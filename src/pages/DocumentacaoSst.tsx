import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CentralDocumentacaoTab } from "@/components/documentacao/CentralDocumentacaoTab";
import { ListaDocumentos } from "@/components/documentacao/ListaDocumentos";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import PainelVencimentos from "@/pages/PainelVencimentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, CheckCircle2, Clock } from "lucide-react";

export default function DocumentacaoSst() {
  const [searchParams] = useSearchParams();
  const abaUrl = searchParams.get("aba");
  
  // As 4 abas maestras exigidas
  const [activeTab, setActiveTab] = useState(
    ["basetecnica", "elaborar", "emitidos", "vencimentos"].includes(abaUrl || "") ? abaUrl! : "basetecnica",
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            Central de Documentação e Base Técnica
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Cadastre a estrutura ocupacional e os riscos uma única vez. Estes dados alimentam
            automaticamente PGR, PCMSO, LTCAT, Laudos e PPP.
          </p>
        </div>
      </div>

      {/* NAVEGAÇÃO PRINCIPAL (HUB eSST) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="pb-4">
          {/*
            `sm:grid` é obrigatório aqui. A base do TabsList traz
            `sm:inline-flex sm:justify-center`, e classe com prefixo responsivo
            vence a sem prefixo — o `grid` sozinho era ignorado no desktop e a
            barra virava um bloco centralizado, com sobra dos dois lados. O
            tailwind-merge não funde as duas porque estão em grupos diferentes.
          */}
          <TabsList className="grid grid-cols-2 sm:grid sm:grid-cols-4 w-full bg-slate-100/80 p-1.5 rounded-xl gap-1.5 h-auto">
            <TabsTrigger value="basetecnica" className="w-full justify-center text-sm font-semibold px-3 py-2.5 flex items-center gap-2 text-slate-600 data-[state=active]:shadow-sm data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <Database className="w-4 h-4" /> Base Técnica
            </TabsTrigger>
            <TabsTrigger value="elaborar" className="w-full justify-center text-sm font-semibold px-3 py-2.5 flex items-center gap-2 text-slate-600 data-[state=active]:shadow-sm data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <FileText className="w-4 h-4" /> Elaborar Documentos
            </TabsTrigger>
            <TabsTrigger value="emitidos" className="w-full justify-center text-sm font-semibold px-3 py-2.5 flex items-center gap-2 text-slate-600 data-[state=active]:shadow-sm data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <CheckCircle2 className="w-4 h-4" /> Documentos Emitidos
            </TabsTrigger>
            <TabsTrigger value="vencimentos" className="w-full justify-center text-sm font-semibold px-3 py-2.5 flex items-center gap-2 text-slate-600 data-[state=active]:shadow-sm data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <Clock className="w-4 h-4" /> Vencimentos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA 1: BASE TÉCNICA (O motor de dados) */}
        <TabsContent value="basetecnica" className="mt-2 space-y-4">
          <div className="pt-2">
            <EstruturaOcupacionalTab />
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
