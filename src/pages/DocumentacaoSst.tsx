import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { CentralDocumentacaoTab } from "@/components/documentacao/CentralDocumentacaoTab";
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
  ShieldCheck,
  Stethoscope,
  FileSpreadsheet,
  AlertTriangle,
  Users,
  CheckCircle2,
  Award,
  History,
  Lock,
  Radio,
} from "lucide-react";

export default function DocumentacaoSst() {
  const [activeTab, setActiveTab] = useState("central");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* HEADER GERAL */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white">Módulo Mestre</Badge>
              <span className="text-xs text-slate-500 font-mono">NR-01 • NR-07 • NR-15 • NR-16 • Lei 8.213</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Plataforma de Documentação SST
            </h1>
            <p className="text-sm text-slate-500">
              Cadastre a estrutura ocupacional e exposições uma única vez no Núcleo Mestre para emitir os 6 documentos sem duplicação de dados.
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO DOS SUBMÓDULOS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="flex w-max min-w-full bg-slate-100 p-1.5 rounded-xl gap-1">
              <TabsTrigger value="central" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" /> 1. Central
              </TabsTrigger>
              <TabsTrigger value="estrutura" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-600" /> 2. Estrutura
              </TabsTrigger>
              <TabsTrigger value="ges" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-600" /> 3. GES / Exposições
              </TabsTrigger>
              <TabsTrigger value="pgr" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" /> 5. PGR
              </TabsTrigger>
              <TabsTrigger value="pcmso" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-blue-600" /> 6. PCMSO
              </TabsTrigger>
              <TabsTrigger value="ltcat" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" /> 7. LTCAT
              </TabsTrigger>
              <TabsTrigger value="insalubridade" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" /> 8. NR-15
              </TabsTrigger>
              <TabsTrigger value="periculosidade" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" /> 9. NR-16
              </TabsTrigger>
              <TabsTrigger value="ppp" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" /> 10. PPP / eSocial
              </TabsTrigger>
              <TabsTrigger value="responsaveis" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-600" /> 11. Habilitados
              </TabsTrigger>
              <TabsTrigger value="emitidos" className="text-xs font-semibold px-3 py-2 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-600" /> 12. Snapshots
              </TabsTrigger>
            </TabsList>
          </div>

          {/* SUBMÓDULO 1: CENTRAL */}
          <TabsContent value="central" className="mt-4">
            <CentralDocumentacaoTab onNavigateSubmodulo={setActiveTab} />
          </TabsContent>

          {/* SUBMÓDULO 2: ESTRUTURA OCUPACIONAL */}
          <TabsContent value="estrutura" className="mt-4">
            <EstruturaOcupacionalTab />
          </TabsContent>

          {/* SUBMÓDULO 3: GES & EXPOSIÇÕES */}
          <TabsContent value="ges" className="mt-4">
            <GesExposicoesTab />
          </TabsContent>

          {/* SUBMÓDULOS DE DOCUMENTOS ESPECÍFICOS */}
          <TabsContent value="pgr" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <FileText className="w-12 h-12 text-emerald-600 mx-auto" />
              <CardTitle>Módulo PGR Mestre (NR-01)</CardTitle>
              <CardDescription>
                Consome o Núcleo Mestre para gerar o Inventário de Riscos GRO e o Plano de Ação.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="pcmso" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <Stethoscope className="w-12 h-12 text-blue-600 mx-auto" />
              <CardTitle>Módulo PCMSO Mestre (NR-07)</CardTitle>
              <CardDescription>
                Matriz de exames e condutas clínicas médica sob responsabilidade do Médico cadastrado.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="ltcat" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-purple-600 mx-auto" />
              <CardTitle>Módulo LTCAT Previdenciário (Lei 8.213/91)</CardTitle>
              <CardDescription>
                Avaliação de agentes nocivos e conclusões de aposentadoria especial assinadas por Engenheiro/Médico.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="insalubridade" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-amber-600 mx-auto" />
              <CardTitle>Laudo Técnico de Insalubridade (NR-15)</CardTitle>
              <CardDescription>
                Análise técnica por anexo com determinação dos graus (10%, 20%, 40%) e comprovação de neutralização.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="periculosidade" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
              <CardTitle>Laudo Técnico de Periculosidade (NR-16)</CardTitle>
              <CardDescription>
                Operações perigosas, delimitação de áreas de risco, croquis e laudo do adicional de 30%.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="ppp" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <Users className="w-12 h-12 text-indigo-600 mx-auto" />
              <CardTitle>Módulo PPP & Validador eSocial S-2240</CardTitle>
              <CardDescription>
                Linha do tempo histórica de exposição por funcionário e conferência para transmissão oficial.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="responsaveis" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <Award className="w-12 h-12 text-slate-700 mx-auto" />
              <CardTitle>Responsáveis Técnicos e Assinantes Habilitados</CardTitle>
              <CardDescription>
                Cadastro de Engenheiros de Segurança (CREA) e Médicos do Trabalho (CRM/RQE) com assinaturas digitais.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="emitidos" className="mt-4">
            <Card className="p-6 text-center space-y-3">
              <Lock className="w-12 h-12 text-slate-700 mx-auto" />
              <CardTitle>Repositório de Snapshots Imutáveis & PDFs Emitidos</CardTitle>
              <CardDescription>
                Histórico imutável com hashes SHA-256 e validação de autenticidade de documentos emitidos.
              </CardDescription>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
