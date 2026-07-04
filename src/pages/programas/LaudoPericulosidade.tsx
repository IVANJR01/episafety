import { Plus, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LaudoPericulosidade() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Laudo de Periculosidade"
        subtitle="Avaliação técnica para caracterização ou descaracterização de adicional de periculosidade."
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
        icon={Zap}
        title="Nenhum laudo cadastrado"
        description="Este módulo será liberado em breve. Aqui você vai emitir e controlar laudos técnicos de periculosidade por função, com agentes, exposição e conclusão do perito."
      />
    </div>
  );
}
