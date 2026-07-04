import { Link } from "react-router-dom";
import { ShieldCheck, FileText, Stethoscope, ClipboardList, Flame, Zap, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProgramaCard {
  key: string;
  nome: string;
  descricao: string;
  icon: any;
  to: string;
  status?: "ativo" | "em-estruturacao";
}

const programas: ProgramaCard[] = [
  {
    key: "pgr",
    nome: "PGR",
    descricao: "Programa de Gerenciamento de Riscos ocupacionais da empresa.",
    icon: ShieldCheck,
    to: "/pgr",
    status: "ativo",
  },
  {
    key: "ordem-servico",
    nome: "Ordem de Serviço",
    descricao: "Documentos de orientação de segurança por função/atividade, conforme riscos e medidas preventivas.",
    icon: ClipboardList,
    to: "/programas/ordem-servico",
    status: "em-estruturacao",
  },
  {
    key: "pcmso",
    nome: "PCMSO",
    descricao: "Programa de Controle Médico de Saúde Ocupacional e controle de exames.",
    icon: Stethoscope,
    to: "/aso",
    status: "ativo",
  },
  {
    key: "ltcat",
    nome: "LTCAT",
    descricao: "Laudo Técnico das Condições Ambientais do Trabalho.",
    icon: FileText,
    to: "/ltcat",
    status: "ativo",
  },
  {
    key: "insalubridade",
    nome: "Laudo de Insalubridade",
    descricao: "Avaliação técnica para caracterização ou descaracterização de adicional de insalubridade.",
    icon: Flame,
    to: "/programas/laudo-insalubridade",
    status: "em-estruturacao",
  },
  {
    key: "periculosidade",
    nome: "Laudo de Periculosidade",
    descricao: "Avaliação técnica para caracterização ou descaracterização de adicional de periculosidade.",
    icon: Zap,
    to: "/programas/laudo-periculosidade",
    status: "em-estruturacao",
  },
];

export default function ProgramasHome() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Programas"
        subtitle="Gestão de programas, laudos e documentos técnicos de Segurança e Saúde do Trabalho."
      />

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {programas.map((p) => {
          const Icon = p.icon;
          const ativo = p.status === "ativo";
          return (
            <Card key={p.key} className="flex flex-col hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {ativo ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-white">Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Em estruturação</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-base text-foreground">{p.nome}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex-1">{p.descricao}</p>
                <Button asChild className="w-full mt-4 min-h-[44px]" variant={ativo ? "default" : "outline"}>
                  <Link to={p.to}>
                    Acessar
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
