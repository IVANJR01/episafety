import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CentralDocumentacaoTab } from "@/components/documentacao/CentralDocumentacaoTab";
import { ListaDocumentos } from "@/components/documentacao/ListaDocumentos";
import { EstruturaOcupacionalTab } from "@/components/documentacao/EstruturaOcupacionalTab";
import PainelVencimentos from "@/pages/PainelVencimentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, FileText, CheckCircle2, Clock, BookOpen } from "lucide-react";

export default function DocumentacaoSst() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abaUrl = searchParams.get("aba");

  const resolverAba = (param: string | null) => {
    if (param === "basetecnica" || param === "estrutura" || param === "ges") return "basetecnica";
    if (param === "emitidos") return "emitidos";
    if (param === "vencimentos") return "vencimentos";
    if (param === "elaborar") return "elaborar";
    // Na Central de Documentação da Gestão SST, a aba padrão primária é Elaborar Documentos
    return "elaborar";
  };

  // As 4 abas maestras exigidas
  const [activeTab, setActiveTab] = useState<string>(() => resolverAba(abaUrl));

  useEffect(() => {
    setActiveTab(resolverAba(searchParams.get("aba")));
  }, [searchParams]);

  const handleTabChange = (novaAba: string) => {
    setActiveTab(novaAba);
    const params = new URLSearchParams(searchParams);
    params.set("aba", novaAba);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="tela-larga p-4 md:p-6 space-y-6 pb-10">
      <div className="border-b pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-primary" /> Gestão SST
          </span>
          <span>/</span>
          <span className="text-primary font-bold">Central de Documentação</span>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <BookOpen className="h-6 w-6 text-primary" />
          Central de Documentação SST
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Elabore, emita e gerencie programas (PGR, PCMSO), laudos (LTCAT, Insalubridade, Periculosidade) e documentos ocupacionais com dados integrados.
        </p>
      </div>

      {/* NAVEGAÇÃO PRINCIPAL (HUB eSST) */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="pb-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-xl bg-muted p-1.5 sm:grid sm:grid-cols-4">
            <TabsTrigger value="elaborar" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4" /> Elaborar Documentos
            </TabsTrigger>
            <TabsTrigger value="emitidos" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Documentos Emitidos
            </TabsTrigger>
            <TabsTrigger value="vencimentos" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Clock className="w-4 h-4" /> Vencimentos
            </TabsTrigger>
            <TabsTrigger value="basetecnica" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Database className="w-4 h-4" /> Base Técnica
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA 1: ELABORAR DOCUMENTOS */}
        <TabsContent value="elaborar" className="mt-2">
          <div className="space-y-4">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-emerald-900 mb-1">Catálogo de Programas e Laudos</h3>
              <p className="text-sm text-emerald-700">Selecione o documento que deseja gerar ou revisar. Os dados consumidos vêm automaticamente da sua Base Técnica validada.</p>
            </div>
            
            <CentralDocumentacaoTab onNavigateSubmodulo={handleTabChange} />
          </div>
        </TabsContent>

        {/* ABA 2: DOCUMENTOS EMITIDOS */}
        <TabsContent value="emitidos" className="mt-2">
          <div className="space-y-4">
             <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-1">Histórico Oficial</h3>
              <p className="text-sm text-blue-700">Versões imutáveis de todos os documentos gerados, prontos para assinatura e envio ao cliente.</p>
            </div>
            <ListaDocumentos />
          </div>
        </TabsContent>

        {/* ABA 3: VENCIMENTOS */}
        <TabsContent value="vencimentos" className="mt-2">
          <div className="min-h-[600px] overflow-hidden rounded-xl bg-background p-1 shadow-sm ring-1 ring-border">
             <PainelVencimentos />
          </div>
        </TabsContent>

        {/* ABA 4: BASE TÉCNICA (O motor de dados) */}
        <TabsContent value="basetecnica" className="mt-2 space-y-4">
          <div className="pt-2">
            <EstruturaOcupacionalTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
