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
    /*
      `tela-larga` solta o teto de 1280px que o AppLayout impõe a todas as
      telas (ver index.css). Esta é planilha, não formulário: são quatro
      colunas de texto longo — caracterização do ambiente e descrição do
      processo — espremidas em 230px cada, enquanto sobravam faixas brancas
      dos dois lados numa tela de 1900px.

      O `max-w-[1600px]` que estava aqui nunca teve efeito: o teto do
      AppLayout é menor, e o menor sempre vence. Quem manda agora é o 1800px
      do `tela-larga`, o mesmo que Funcionários e Inspeções já usam.
    */
    <div className="tela-larga p-4 md:p-6 space-y-6 pb-10">
      {/*
        Cabeçalho, cor e tipografia saíram de `slate` e `indigo` fixos para os
        tokens do tema. O sistema inteiro é laranja; esta tela era a única
        roxa, e produto com duas cores de destaque parece dois produtos
        costurados. Junto disso, `slate` fixo ignora o tema: mudar a cor de
        fundo do sistema deixaria esta tela para trás.
      */}
      <div className="border-b pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Database className="h-6 w-6 text-primary" />
          Central de Documentação e Base Técnica
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Cadastre a estrutura ocupacional e os riscos uma única vez. Estes dados alimentam
          automaticamente PGR, PCMSO, LTCAT, Laudos e PPP.
        </p>
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
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-xl bg-muted p-1.5 sm:grid sm:grid-cols-4">
            <TabsTrigger value="basetecnica" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Database className="w-4 h-4" /> Base Técnica
            </TabsTrigger>
            <TabsTrigger value="elaborar" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4" /> Elaborar Documentos
            </TabsTrigger>
            <TabsTrigger value="emitidos" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Documentos Emitidos
            </TabsTrigger>
            <TabsTrigger value="vencimentos" className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
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
          <div className="min-h-[600px] overflow-hidden rounded-xl bg-background p-1 shadow-sm ring-1 ring-border">
             <PainelVencimentos />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
