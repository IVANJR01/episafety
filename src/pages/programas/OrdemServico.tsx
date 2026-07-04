import { Plus, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OrdemServico() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Ordem de Serviço"
        subtitle="Documentos de orientação de segurança por função/atividade, conforme riscos e medidas preventivas."
        actions={
          <Button disabled className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            Novo Documento
          </Button>
        }
      />
      <div className="flex justify-start">
        <Badge variant="outline" className="text-muted-foreground">Módulo em estruturação</Badge>
      </div>
      <EmptyState
        icon={ClipboardList}
        title="Nenhuma Ordem de Serviço cadastrada"
        description="Este módulo será liberado em breve. Aqui você vai emitir e controlar as OS de segurança por função, com riscos, medidas preventivas e histórico de entregas."
      />
    </div>
  );
}
