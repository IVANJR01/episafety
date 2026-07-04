import { Plus, Flame } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LaudoInsalubridade() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Laudo de Insalubridade"
        subtitle="Avaliação técnica para caracterização ou descaracterização de adicional de insalubridade."
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
        icon={Flame}
        title="Nenhum laudo cadastrado"
        description="Este módulo será liberado em breve. Aqui você vai emitir e controlar laudos técnicos de insalubridade por função, com agentes, graus e conclusão do perito."
      />
    </div>
  );
}
