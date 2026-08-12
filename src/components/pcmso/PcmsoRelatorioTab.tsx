import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, FileBarChart } from "lucide-react";
import { toast } from "sonner";

interface PcmsoRelatorioTabProps {
  pcmso: any;
}

export default function PcmsoRelatorioTab({ pcmso }: PcmsoRelatorioTabProps) {
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();

  const [relatorio, setRelatorio] = useState(pcmso.relatorio_analitico || "");

  const updateMutation = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase
        .from("pcmso_documentos")
        .update({ relatorio_analitico: texto })
        .eq("id", pcmso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório Analítico salvo!");
      queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
    },
    onError: (err: any) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const handleSalvar = () => {
    updateMutation.mutate(relatorio);
  };

  const formDisabled = !perms.canEdit || pcmso.status !== "rascunho";

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-rose-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-rose-600" /> Relatório Analítico (NR-07)
          </CardTitle>
          <CardDescription>
            Toda renovação do PCMSO exige a elaboração de um relatório analítico sobre os ASOs e exames 
            alterados no ano anterior. Insira a avaliação estatística e os planos de melhoria aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Avaliação de Exames Anteriores e Métricas</Label>
              <Textarea 
                value={relatorio} 
                onChange={e => setRelatorio(e.target.value)}
                placeholder="Insira os dados quantitativos de ASOs emitidos, alterações encontradas, evolução de queixas..."
                className="min-h-[200px]"
                disabled={formDisabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {!formDisabled && (
        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSalvar} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Relatório Analítico
          </Button>
        </div>
      )}
    </div>
  );
}
