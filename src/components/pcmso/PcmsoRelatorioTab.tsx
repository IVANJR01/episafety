import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Loader2,
  FileBarChart,
  Bot,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface PcmsoRelatorioTabProps {
  pcmso: any;
}

export default function PcmsoRelatorioTab({ pcmso }: PcmsoRelatorioTabProps) {
  const navigate = useNavigate();
  const perms = usePermissions("pgr");
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [relatorio, setRelatorio] = useState(pcmso.relatorio_analitico || "");
  const [copiado, setCopiado] = useState(false);

  // Sincroniza se o prop mudar
  useEffect(() => {
    if (pcmso.relatorio_analitico && !relatorio) {
      setRelatorio(pcmso.relatorio_analitico);
    }
  }, [pcmso.relatorio_analitico]);

  // Consulta em tempo real dos ASOs emitidos para esta empresa
  const {
    data: asosData = [],
    isLoading: loadingAsos,
    refetch: refetchAsos,
    isFetching: recarregandoAsos,
  } = useQuery({
    queryKey: ["pcmso-relatorio-asos", pcmso.empresa_id],
    enabled: !!pcmso.empresa_id,
    queryFn: async () => {
      try {
        let listaAsos: any[] = [];
        const { data, error } = await supabase
          .from("asos")
          .select(`
            id,
            tipo_exame,
            status_aptidao,
            status,
            data_emissao,
            funcionario_id,
            funcionarios:funcionario_id(nome, setor, cargo),
            aso_exames(id, nome_exame, resultado, realizado)
          `)
          .eq("empresa_id", pcmso.empresa_id)
          .neq("status", "cancelado");

        if (error) {
          console.warn("Consulta completa de ASOs falhou, tentando fallback simples:", error);
          const { data: fallback } = await supabase
            .from("asos")
            .select("id, tipo_exame, status_aptidao, status, data_emissao, funcionario_id, funcionarios:funcionario_id(setor, cargo)")
            .eq("empresa_id", pcmso.empresa_id)
            .neq("status", "cancelado");
          listaAsos = fallback || [];
        } else {
          listaAsos = data || [];
        }

        // Consolida também registros da tabela de controle 'exames' (matriz clínica)
        // para funcionários que ainda não foram convertidos formalmente em 'asos'
        const { data: examesData } = await supabase
          .from("exames")
          .select("id, tipo, resultado, data, data_vencimento, funcionario_id, funcionarios:funcionario_id(nome, setor, cargo)")
          .eq("empresa_id", pcmso.empresa_id);

        if (examesData && examesData.length > 0) {
          const idsJaEmAsos = new Set(listaAsos.map((a: any) => a.funcionario_id));
          const novosExames = examesData.filter((e: any) => e.funcionario_id && !idsJaEmAsos.has(e.funcionario_id));
          
          novosExames.forEach((e: any) => {
            const res = (e.resultado || "apto").toLowerCase();
            const aptidao = res.includes("restri")
              ? "apto_restricao"
              : res.includes("inapto")
              ? "inapto"
              : "apto";

            listaAsos.push({
              id: e.id,
              tipo_exame: e.tipo || "periodico",
              status_aptidao: aptidao,
              status: "emitido",
              data_emissao: e.data,
              funcionario_id: e.funcionario_id,
              funcionarios: e.funcionarios,
              aso_exames: [],
            });
          });
        }

        return listaAsos;
      } catch (e) {
        console.error("Erro ao carregar ASOs para o Relatório Analítico:", e);
        return [];
      }
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

    // Exames complementares registrados
    const examesComplementaresMap = new Map<string, { total: number; normais: number; alterados: number }>();
    asosData.forEach((d: any) => {
      const exames = (d as any).aso_exames;
      if (Array.isArray(exames)) {
        exames.forEach((ex: any) => {
          const nome = ex.nome_exame || "Exame Complementar";
          const atual = examesComplementaresMap.get(nome) || { total: 0, normais: 0, alterados: 0 };
          atual.total += 1;
          const res = (ex.resultado || "").toLowerCase();
          if (res.includes("alterad") || res.includes("anormal")) {
            atual.alterados += 1;
          } else {
            atual.normais += 1;
          }
          examesComplementaresMap.set(nome, atual);
        });
      }
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
      examesComplementares: [...examesComplementaresMap.entries()],
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

  const handleCopiar = () => {
    if (!relatorio) {
      toast.info("Nenhum texto para copiar.");
      return;
    }
    navigator.clipboard.writeText(relatorio);
    setCopiado(true);
    toast.success("Texto do Relatório Analítico copiado para a área de transferência!");
    setTimeout(() => setCopiado(false), 2500);
  };

  const gerarEstatisticas = () => {
    const anoVigente = pcmso.data_vigencia_inicio
      ? new Date(pcmso.data_vigencia_inicio).getFullYear()
      : new Date().getFullYear();

    const linhasSetores = metricas.setores.length > 0
      ? metricas.setores.slice(0, 8).map(([setor, qtd]) => `  • Setor ${setor}: ${qtd} exame(s)`).join("\n")
      : "  • Conforme fichas individuais dos colaboradores.";

    let secaoComplementares = "";
    if (metricas.examesComplementares.length > 0) {
      const linhasEx = metricas.examesComplementares.map(([nome, dados]) =>
        `  • ${nome}: ${dados.total} realizado(s) — Normais: ${dados.normais} | Anormais/Alterados: ${dados.alterados}`
      ).join("\n");
      secaoComplementares = `\n2. EXAMES COMPLEMENTARES REALIZADOS E RESULTADOS (NR-07 Item 7.6.2 b/c)\n${linhasEx}\n`;
    } else {
      secaoComplementares = `\n2. EXAMES COMPLEMENTARES (NR-07 Item 7.6.2 b/c)\n  • Não foram registradas anormalidades ou exames complementares específicos fora dos parâmetros de rotina clínica no período.\n`;
    }

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
      + `  • Demissionais: ${metricas.demissional} (${metricas.total > 0 ? ((metricas.demissional / metricas.total) * 100).toFixed(1) : 0}%)\n`
      + secaoComplementares + `\n`
      + `3. QUADRO EPIDEMIOLÓGICO DE APTIDÃO CLÍNICA\n`
      + `  • Aptos para a função: ${metricas.aptos} (${metricas.pctApto}%)\n`
      + `  • Aptos com restrição: ${metricas.restricoes} (${metricas.pctRestricao}%)\n`
      + `  • Inaptos: ${metricas.inaptos} (${metricas.pctInapto}%)\n\n`
      + `4. PRINCIPAIS SETORES COM AVALIAÇÕES NO PERÍODO\n`
      + `${linhasSetores}\n\n`
      + `========================================================================\n`
      + `5. ANÁLISE CRÍTICA DO MÉDICO COORDENADOR E RECOMENDAÇÕES (NR-07)\n\n`
      + `a) Evolução clínica e epidemiológica dos trabalhadores:\n`
      + `No período avaliado, as taxas de aptidão (${metricas.pctApto}%) demonstraram compatibilidade entre a capacidade física dos colaboradores e as exigências ocupacionais mapeadas nos Grupos de Exposição Similar (GES). Os casos com restrição foram devidamente acompanhados.\n\n`
      + `b) Medidas preventivas e ações prioritárias para o próximo ciclo:\n`
      + `- Cumprimento rigoroso do cronograma de exames periódicos da Seção 13.\n`
      + `- Articulação contínua com as medidas de controle do PGR para preservação da saúde dos trabalhadores.\n`
      + `- Vigilância ativa sobre queixas ergonômicas e posturais nos setores com maior demanda física.`;

    setRelatorio(txt);
    toast.success("Estatísticas e dados dos ASOs importados com sucesso! Você pode complementar e salvar.");
  };

  const isDocumentoCancelado = pcmso.status === "cancelado" || pcmso.status === "arquivado";
  const podeEditar = !isDocumentoCancelado;

  return (
    <div className="space-y-3">
      {/* Resumo compacto de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Exames / ASOs</span>
            <div className="text-lg font-bold text-slate-800">{metricas.total}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              refetchAsos();
              toast.info("Métricas atualizadas!");
            }}
            disabled={recarregandoAsos}
            className="h-6 w-6 text-muted-foreground hover:text-slate-800"
            title="Sincronizar métricas"
          >
            <RefreshCw className={`w-3 h-3 ${recarregandoAsos ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-emerald-800 uppercase">Aptos</span>
            <div className="text-lg font-bold text-emerald-700">{metricas.aptos}</div>
          </div>
          <span className="text-[11px] font-medium text-emerald-700">{metricas.pctApto}%</span>
        </div>

        <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-amber-800 uppercase">Restrições</span>
            <div className="text-lg font-bold text-amber-700">{metricas.restricoes}</div>
          </div>
          <span className="text-[11px] font-medium text-amber-700">{metricas.pctRestricao}%</span>
        </div>

        <div className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-rose-800 uppercase">Inaptos</span>
            <div className="text-lg font-bold text-rose-700">{metricas.inaptos}</div>
          </div>
          <span className="text-[11px] font-medium text-rose-700">{metricas.pctInapto}%</span>
        </div>
      </div>

      {/* Card do Relatório Analítico */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="py-2.5 px-4 border-b bg-slate-50/60 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
              <FileBarChart className="h-4 w-4 text-rose-600" />
              Relatório Analítico (NR-07)
            </CardTitle>
            {pcmso.status === "vigente" && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0 h-5">
                Vigente
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {podeEditar && (
              <Button
                variant="default"
                size="sm"
                onClick={gerarEstatisticas}
                disabled={loadingAsos}
                className="h-7 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-2xs font-medium"
              >
                {loadingAsos ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                {relatorio ? "Atualizar Dados dos ASOs" : "Preencher com Dados dos ASOs"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/aso")}
              className="h-7 text-xs gap-1 text-slate-600 bg-white"
            >
              <Stethoscope className="w-3 h-3 text-teal-600" />
              Ver ASOs
              <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 space-y-2.5">
          <Textarea
            value={relatorio}
            onChange={(e) => setRelatorio(e.target.value)}
            placeholder="Clique em 'Preencher com Dados dos ASOs' no topo para gerar automaticamente o parecer estatístico anual..."
            className="min-h-[340px] font-mono text-xs leading-relaxed"
            disabled={!podeEditar}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span className="text-[11px]">
              {relatorio ? `${relatorio.length} caracteres` : "Nenhum texto preenchido"}
            </span>

            <div className="flex items-center gap-2">
              {relatorio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopiar}
                  className="h-7 text-xs text-muted-foreground hover:text-slate-900 gap-1"
                >
                  {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiado ? "Copiado" : "Copiar"}
                </Button>
              )}
              {podeEditar && (
                <Button
                  size="sm"
                  onClick={handleSalvar}
                  disabled={updateMutation.isPending}
                  className="h-7 gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white px-3"
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
