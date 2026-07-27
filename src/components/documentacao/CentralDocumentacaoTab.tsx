import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ShieldCheck,
  Stethoscope,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Building2,
  ArrowRight,
  Layers,
} from "lucide-react";

interface CentralDocumentacaoTabProps {
  onNavigateSubmodulo: (submodulo: string) => void;
}

export function CentralDocumentacaoTab({ onNavigateSubmodulo }: CentralDocumentacaoTabProps) {
  const fluxoEtapas = [
    { id: 1, nome: "Cadastro", submodulo: "estrutura", status: "concluido", icon: Building2 },
    { id: 2, nome: "Levantamento", submodulo: "ges", status: "concluido", icon: Layers },
    { id: 3, nome: "Avaliação", submodulo: "exposicoes", status: "em_andamento", icon: AlertTriangle },
    { id: 4, nome: "Revisão Técnica", submodulo: "documentos", status: "pendente", icon: Clock },
    { id: 5, nome: "Assinatura", submodulo: "assinaturas", status: "pendente", icon: FileText },
    { id: 6, nome: "Emissão", submodulo: "emitidos", status: "pendente", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DA CENTRAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Núcleo Mestre SST</Badge>
            <span className="text-xs text-slate-400">Ativo & Sincronizado</span>
          </div>
          <h2 className="text-2xl font-bold mt-1">Central de Documentação Legal SST</h2>
          <p className="text-sm text-slate-300">
            Gerenciamento unificado de PGR, PCMSO, LTCAT, Laudos NR-15/16, PPP e eSocial a partir do Núcleo Mestre.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onNavigateSubmodulo("pgr")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="w-4 h-4 mr-2" />
            Elaborar PGR
          </Button>
          <Button onClick={() => onNavigateSubmodulo("ltcat")} variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Elaborar LTCAT
          </Button>
        </div>
      </div>

      {/* FLUXO VISUAL DE TRABALHO */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Fluxo de Elaboração & Ciclo de Vida Documental
          </CardTitle>
          <CardDescription>
            Acompanhe as etapas de qualificação dos dados antes da geração dos snapshots e assinaturas imutáveis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {fluxoEtapas.map((etapa) => {
              const Icon = etapa.icon;
              return (
                <div
                  key={etapa.id}
                  onClick={() => onNavigateSubmodulo(etapa.submodulo)}
                  className="cursor-pointer border rounded-lg p-3 text-center transition-all hover:border-indigo-500 hover:shadow-md bg-white flex flex-col items-center justify-between min-h-[110px]"
                >
                  <div className="flex items-center justify-between w-full text-xs text-slate-400">
                    <span>Etapa {etapa.id}</span>
                    {etapa.status === "concluido" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : etapa.status === "em_andamento" ? (
                      <Clock className="w-4 h-4 text-amber-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <Icon className="w-6 h-6 my-2 text-slate-700" />
                  <span className="text-xs font-semibold text-slate-800">{etapa.nome}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* RESUMO DOS 6 DOCUMENTOS LEGAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PGR */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                PGR (NR-01)
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500 text-emerald-700">GRO Vigente</Badge>
            </div>
            <CardDescription className="text-xs">Programa de Gerenciamento de Riscos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Inventário de Riscos:</span>
              <span className="font-semibold text-slate-800">24 Agentes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Plano de Ação:</span>
              <span className="font-semibold text-amber-600">3 Ações Pendentes</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("pgr")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-emerald-700 hover:text-emerald-800">
              Acessar PGR Mestre <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* PCMSO */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                PCMSO (NR-07)
              </CardTitle>
              <Badge variant="outline" className="border-blue-500 text-blue-700">Médico Ativo</Badge>
            </div>
            <CardDescription className="text-xs">Controle Médico de Saúde Ocupacional</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Médico Responsável:</span>
              <span className="font-semibold text-slate-800">Dr. Roberto Lima</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Matriz de Exames:</span>
              <span className="font-semibold text-slate-800">12 Exames Mapeados</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("pcmso")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-blue-700 hover:text-blue-800">
              Acessar PCMSO Mestre <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* LTCAT */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                LTCAT (Lei 8.213)
              </CardTitle>
              <Badge variant="outline" className="border-purple-500 text-purple-700">Previdenciário</Badge>
            </div>
            <CardDescription className="text-xs">Laudo Técnico Condições Ambientais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Agentes Previdenciários:</span>
              <span className="font-semibold text-slate-800">8 Agentes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Aposentadoria Especial:</span>
              <span className="font-semibold text-emerald-600">01 Função Elegível</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("ltcat")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-purple-700 hover:text-purple-800">
              Acessar LTCAT Mestre <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* LAUDO INSALUBRIDADE */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                Insalubridade (NR-15)
              </CardTitle>
              <Badge variant="outline" className="border-amber-500 text-amber-700">Laudo Técnico</Badge>
            </div>
            <CardDescription className="text-xs">Análise por Anexo da NR-15</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Funções Analisadas:</span>
              <span className="font-semibold text-slate-800">14 Funções</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Grau Médio (20%):</span>
              <span className="font-semibold text-amber-600">02 Caracterizações</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("insalubridade")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-amber-700 hover:text-amber-800">
              Acessar Laudo NR-15 <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* LAUDO PERICULOSIDADE */}
        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Periculosidade (NR-16)
              </CardTitle>
              <Badge variant="outline" className="border-red-500 text-red-700">Laudo Técnico</Badge>
            </div>
            <CardDescription className="text-xs">Operações & Áreas de Risco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Áreas de Risco:</span>
              <span className="font-semibold text-slate-800">03 Locais</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Adicional 30%:</span>
              <span className="font-semibold text-emerald-600">Não Caracterizado</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("periculosidade")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-red-700 hover:text-red-800">
              Acessar Laudo NR-16 <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* PPP / ESOCIAL */}
        <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                PPP / eSocial S-2240
              </CardTitle>
              <Badge variant="outline" className="border-indigo-500 text-indigo-700">eSocial Oficial</Badge>
            </div>
            <CardDescription className="text-xs">Perfil Profissiográfico Previdenciário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Trabalhadores Mapeados:</span>
              <span className="font-semibold text-slate-800">42 Ativos</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Eventos S-2240 Prontos:</span>
              <span className="font-semibold text-emerald-600">42 Validados</span>
            </div>
            <Button onClick={() => onNavigateSubmodulo("ppp")} variant="ghost" size="sm" className="w-full mt-2 text-xs text-indigo-700 hover:text-indigo-800">
              Acessar PPP & eSocial <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
