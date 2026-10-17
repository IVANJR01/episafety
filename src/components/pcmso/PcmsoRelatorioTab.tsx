import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FileBarChart, Bot, Stethoscope, CheckCircle2, AlertCircle, XCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface PcmsoRelatorioTabProps {
  pcmso: any;
}

export default function PcmsoRelatorioTab({ pcmso }: PcmsoRelatorioTabProps) {
  const navigate = useNavigate();
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();

  const [relatorio, setRelatorio] = useState(pcmso.relatorio_analitico || "");

  // Consulta em tempo real dos ASOs emitidos para esta empresa
  const { data: asosData = [], isLoading: loadingAsos } = useQuery({
    queryKey: ["pcmso-relatorio-asos", pcmso.empresa_id],
    enabled: !!pcmso.empresa_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asos")
        .select("id, tipo_exame, status_aptidao, status, data_emissao, funcionario_id, funcionarios:funcionario_id(setor, cargo)")
        .eq("empresa_id", pcmso.empresa_id)
        .neq("status", "cancelado");
      if (error) {
        console.error("Erro ao carregar ASOs para o Relatório Analítico:", error);
        return [];
      }
      return data || [];
    },
  });

  // Métricas epidemiológicas da NR-07 (item 7.6.2)
  const metricas = useMemo(() => {
    const total = asosData.length;
    const aptos = asosData.filter((d: any) => d.status_aptidao === "apto").length;
    const restricoes = asosData.filter((d: any) => d.status_aptidao === "apto_restricao").length;
    const inaptos = asosData.filter((d: any) => d.status_aptidao === "inapto").length;

    const admissional = asosData.filter((d: any) => d.tipo_exame === "admissional").length;
    const periodico = asosData.filter((d: any) => d.tipo_exame === "periodico").length;
    const retorno = asosData.filter((d: any) => d.tipo_exame === "retorno").length;
    const mudanca = asosData.filter((d: any) => d.tipo_exame === "mudanca_risco" || d.tipo_exame === "mudanca_funcao").length;
    const demissional = asosData.filter((d: any) => d.tipo_exame === "demissional").length;

    // Setores mais frequentes
    const setoresMap = new Map<string, number>();
    asosData.forEach((d: any) => {
      const s = (d as any).funcionarios?.setor || "Geral";
      setoresMap.set(s, (setoresMap.get(s) || 0) + 1);
    });

    return {
      total,
      aptos,
      restricoes,
      inaptos,
      pctApto: total > 0 ? ((aptos / total) * 100).toFixed(1) : "0",
      pctRestricao: total > 0 ? ((restricoes / total) * 100).toFixed(1) : "0",
      pctInapto: total > 0 ? ((inaptos / total) * 100).toFixed(1) : "0",
      admissional,
      periodico,
      retorno,
      mudanca,
      demissional,
      setores: [...setoresMap.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [asosData]);

  const updateMutation = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase
        .from("pcmso_documentos")
        .update({ relatorio_analitico: texto })
        .eq("id", pcmso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório Analítico salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
    },
    onError: (err: any) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const handleSalvar = () => {
    updateMutation.mutate(relatorio);
  };

  const gerarEstatisticas = () => {
    if (metricas.total === 0) {
      toast.info("Nenhum ASO registrado no banco de dados para esta empresa.");
      return;
    }

    const anoVigente = pcmso.data_vigencia_inicio
      ? new Date(pcmso.data_vigencia_inicio).getFullYear() - 1
      : new Date().getFullYear() - 1;

    const linhasSetores = metricas.setores.slice(0, 8).map(([setor, qtd]) => `  • Setor ${setor}: ${qtd} exame(s)`).join("\n");

    const txt = `========================================================================\n`
      + `RELATÓRIO ANALÍTICO DO PCMSO — NR-07 (Subitem 7.6.2)\n`
      + `Período Epidemiológico Consolidado: Ciclo de ${anoVigente}\n`
      + `========================================================================\n\n`
      + `1. DADOS QUANTITATIVOS DE AVALIAÇÕES CLÍNICAS (ASOs)\n`
      + `Total de Atestados de Saúde Ocupacional emitidos: ${metricas.total}\n\n`
      + `Distribuição por Modalidade de Exame:\n`
      + `  • Admissionais: ${metricas.admissional} (${metricas.total > 0 ? ((metricas.admissional / metricas.total) * 100).toFixed(1) : 0}%)\n`
      + `  • Periódicos: ${metricas.periodico} (${metricas.total > 0 ? ((metricas.periodico / metricas.total) * 100).toFixed(1) : 0}%)\n`
      + `  • Retorno ao Trabalho: ${metricas.retorno} (${metricas.total > 0 ? ((metricas.retorno / metricas.total) * 100).toFixed(1) : 0}%)\n`
      + `  • Mudança de Risco Ocupacional: ${metricas.mudanca} (${metricas.total > 0 ? ((metricas.mudanca / metricas.total) * 100).toFixed(1) : 0}%)\n`
      + `  • Demissionais: ${metricas.demissional} (${metricas.total > 0 ? ((metricas.demissional / metricas.total) * 100).toFixed(1) : 0}%)\n\n`
      + `2. QUADRO EPIDEMIOLÓGICO DE APTIDÃO CLÍNICA\n`
      + `  • Aptos para a função: ${metricas.aptos} (${metricas.pctApto}%)\n`
      + `  • Aptos com restrição: ${metricas.restricoes} (${metricas.pctRestricao}%)\n`
      + `  • Inaptos: ${metricas.inaptos} (${metricas.pctInapto}%)\n\n`
      + `3. PRINCIPAIS SETORES COM AVALIAÇÕES NO PERÍODO\n`
      + `${linhasSetores || "  • Conforme fichas individuais dos colaboradores."}\n\n`
      + `========================================================================\n`
      + `4. ANÁLISE CRÍTICA DO MÉDICO COORDENADOR E RECOMENDAÇÕES (NR-07)\n\n`
      + `a) Evolução clínica e epidemiológica dos trabalhadores:\n`
      + `No período avaliado, as taxas de aptidão (${metricas.pctApto}%) demonstraram compatibilidade entre a capacidade física dos colaboradores e as exigências ocupacionais mapeadas nos Grupos de Exposição Similar (GES). Os casos com restrição foram orientados e acompanhados.\n\n`
      + `b) Medidas preventivas e ações prioritárias para o próximo ciclo:\n`
      + `- Cumprimento rigoroso do cronograma de exames periódicos da Seção 13.\n`
      + `- Articulação contínua com as medidas de controle do PGR para preservação da saúde dos trabalhadores.\n`
      + `- Vigilância ativa sobre queixas ergonômicas e posturais nos setores com maior demanda física.`;

    setRelatorio(txt);
    toast.success("Estatísticas importadas com sucesso!");
  };

  const formDisabled = !perms.canEdit || pcmso.status !== "rascunho";

  return (
    <div className="space-y-6">
      {/* Resumo Integrado das Métricas de ASOs (Banco de Dados em tempo real) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-slate-200 shadow-2xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-500">ASOs Registrados</span>
            <div className="text-2xl font-bold text-slate-800 mt-1">{metricas.total}</div>
            <span className="text-[11px] text-muted-foreground mt-0.5">Base viva do sistema</span>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800">Aptos</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{metricas.aptos}</div>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5">{metricas.pctApto}% dos exames</span>
          </CardContent>
        </Card>

        <Card className="border border-amber-200 bg-amber-50/40 shadow-2xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800">Aptos c/ Restrição</span>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{metricas.restricoes}</div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5">{metricas.pctRestricao}% dos exames</span>
          </CardContent>
        </Card>

        <Card className="border border-rose-200 bg-rose-50/40 shadow-2xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-800">Inaptos</span>
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{metricas.inaptos}</div>
            <span className="text-[11px] text-rose-700 font-medium mt-0.5">{metricas.pctInapto}% dos exames</span>
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-4 border-t-rose-600 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileBarChart className="h-5 w-5 text-rose-600" /> Relatório Analítico (NR-07 — Subitem 7.6.2)
              </CardTitle>
              <CardDescription className="mt-1">
                O Relatório Analítico anual consolida as avaliações clínicas e epidemiológicas dos ASOs emitidos.
                Este texto é impresso na Seção 12 do documento oficial do PCMSO.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/aso")}
              className="text-xs gap-1.5 shrink-0 bg-white shadow-2xs"
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
              Ver ASOs no Painel de Exames
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <Label className="text-sm font-semibold text-slate-800">
                Texto do Relatório Analítico e Parecer do Médico Coordenador
              </Label>
              {!formDisabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={gerarEstatisticas}
                  disabled={loadingAsos}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs gap-1.5"
                >
                  {loadingAsos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 text-rose-600" />}
                  Importar Estatísticas Automáticas dos ASOs
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Textarea
                value={relatorio}
                onChange={(e) => setRelatorio(e.target.value)}
                placeholder="Insira os dados quantitativos de ASOs emitidos, alterações encontradas, evolução de queixas..."
                className="min-h-[280px] font-mono text-xs leading-relaxed"
                disabled={formDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Dica: Você pode clicar em <b>"Importar Estatísticas Automáticas dos ASOs"</b> para preencher as métricas do banco de dados e em seguida editar o parecer técnico.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!formDisabled && (
        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSalvar} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Relatório Analítico
          </Button>
        </div>
      )}
    </div>
  );
}
