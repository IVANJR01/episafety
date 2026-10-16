import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  Loader2,
  Users,
  Search,
  Layers,
  Stethoscope,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { CLASSE_TEXT, GRUPO_LABEL } from "@/lib/pgrMatriz";
import { sugerirExamesCompletosNr07, ExameCatalogoItem } from "@/lib/pcmsoCatalogoExames";
import PcmsoExameModal, { DadosExameGes } from "./PcmsoExameModal";
import { toast } from "sonner";

function formatarCodigoGes(cod?: string): string {
  if (!cod) return "GES 01";
  const num = cod.replace(/\D/g, "");
  if (num) {
    return `GES ${num.padStart(2, "0")}`;
  }
  return cod.toUpperCase();
}

function extrairNumGes(cod?: string): number {
  if (!cod) return 9999;
  const num = cod.replace(/\D/g, "");
  return num ? parseInt(num, 10) : 9999;
}

/**
 * Retorna as sugestões normativas de forma segura e retrocompatível,
 * blindando o componente contra caches antigos ou campos vazios.
 */
function obterSugestoesItem(item: any): ExameCatalogoItem[] {
  if (!item) return [];
  if (Array.isArray(item.examesSugeridos) && item.examesSugeridos.length > 0) {
    return item.examesSugeridos;
  }
  if (Array.isArray(item.exames) && item.exames.length > 0) {
    return item.exames;
  }
  return sugerirExamesCompletosNr07(item.grupo, item.risco, item.fonte) || [];
}

interface PcmsoMatrizTabProps {
  pcmso: any;
}

