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

  // O Relatório Analítico pode ser editado tanto em rascunho quanto em vigente,
  // pois é a obrigação contínua anual da NR-07 (item 7.6.2).
  const isDocumentoCancelado = pcmso.status === "cancelado" || pcmso.status === "arquivado";
  const podeEditar = !isDocumentoCancelado;

  return (
    <div className="space-y-6">
      {/* Resumo Integrado das Métricas de ASOs (Banco de Dados em tempo real) */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Métricas de Saúde e ASOs do Banco de Dados
          </h3>
          <p className="text-xs text-muted-foreground">
            Dados vivos sincronizados em tempo real com as emissões no módulo de Saúde.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            refetchAsos();
            toast.info("Dados de ASOs sincronizados!");
          }}
          disabled={recarregandoAsos}
          className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recarregandoAsos ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

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

      {/* Banner de Ação Rápida quando o Relatório estiver vazio */}
      {(!relatorio || relatorio.trim() === "") && podeEditar && (
        <div className="p-4 bg-linear-to-r from-rose-50 via-amber-50/40 to-orange-50 border border-rose-200 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
              <p className="text-sm font-bold text-slate-800">
                Como trazer os dados para o Relatório Analítico?
              </p>
              <Badge variant="outline" className="text-[10px] bg-rose-100/60 text-rose-800 border-rose-300">
                NR-07 Item 7.6.2
              </Badge>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              O sistema localizou <b>{metricas.total} ASO(s)</b> emitido(s) para esta empresa.
              Clique no botão ao lado para preencher automaticamente as estatísticas de exames clínicos,
              aptidões e a estrutura oficial do parecer do Médico Coordenador:
            </p>
          </div>
          <Button
            onClick={gerarEstatisticas}
            disabled={loadingAsos}
            className="bg-rose-600 hover:bg-rose-700 text-white shrink-0 text-xs font-semibold gap-2 shadow-sm h-10 px-4"
          >
            {loadingAsos ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Trazer Dados dos ASOs Agora
          </Button>
        </div>
      )}

      <Card className="border-t-4 border-t-rose-600 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileBarChart className="h-5 w-5 text-rose-600" /> Relatório Analítico (NR-07 — Subitem 7.6.2)
                </CardTitle>
                {pcmso.status === "vigente" && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                    Documento Vigente
                  </Badge>
                )}
              </div>
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
              <div className="flex items-center gap-2">
                {relatorio && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopiar}
                    className="text-xs gap-1 text-slate-600 hover:text-slate-900 h-8"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? "Copiado!" : "Copiar"}
                  </Button>
                )}
                {podeEditar && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={gerarEstatisticas}
                    disabled={loadingAsos}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs gap-1.5 h-8 font-medium"
                  >
                    {loadingAsos ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bot className="h-3.5 w-3.5 text-rose-600" />
                    )}
                    {relatorio ? "Atualizar com Dados dos ASOs" : "Importar Estatísticas Automáticas dos ASOs"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Textarea
                value={relatorio}
                onChange={(e) => setRelatorio(e.target.value)}
                placeholder="Insira os dados quantitativos de ASOs emitidos, alterações encontradas, evolução de queixas..."
                className="min-h-[300px] font-mono text-xs leading-relaxed"
                disabled={!podeEditar}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  💡 Clique em <b>"Importar Estatísticas Automáticas dos ASOs"</b> para puxar as métricas de ASOs em tempo real e em seguida edite o parecer técnico do médico.
                </p>
                {relatorio && (
                  <span className="text-[11px] text-slate-400">
                    {relatorio.length} caracteres
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {podeEditar && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {pcmso.status === "vigente"
              ? "Este PCMSO está vigente. As alterações no Relatório Analítico serão salvas no documento oficial."
              : "As alterações serão salvas na minuta do PCMSO."}
          </p>
          <Button
            onClick={handleSalvar}
            disabled={updateMutation.isPending}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Relatório Analítico
          </Button>
        </div>
      )}
    </div>
  );
}
