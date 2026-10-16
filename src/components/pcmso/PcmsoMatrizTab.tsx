import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Loader2,
  Search,
  Stethoscope,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";
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
 * Retorna as sugestões normativas de forma segura e retrocompatível.
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
  const [expandirRiscosGes, setExpandirRiscosGes] = useState<Record<string, boolean>>({});

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
        riscosResumo: Set<string>;
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
            riscosResumo: new Set<string>(),
            itens: [],
          });
        }
        const g = mapaGrupos.get(chave)!;
        for (const f of item.funcoes) g.funcoes.add(f);
        if (item.risco) g.riscosResumo.add(item.risco);
        g.itens.push(item);
      }

      const grupos = Array.from(mapaGrupos.values()).map((g) => ({
        ...g,
        funcoes: Array.from(g.funcoes),
        riscosResumo: Array.from(g.riscosResumo),
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

  const toggleRiscos = (chave: string) => {
    setExpandirRiscosGes((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }));
  };

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
      toast.success("Exame atualizado!");
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
      toast.success("Exame adicionado com sucesso!");
    }

    refetchExames();
    queryClient.invalidateQueries({ queryKey: ["pcmso-ghe-exames"] });
  };

  const handleExcluirExame = async (exameId: string, nomeExame: string) => {
    if (!confirm(`Remover "${nomeExame}" deste GES?`)) return;

    try {
      const { error } = await supabase.from("ghe_exames").delete().eq("id", exameId);
      if (error) throw error;
      toast.success("Exame removido.");
      refetchExames();
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e.message}`);
    }
  };

  const handleAplicarSugestoesTodosGes = async () => {
    if (!dadosMatriz?.grupos || dadosMatriz.grupos.length === 0) return;

    try {
      setAplicandoLote(true);
      let totalGravados = 0;

      for (const g of dadosMatriz.grupos) {
        if (!g.gesId || g.gesId === "sem_ges") continue;
        const jaTem = examesSalvos.filter((e) => e.ghe_id === g.gesId);
        if (jaTem.length > 0) continue;

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

      toast.success(`Base da NR-07 aplicada! ${totalGravados} exames cadastrados.`);
      refetchExames();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setAplicandoLote(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* CABEÇALHO ENXUTO E DIRETO AO PONTO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-emerald-600" /> Matriz de Exames Ocupacionais (NR-07)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exames prescritos por Grupo Homogêneo de Exposição (GES) articulados com o PGR.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {examesSalvos.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAplicarSugestoesTodosGes}
              disabled={aplicandoLote || !dadosMatriz?.grupos?.length}
              className="text-xs gap-1.5 h-8 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {aplicandoLote ? "Aplicando..." : "Preencher com Sugestões NR-07"}
            </Button>
          )}

          {dadosMatriz && dadosMatriz.grupos.length > 0 && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar GES, função ou exame..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {!pgrIdAtivo ? (
        <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-800 dark:text-amber-500 text-center gap-2">
          <AlertTriangle className="h-7 w-7" />
          <p className="font-medium text-sm">Nenhum PGR Base Vinculado</p>
          <p className="text-xs text-muted-foreground">
            Vincule o PGR na aba "Configuração Básica" para carregar a matriz.
          </p>
        </div>
      ) : isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando exames por GES...</span>
        </div>
      ) : !dadosMatriz || dadosMatriz.grupos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          O PGR selecionado não possui riscos mapeados.
        </div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Nenhum resultado para a busca "{busca}".
        </div>
      ) : (
        /* LISTA LIMPA E OBJETIVA DE GRUPOS GES */
        <div className="space-y-4">
          {gruposFiltrados.map((g) => {
            const examesDesteGes = examesSalvos.filter((e) => e.ghe_id === g.gesId);
            const temExamesSalvos = examesDesteGes.length > 0;

            // Se não tem exames salvos, consolida as sugestões normativas da NR-07
            const mapaSugestoes = new Map<string, ExameCatalogoItem>();
            for (const item of (g?.itens || [])) {
              for (const sug of obterSugestoesItem(item)) {
                if (!mapaSugestoes.has(sug.codigo)) {
                  mapaSugestoes.set(sug.codigo, sug);
                }
              }
            }
            const sugestoesLista = Array.from(mapaSugestoes.values());
            const expandido = !!expandirRiscosGes[g.codigoFormatado];

            return (
              <Card key={g.codigoFormatado} className="shadow-2xs border overflow-hidden">
                {/* TOPO COMPACTO DO GES */}
                <div className="bg-slate-50/80 dark:bg-slate-900/40 p-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900">
                        {g.codigoFormatado}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground">
                        {g.nome}
                      </span>
                      {g.setor && g.setor !== g.nome && g.setor !== "—" && (
                        <span className="text-xs text-muted-foreground">
                          · {g.setor}
                        </span>
                      )}
                    </div>

                    {/* Funções do GES em texto limpo */}
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <strong className="text-foreground font-medium">Funções:</strong>{" "}
                      {g.funcoes.length > 0 ? g.funcoes.join(", ") : "Não especificada"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleRiscos(g.codigoFormatado)}
                      className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                    >
                      {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {g.itens.length} risco(s) PGR
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleAbrirNovoExame(g)}
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Plus className="h-3 w-3" /> Adicionar Exame
                    </Button>
                  </div>
                </div>

                {/* TABELA ÚNICA DE EXAMES OCUPACIONAIS DO GES (SEM DUPLICAÇÃO) */}
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/10 text-[11px]">
                      <TableRow>
                        <TableHead className="w-[40%] py-2 text-foreground font-semibold">Exame Ocupacional</TableHead>
                        <TableHead className="w-[18%] py-2 text-foreground font-semibold">Periodicidade</TableHead>
                        <TableHead className="w-[20%] py-2 text-foreground font-semibold">Exigido nos ASOs</TableHead>
                        <TableHead className="w-[12%] py-2 text-foreground font-semibold">Responsável</TableHead>
                        <TableHead className="w-[10%] py-2 text-right text-foreground font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {temExamesSalvos ? (
                        examesDesteGes.map((ex) => {
                          const isAudio = ex.nome_exame.toLowerCase().includes("audiometria") || ex.codigo_exame === "0935";
                          const isFono = ex.observacao?.toLowerCase().includes("fonoaudiól") || isAudio;
                          const perStr = ex.periodico
                            ? ex.periodicidade_meses === 6
                              ? "Semestral"
                              : ex.periodicidade_meses === 24
                              ? "Bienal"
                              : "Anual"
                            : "—";

                          const asosList = [
                            ex.admissional ? "ADM" : null,
                            ex.periodico ? "Periódico" : null,
                            ex.retorno_trabalho ? "Retorno" : null,
                            ex.mudanca_risco ? "Mudança" : null,
                            ex.demissional ? "DEM" : null,
                          ].filter(Boolean);

                          return (
                            <TableRow key={ex.id} className="text-xs hover:bg-muted/5">
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                                    {ex.codigo_exame || "0295"}
                                  </Badge>
                                  <span className="font-medium text-foreground">{ex.nome_exame}</span>
                                </div>
                                {ex.observacao && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                                    {ex.observacao}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-muted-foreground font-medium">
                                {perStr}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="text-[11px] text-muted-foreground">
                                  {asosList.join(", ") || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                {isFono ? (
                                  <Badge className="text-[10px] font-normal bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-none">
                                    Fonoaudiólogo
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] font-normal">
                                    Médico
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleAbrirEditarExame(g, ex)}
                                    title="Editar exame"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleExcluirExame(ex.id!, ex.nome_exame)}
                                    title="Excluir exame"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        /* Se não tem exames salvos, exibe as sugestões normativas de forma elegante e limpa */
                        sugestoesLista.map((sug, sIdx) => (
                          <TableRow key={sIdx} className="text-xs hover:bg-muted/5 bg-slate-50/30 dark:bg-slate-900/10">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 text-amber-700 dark:text-amber-400 border-amber-300">
                                  {sug.codigo}
                                </Badge>
                                <span className="font-medium text-foreground">{sug.nome}</span>
                                <Badge variant="secondary" className="text-[9px] bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-none">
                                  Sugerido NR-07
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground font-medium">
                              {sug.periodicidadePadrao}
                            </TableCell>
                            <TableCell className="py-2.5 text-muted-foreground text-[11px]">
                              Admissional, Periódico, Demissional
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {sug.profissionalSugerido === "fonoaudiologo" ? "Fonoaudiólogo" : "Médico"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] text-primary hover:text-primary gap-1 px-1.5"
                                onClick={() => handleAbrirNovoExame(g)}
                              >
                                Personalizar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {/* PAINEL COLAPSÁVEL DISCRETO COM OS RISCOS DO PGR (APENAS SE O USUÁRIO QUISER CONFERIR) */}
                  {expandido && (
                    <div className="p-3 bg-muted/15 border-t text-xs space-y-2">
                      <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                        Riscos Inventariados no PGR para este GES:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {g.itens.map((it: any) => (
                          <div
                            key={it.id}
                            className="p-2 rounded border bg-background text-[11px] flex justify-between gap-2"
                          >
                            <div>
                              <span className="font-medium text-foreground">{it.risco}</span>
                              <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1">
                                Fonte: {it.fonte}
                              </p>
                            </div>
                            {it.classificacao && (
                              <Badge variant="outline" className="text-[9px] self-start uppercase">
                                {it.classificacao}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