export default function PcmsoMatrizTab({ pcmso }: PcmsoMatrizTabProps) {
  const queryClient = useQueryClient();
  const [pgrIdAtivo, setPgrIdAtivo] = useState<string | null>(pcmso.pgr_base_id || null);
  const [busca, setBusca] = useState("");
  const [aplicandoLote, setAplicandoLote] = useState(false);

  // Estado do Modal de Edição/Adição de Exame
  const [modalAberto, setModalAberto] = useState(false);
  const [gesSelecionadoParaExame, setGesSelecionadoParaExame] = useState<{
    gheId: string;
    codigoFormatado: string;
    nome: string;
  } | null>(null);
  const [exameEmEdicao, setExameEmEdicao] = useState<DadosExameGes | null>(null);

  // Se o documento ainda não tem o vínculo salvo, busca o PGR mais recente da empresa e vincula
  useEffect(() => {
    if (pcmso.pgr_base_id) {
      setPgrIdAtivo(pcmso.pgr_base_id);
      return;
    }

    if (!pgrIdAtivo && pcmso.empresa_id) {
      (async () => {
        const { data } = await supabase
          .from("pgr_documentos")
          .select("id, status, versao, data_vigencia_inicio, data_vigencia_fim")
          .eq("empresa_id", pcmso.empresa_id)
          .order("versao", { ascending: false });

        const valido = ((data || []) as any[]).find(
          (p) => p.status !== "arquivado" && p.status !== "substituido"
        );

        if (valido) {
          setPgrIdAtivo(valido.id);
          await supabase
            .from("pcmso_documentos")
            .update({
              pgr_base_id: valido.id,
              data_vigencia_inicio: pcmso.data_vigencia_inicio || valido.data_vigencia_inicio,
              data_vigencia_fim: pcmso.data_vigencia_fim || valido.data_vigencia_fim,
            })
            .eq("id", pcmso.id);
          queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
        }
      })();
    }
  }, [pcmso.pgr_base_id, pcmso.empresa_id, pcmso.id, pgrIdAtivo]);

  // Busca os exames customizados salvos em ghe_exames para a empresa
  const { data: examesSalvos = [], refetch: refetchExames } = useQuery({
    queryKey: ["pcmso-ghe-exames", pcmso.empresa_id],
    queryFn: async () => {
      if (!pcmso.empresa_id) return [];
      const { data, error } = await supabase
        .from("ghe_exames")
        .select("*")
        .eq("empresa_id", pcmso.empresa_id)
        .order("nome_exame");

      if (error) {
        console.error("Erro ao carregar exames do GES:", error);
        return [];
      }
      return (data || []) as DadosExameGes[];
    },
    enabled: !!pcmso.empresa_id,
  });

  // Busca o inventário de riscos do PGR base vinculado e dados de GES e Funções
  const { data: dadosMatriz, isLoading } = useQuery({
    queryKey: ["pcmso-matriz-saude-v3", pgrIdAtivo, pcmso.empresa_id],
    queryFn: async () => {
      if (!pgrIdAtivo || pgrIdAtivo === "none") {
        return { grupos: [], totalRiscos: 0 };
      }

      const [invRes, ghesRes, gheFuncoesRes, sstFuncoesRes, sstSetoresRes] = await Promise.all([
        supabase
          .from("pgr_inventario_itens")
          .select("id, perigo_descricao, fonte_geradora, tipo_agente, grupo, processo, setor, descricao_ambiente, funcoes_snapshot, ghe_id, classificacao, nivel_risco")
          .eq("pgr_id", pgrIdAtivo),
        supabase
          .from("ghe_ges")
          .select("id, codigo, nome, setor")
          .eq("empresa_id", pcmso.empresa_id)
          .order("codigo"),
        supabase
          .from("ghe_funcoes")
          .select("ghe_id, nome_funcao, funcao_id"),
        (supabase.from as any)("sst_funcoes")
          .select("id, nome, setor_id")
          .eq("empresa_id", pcmso.empresa_id),
        (supabase.from as any)("sst_setores")
          .select("id, nome")
          .eq("empresa_id", pcmso.empresa_id),
      ]);

      if (invRes.error) throw invRes.error;

      const ghesData: any[] = ghesRes.data || [];
      const gheFuncoesData: any[] = gheFuncoesRes.data || [];
      const sstFuncoesData: any[] = sstFuncoesRes.data || [];
      const sstSetoresData: any[] = sstSetoresRes.data || [];

      // Mapeia funções por ghe_id
      const funcoesPorGheId = new Map<string, Set<string>>();
      for (const f of gheFuncoesData) {
        if (!f.ghe_id) continue;
        const set = funcoesPorGheId.get(f.ghe_id) || new Set<string>();
        if (f.nome_funcao) set.add(f.nome_funcao.trim());
        funcoesPorGheId.set(f.ghe_id, set);
      }

      // Mapeia funções por setor_id ou nome do setor
      const funcoesPorSetorNome = new Map<string, Set<string>>();
      for (const set of sstSetoresData) {
        const funcsDoSetor = sstFuncoesData.filter((f: any) => f.setor_id === set.id);
        if (funcsDoSetor.length > 0) {
          const nomeSetorNorm = (set.nome || "").trim().toUpperCase();
          const s = funcoesPorSetorNome.get(nomeSetorNorm) || new Set<string>();
          for (const f of funcsDoSetor) {
            if (f.nome) s.add(f.nome.trim());
          }
          funcoesPorSetorNome.set(nomeSetorNorm, s);
        }
      }

      // Itens formatados do inventário
      const itensMapeados = (invRes.data || []).map((r: any) => {
        const gesObj = ghesData.find((g: any) => g.id === r.ghe_id);
        const codOriginal = gesObj?.codigo || r.ghe_id || "01";
        const codigoFormatado = formatarCodigoGes(codOriginal);
        const codigoNum = extrairNumGes(codOriginal);

        // Resolução inteligente da Fonte Geradora e do Risco Ocupacional
        let fonte = (r.fonte_geradora || "").trim();
        let risco = (r.tipo_agente || "").trim();
        const perigo = (r.perigo_descricao || "").trim();
        const grupoNome = GRUPO_LABEL[r.grupo] || r.grupo || "Geral";

        if (!fonte) {
          if (risco && perigo) {
            fonte = perigo;
          } else if (perigo) {
            fonte = perigo;
            risco = risco || grupoNome;
          } else {
            fonte = (r.processo || r.descricao_ambiente || r.setor || "Posto de Trabalho").trim();
            risco = risco || grupoNome;
          }
        }

        if (!risco) {
          risco = perigo || grupoNome;
        }

        // Funções do item (snapshot ou vinculadas ao GES)
        const funcoesItemSet = new Set<string>();
        if (Array.isArray(r.funcoes_snapshot)) {
          for (const fn of r.funcoes_snapshot) {
            if (fn && typeof fn === "string") funcoesItemSet.add(fn.trim());
          }
        } else if (typeof r.funcoes_snapshot === "string" && r.funcoes_snapshot) {
          funcoesItemSet.add(r.funcoes_snapshot.trim());
        }

        if (r.ghe_id && funcoesPorGheId.has(r.ghe_id)) {
          for (const fn of funcoesPorGheId.get(r.ghe_id)!) {
            funcoesItemSet.add(fn);
          }
        }

        const setorNome = (r.setor || gesObj?.setor || gesObj?.nome || "").trim().toUpperCase();
        if (setorNome && funcoesPorSetorNome.has(setorNome)) {
          for (const fn of funcoesPorSetorNome.get(setorNome)!) {
            funcoesItemSet.add(fn);
          }
        }

        // Sugestão normativa detalhada para o risco
        const examesSugeridos = sugerirExamesCompletosNr07(r.grupo, risco, fonte) || [];

        return {
          ...r,
          gesId: r.ghe_id || gesObj?.id || "sem_ges",
          gesNome: gesObj?.nome || r.setor || "Geral",
          setor: r.setor || gesObj?.setor || "—",
          codigoFormatado,
          codigoNum,
          risco,
          fonte,
          funcoes: Array.from(funcoesItemSet),
          exames: examesSugeridos,
          examesSugeridos,
        };
      });

      // Agrupa por GES
      const mapaGrupos = new Map<string, {
        gesId: string;
        codigoFormatado: string;
        codigoNum: number;
        nome: string;
        setor: string;
        funcoes: Set<string>;
        itens: any[];
      }>();

      for (const item of itensMapeados) {
        const chave = item.codigoFormatado;
        if (!mapaGrupos.has(chave)) {
          mapaGrupos.set(chave, {
            gesId: item.gesId,
            codigoFormatado: item.codigoFormatado,
            codigoNum: item.codigoNum,
            nome: item.gesNome,
            setor: item.setor,
            funcoes: new Set<string>(item.funcoes),
            itens: [],
          });
        }
        const g = mapaGrupos.get(chave)!;
        for (const f of item.funcoes) g.funcoes.add(f);
        g.itens.push(item);
      }

      // Converte para lista ordenada por número do GES (01, 02, 03...)
      const grupos = Array.from(mapaGrupos.values()).map((g) => ({
        ...g,
        funcoes: Array.from(g.funcoes),
      }));

      grupos.sort((a, b) => {
        if (a.codigoNum !== b.codigoNum) return a.codigoNum - b.codigoNum;
        return a.codigoFormatado.localeCompare(b.codigoFormatado);
      });

      return {
        grupos,
        totalRiscos: itensMapeados.length,
      };
    },
    enabled: !!pgrIdAtivo && pgrIdAtivo !== "none",
  });

  // Filtragem pela busca
  const gruposFiltrados = useMemo(() => {
    if (!dadosMatriz?.grupos) return [];
    if (!busca.trim()) return dadosMatriz.grupos;

    const termo = busca.toLowerCase();
    return dadosMatriz.grupos
      .map((g) => {
        const matchGes = g.codigoFormatado.toLowerCase().includes(termo) ||
          g.nome.toLowerCase().includes(termo) ||
          g.setor.toLowerCase().includes(termo) ||
          g.funcoes.some((f) => f.toLowerCase().includes(termo));

        const itensFiltrados = g.itens.filter((i) =>
          matchGes ||
          i.risco.toLowerCase().includes(termo) ||
          i.fonte.toLowerCase().includes(termo) ||
          (i.grupo && i.grupo.toLowerCase().includes(termo))
        );

        if (matchGes || itensFiltrados.length > 0) {
          return {
            ...g,
            itens: matchGes ? g.itens : itensFiltrados,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof dadosMatriz.grupos;
  }, [dadosMatriz, busca]);

  // Modal handlers
  const handleAbrirNovoExame = (g: { gesId: string; codigoFormatado: string; nome: string }) => {
    setGesSelecionadoParaExame({
      gheId: g.gesId,
      codigoFormatado: g.codigoFormatado,
      nome: g.nome,
    });
    setExameEmEdicao(null);
    setModalAberto(true);
  };

  const handleAbrirEditarExame = (
    g: { gesId: string; codigoFormatado: string; nome: string },
    exame: DadosExameGes
  ) => {
    setGesSelecionadoParaExame({
      gheId: g.gesId,
      codigoFormatado: g.codigoFormatado,
      nome: g.nome,
    });
    setExameEmEdicao(exame);
    setModalAberto(true);
  };

  const handleSalvarExame = async (dados: DadosExameGes) => {
    if (dados.id) {
      const { error } = await supabase
        .from("ghe_exames")
        .update({
          codigo_exame: dados.codigo_exame,
          nome_exame: dados.nome_exame,
          tipo_exame: dados.tipo_exame,
          obrigatorio: dados.obrigatorio,
          aparece_aso: dados.aparece_aso,
          admissional: dados.admissional,
          periodico: dados.periodico,
          retorno_trabalho: dados.retorno_trabalho,
          mudanca_risco: dados.mudanca_risco,
          mudanca_funcao: dados.mudanca_funcao,
          demissional: dados.demissional,
          periodicidade_meses: dados.periodicidade_meses,
          observacao: dados.observacao,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dados.id);

      if (error) throw error;
      toast.success("Exame atualizado com sucesso!");
    } else {
      const { error } = await supabase.from("ghe_exames").insert({
        empresa_id: dados.empresa_id,
        ghe_id: dados.ghe_id,
        codigo_exame: dados.codigo_exame,
        nome_exame: dados.nome_exame,
        tipo_exame: dados.tipo_exame,
        obrigatorio: dados.obrigatorio,
        aparece_aso: dados.aparece_aso,
        admissional: dados.admissional,
        periodico: dados.periodico,
        retorno_trabalho: dados.retorno_trabalho,
        mudanca_risco: dados.mudanca_risco,
        mudanca_funcao: dados.mudanca_funcao,
        demissional: dados.demissional,
        periodicidade_meses: dados.periodicidade_meses,
        observacao: dados.observacao,
      });

      if (error) throw error;
      toast.success("Exame adicionado ao GES com sucesso!");
    }

    refetchExames();
    queryClient.invalidateQueries({ queryKey: ["pcmso-ghe-exames"] });
  };

  const handleExcluirExame = async (exameId: string, nomeExame: string) => {
    if (!confirm(`Remover o exame "${nomeExame}" deste GES?`)) return;

    try {
      const { error } = await supabase.from("ghe_exames").delete().eq("id", exameId);
      if (error) throw error;
      toast.success("Exame removido com sucesso.");
      refetchExames();
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e.message}`);
    }
  };

  // Aplica sugestões da NR-07 em lote para o GES ou para todos os GES
  const handleGravarSugestoesParaGes = async (g: any) => {
    if (!g.gesId || g.gesId === "sem_ges") {
      toast.error("Este GES não possui identificador válido para vínculo.");
      return;
    }

    try {
      // Coleta todas as sugestões do GES
      const mapaSugestoes = new Map<string, ExameCatalogoItem>();
      for (const item of (g?.itens || [])) {
        for (const sug of obterSugestoesItem(item)) {
          if (!mapaSugestoes.has(sug.codigo)) {
            mapaSugestoes.set(sug.codigo, sug);
          }
        }
      }

      const lista = Array.from(mapaSugestoes.values());
      if (lista.length === 0) {
        toast.info("Nenhuma sugestão normativa aplicável encontrada.");
        return;
      }

      const inserts = lista.map((s) => ({
        empresa_id: pcmso.empresa_id,
        ghe_id: g.gesId,
        codigo_exame: s.codigo,
        nome_exame: s.nome,
        tipo_exame: s.tipo,
        obrigatorio: true,
        aparece_aso: true,
        admissional: s.admissional,
        periodico: s.periodico,
        retorno_trabalho: s.retornoTrabalho,
        mudanca_risco: s.mudancaRisco,
        mudanca_funcao: s.mudancaRisco,
        demissional: s.demissional,
        periodicidade_meses: s.periodicidadeMeses,
        observacao: s.observacaoPadrao,
      }));

      const { error } = await supabase.from("ghe_exames").insert(inserts);
      if (error) throw error;

      toast.success(`Sugestões da NR-07 gravadas com sucesso no ${g.codigoFormatado}!`);
      refetchExames();
    } catch (e: any) {
      toast.error(`Erro ao gravar sugestões: ${e.message}`);
    }
  };

  const handleAplicarSugestoesTodosGes = async () => {
    if (!dadosMatriz?.grupos || dadosMatriz.grupos.length === 0) return;
    if (!confirm("Deseja aplicar as sugestões da NR-07 nos grupos que ainda não possuem exames salvos?")) return;

    try {
      setAplicandoLote(true);
      let totalGravados = 0;

      for (const g of dadosMatriz.grupos) {
        if (!g.gesId || g.gesId === "sem_ges") continue;
        const jaTem = examesSalvos.filter((e) => e.ghe_id === g.gesId);
        if (jaTem.length > 0) continue; // Pula os que já têm customização

        const mapaSugestoes = new Map<string, ExameCatalogoItem>();
        for (const item of (g?.itens || [])) {
          for (const sug of obterSugestoesItem(item)) {
            if (!mapaSugestoes.has(sug.codigo)) {
              mapaSugestoes.set(sug.codigo, sug);
            }
          }
        }

        const lista = Array.from(mapaSugestoes.values());
        if (lista.length > 0) {
          const inserts = lista.map((s) => ({
            empresa_id: pcmso.empresa_id,
            ghe_id: g.gesId,
            codigo_exame: s.codigo,
            nome_exame: s.nome,
            tipo_exame: s.tipo,
            obrigatorio: true,
            aparece_aso: true,
            admissional: s.admissional,
            periodico: s.periodico,
            retorno_trabalho: s.retornoTrabalho,
            mudanca_risco: s.mudancaRisco,
            mudanca_funcao: s.mudancaRisco,
            demissional: s.demissional,
            periodicidade_meses: s.periodicidadeMeses,
            observacao: s.observacaoPadrao,
          }));

          await supabase.from("ghe_exames").insert(inserts);
          totalGravados += lista.length;
        }
      }

      toast.success(`Base normativa da NR-07 aplicada! ${totalGravados} exames cadastrados.`);
      refetchExames();
    } catch (e: any) {
      toast.error(`Erro ao aplicar em lote: ${e.message}`);
    } finally {
      setAplicandoLote(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-amber-500" /> Matriz de Exames Ocupacionais (NR-07 articulada com PGR)
              </CardTitle>
              <CardDescription className="mt-1">
                Matriz de correspondência obrigatória entre os riscos identificados no PGR e a prescrição
                de exames ocupacionais (Art. 7.5.6 e Anexos da NR-07). Personalize e adicione exames por GES e função.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAplicarSugestoesTodosGes}
                disabled={aplicandoLote || !dadosMatriz?.grupos?.length}
                className="text-xs gap-1.5 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-900 dark:text-amber-200"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                {aplicandoLote ? "Aplicando..." : "Aplicar Sugestões NR-07 em Todos"}
              </Button>

              {dadosMatriz && dadosMatriz.grupos.length > 0 && (
                <div className="relative w-full md:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar GES, função, risco..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {dadosMatriz && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <strong>{dadosMatriz.grupos.length}</strong> Grupo(s) GES Mapeados
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-amber-500" />
                <strong>{dadosMatriz.totalRiscos}</strong> Risco(s) no Inventário
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                <strong>{examesSalvos.length}</strong> Exame(s) Customizado(s) no PCMSO
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
                Conforme <strong>Portaria MTP nº 6.734/2020</strong>
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {!pgrIdAtivo ? (
            <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-800 dark:text-amber-500 text-center gap-3">
              <AlertTriangle className="h-8 w-8" />
              <p className="font-medium">Nenhum PGR Base Vinculado</p>
              <p className="text-sm">
                Volte para a aba "Configuração Básica" e selecione o PGR de origem para habilitar a importação automática da matriz de saúde.
              </p>
            </div>
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Carregando e organizando a matriz por GES e Funções...</span>
            </div>
          ) : !dadosMatriz || dadosMatriz.grupos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              O PGR selecionado não possui riscos mapeados em seu inventário.
            </div>
          ) : gruposFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum resultado encontrado para a busca "{busca}".
            </div>
          ) : (
            <div className="space-y-8">
              {gruposFiltrados.map((g) => {
                const examesDesteGes = examesSalvos.filter((e) => e.ghe_id === g.gesId);
                const temExamesSalvos = examesDesteGes.length > 0;

                // Sugestões combinadas dos riscos para caso ainda não tenha exames salvos
                const mapaSugestoes = new Map<string, ExameCatalogoItem>();
                for (const item of (g?.itens || [])) {
                  for (const sug of obterSugestoesItem(item)) {
                    if (!mapaSugestoes.has(sug.codigo)) {
                      mapaSugestoes.set(sug.codigo, sug);
                    }
                  }
                }
                const sugestoesLista = Array.from(mapaSugestoes.values());

                return (
                  <div
                    key={g.codigoFormatado}
                    className="rounded-lg border bg-card shadow-sm overflow-hidden"
                  >
                    {/* Cabeçalho do Grupo GES */}
                    <div className="bg-muted/40 p-3.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary hover:bg-primary text-primary-foreground font-mono font-semibold text-xs px-2.5 py-1 tracking-wide">
                          {g.codigoFormatado}
                        </Badge>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                            {g.nome}
                          </h4>
                          {g.setor && g.setor !== g.nome && g.setor !== "—" && (
                            <span className="text-xs text-muted-foreground">
                              Setor: <strong className="text-foreground">{g.setor}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Exibição das Funções / Cargos */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span>Funções / Cargos:</span>
                        </div>
                        {g.funcoes.length > 0 ? (
                          g.funcoes.map((fn, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs font-normal bg-background border border-border shadow-2xs"
                            >
                              {fn}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                            (Não especificada no cadastro)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SEÇÃO 1: EXAMES OCUPACIONAIS PRESCRITOS PARA ESTE GES (INTERATIVO / EDITÁVEL) */}
                    <div className="p-3.5 bg-slate-50/70 dark:bg-slate-900/30 border-b">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Exames Ocupacionais Prescritos (NR-07 / PCMSO Oficial)
                          </span>
                          {temExamesSalvos ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-300">
                              Personalizado ({examesDesteGes.length})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-300">
                              Sugestão Automática NR-07
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!temExamesSalvos && sugestoesLista.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGravarSugestoesParaGes(g)}
                              className="h-7 text-xs text-primary gap-1"
                            >
                              <Sparkles className="h-3 w-3 text-amber-500" /> Gravar Sugestões
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleAbrirNovoExame(g)}
                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Plus className="h-3.5 w-3.5" /> Adicionar Exame
                          </Button>
                        </div>
                      </div>

                      {/* Lista dos Exames do GES */}
                      {temExamesSalvos ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                          {examesDesteGes.map((ex) => {
                            const isAudio = ex.nome_exame.toLowerCase().includes("audiometria") || ex.codigo_exame === "0935";
                            const isFono = ex.observacao?.toLowerCase().includes("fonoaudiól") || isAudio;

                            return (
                              <div
                                key={ex.id}
                                className="flex flex-col justify-between p-2.5 rounded-lg border bg-background shadow-2xs hover:border-slate-300 transition-colors"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                                        {ex.codigo_exame || "0000"}
                                      </Badge>
                                      <span className="font-semibold text-xs text-foreground">
                                        {ex.nome_exame}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleAbrirEditarExame(g, ex)}
                                        title="Editar este exame"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleExcluirExame(ex.id!, ex.nome_exame)}
                                        title="Remover exame do GES"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Badges de periodicidade e ASO */}
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800"
                                    >
                                      Periódico: {ex.periodico ? (ex.periodicidade_meses === 6 ? "Semestral" : ex.periodicidade_meses === 24 ? "Bienal" : "Anual") : "Não aplicável"}
                                    </Badge>

                                    {isFono && (
                                      <Badge className="text-[10px] font-normal bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200">
                                        Fonoaudiólogo(a) / CRFa
                                      </Badge>
                                    )}

                                    {ex.admissional && (
                                      <span className="text-[10px] text-muted-foreground">ADM</span>
                                    )}
                                    {ex.retorno_trabalho && (
                                      <span className="text-[10px] text-muted-foreground">• RT</span>
                                    )}
                                    {ex.mudanca_risco && (
                                      <span className="text-[10px] text-muted-foreground">• MRO</span>
                                    )}
                                    {ex.demissional && (
                                      <span className="text-[10px] text-muted-foreground">• DEM</span>
                                    )}
                                  </div>

                                  {ex.observacao && (
                                    <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 italic">
                                      {ex.observacao}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs text-muted-foreground">
                            Este GES ainda não possui exames gravados. Abaixo estão as <strong>sugestões automáticas da NR-07</strong> baseadas nos riscos do PGR:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {sugestoesLista.map((sug, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2.5 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/10 text-xs flex flex-col justify-between gap-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">
                                    [{sug.codigo}] {sug.nome}
                                  </span>
                                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                    {sug.baseNormativa.split("(")[0]}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>{sug.periodicidadePadrao}</span>
                                  <span className="text-[10px]">{sug.profissionalLabel}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SEÇÃO 2: TABELA DE RISCOS OCUPACIONAIS MAPEADOS NO PGR */}
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="w-[30%]">Risco Ocupacional (PGR)</TableHead>
                          <TableHead className="w-[30%]">Fonte Geradora</TableHead>
                          <TableHead className="w-[100px] text-center">Grau</TableHead>
                          <TableHead className="w-[30%]">Exames Recomendados (NR-07)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.itens.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-foreground">{r.risco || "-"}</span>
                                {r.grupo && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Grupo: {GRUPO_LABEL[r.grupo] || r.grupo}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground font-medium text-xs">
                              {r.fonte || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {r.classificacao && (
                                <Badge variant="outline" className={CLASSE_TEXT[r.classificacao as keyof typeof CLASSE_TEXT] || ""}>
                                  {r.classificacao.toUpperCase()}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {obterSugestoesItem(r).map((ex: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="text-xs flex items-center justify-between py-0.5 border-b border-border/40 last:border-none"
                                  >
                                    <span className="font-medium text-foreground">{ex.nome}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                                      {ex.baseNormativa ? ex.baseNormativa.split("(")[0] : "NR-07"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Adicionar / Editar Exame */}
      {gesSelecionadoParaExame && (
        <PcmsoExameModal
          open={modalAberto}
          onOpenChange={setModalAberto}
          empresaId={pcmso.empresa_id}
          gheId={gesSelecionadoParaExame.gheId}
          gesCodigo={gesSelecionadoParaExame.codigoFormatado}
          gesNome={gesSelecionadoParaExame.nome}
          exameEmEdicao={exameEmEdicao}
          onSalvar={handleSalvarExame}
        />
      )}
    </div>
  );
}
