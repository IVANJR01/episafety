import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, FileBarChart, Bot } from "lucide-react";
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

  const [loadingEstat, setLoadingEstat] = useState(false);

  const gerarEstatisticas = async () => {
    try {
      setLoadingEstat(true);
      const { data, error } = await supabase
        .from("asos")
        .select("tipo_exame, status_aptidao, status")
        .eq("empresa_id", pcmso.empresa_id)
        .neq("status", "cancelado");
      
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nenhum ASO encontrado para esta empresa no banco de dados.");
        return;
      }

      const total = data.length;
      const aptos = data.filter(d => d.status_aptidao === "apto").length;
      const restricoes = data.filter(d => d.status_aptidao === "apto_restricao").length;
      const inaptos = data.filter(d => d.status_aptidao === "inapto").length;
      
      const admissional = data.filter(d => d.tipo_exame === "admissional").length;
      const periodico = data.filter(d => d.tipo_exame === "periodico").length;
      const retorno = data.filter(d => d.tipo_exame === "retorno").length;
      const mudanca = data.filter(d => d.tipo_exame === "mudanca_risco").length;
      const demissional = data.filter(d => d.tipo_exame === "demissional").length;

      const anoVigente = pcmso.data_vigencia_inicio ? new Date(pcmso.data_vigencia_inicio).getFullYear() - 1 : new Date().getFullYear() - 1;

      const txt = `** RELATÓRIO ESTATÍSTICO DE ASOS (Referente ao período anterior - ${anoVigente}) **\n\n`
        + `Total de Atestados de Saúde Ocupacional (ASOs) emitidos: ${total}\n\n`
        + `* DISTRIBUIÇÃO POR TIPO DE EXAME\n`
        + `- Admissionais: ${admissional}\n`
        + `- Periódicos: ${periodico}\n`
        + `- Retorno ao Trabalho: ${retorno}\n`
        + `- Mudança de Risco: ${mudanca}\n`
        + `- Demissionais: ${demissional}\n\n`
        + `* QUADRO DE APTIDÃO (RESULTADOS CLINICOS)\n`
        + `- Aptos para a função: ${aptos}\n`
        + `- Aptos com restrição: ${restricoes}\n`
        + `- Inaptos: ${inaptos}\n\n`
        + `==============================================\n`
        + `Análise crítica do Médico Coordenador e Ações de Melhoria:\n\n`
        + `[Descreva aqui as anomalias, evolução dos inaptos/doenças e as ações preventivas para este novo ano da NR-07...]`;
        
      setRelatorio(txt);
      toast.success("Estatísticas importadas com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao buscar ASOs: ${err.message}`);
    } finally {
      setLoadingEstat(false);
    }
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
            <div className="flex justify-between items-center">
              <Label>Avaliação de Exames Anteriores e Métricas</Label>
              {!formDisabled && (
                <Button variant="secondary" size="sm" onClick={gerarEstatisticas} disabled={loadingEstat}>
                  {loadingEstat ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
                  Importar Dados de ASOs
                </Button>
              )}
            </div>
            <div className="space-y-2">
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
