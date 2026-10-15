import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  QrCode,
  FileSpreadsheet,
  Search,
  MoreVertical,
  Wrench,
  ClipboardCheck,
  Edit2,
  Trash2,
  RefreshCw,
  Building2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/pdfTimbrado";
import { ExtintorFormDialog } from "./ExtintorFormDialog";
import { ExtintorInspecaoDialog } from "./ExtintorInspecaoDialog";
import { ExtintorManutencaoDialog } from "./ExtintorManutencaoDialog";
import { gerarEtiquetasExtintoresPdf } from "@/lib/extintoresEtiquetasPdf";

export default function ExtintoresDashboard() {
  const { empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const [extintores, setExtintores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAgente, setFiltroAgente] = useState("TODOS");
  const [filtroSituacao, setFiltroSituacao] = useState("TODOS");
  const [empresaNome, setEmpresaNome] = useState("Empresa");

  // Modais
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [modalInspecaoOpen, setModalInspecaoOpen] = useState(false);
  const [modalManutencaoOpen, setModalManutencaoOpen] = useState(false);
  const [extintorSelecionado, setExtintorSelecionado] = useState<any | null>(null);

  const carregarDados = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // Carrega nome da empresa
      const { data: empData } = await (supabase.from as any)("empresa_config")
        .select("nome")
        .eq("id", empresaId)
        .maybeSingle();
      if (empData?.nome) setEmpresaNome(empData.nome);

      // Tenta carregar da view calculada vw_extintores_situacao, com fallback para tabela extintores
      let res = await (supabase.from as any)("vw_extintores_situacao")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("numero");

      if (res.error) {
        // Fallback direto na tabela caso a view não exista ainda no banco
        res = await (supabase.from as any)("extintores")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("numero");
      }

      setExtintores(res.data || []);
    } catch (err: any) {
      console.warn("Erro ao carregar extintores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaId]);

  // Cálculos de Situação para cada extintor
  const extintoresCalculados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return extintores.map((ext) => {
      let situacao = ext.situacao_geral || "OK";
      let diasParaRecarga: number | null = null;
      let diasSemInspecao: number | null = null;

      if (ext.status === "BAIXADO") {
        situacao = "BAIXADO";
      } else {
        if (ext.data_proxima_recarga) {
          const dtRec = new Date(ext.data_proxima_recarga + "T00:00:00");
          diasParaRecarga = Math.round((dtRec.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        }

        if (ext.data_ultima_inspecao) {
          const dtInsp = new Date(ext.data_ultima_inspecao + "T00:00:00");
          diasSemInspecao = Math.round((hoje.getTime() - dtInsp.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Regra de criticidade
        if (
          (diasParaRecarga !== null && diasParaRecarga < 0) ||
          ext.status === "EM_MANUTENCAO" ||
          ext.ultima_inspecao_resultado === "NAO_CONFORME"
        ) {
          situacao = "CRITICO";
        } else if (
          (diasParaRecarga !== null && diasParaRecarga <= 30) ||
          diasParaRecarga === null ||
          (diasSemInspecao !== null && diasSemInspecao > 30) ||
          diasSemInspecao === null
        ) {
          situacao = "ATENCAO";
        } else {
          situacao = "OK";
        }
      }

      return {
        ...ext,
        situacaoCalculada: situacao,
        diasParaRecarga,
        diasSemInspecao,
      };
    });
  }, [extintores]);

  // Filtros
  const extintoresFiltrados = useMemo(() => {
    return extintoresCalculados.filter((ext) => {
      if (filtroAgente !== "TODOS" && ext.agente !== filtroAgente) return false;
      if (filtroSituacao !== "TODOS" && ext.situacaoCalculada !== filtroSituacao) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const num = (ext.numero || "").toLowerCase();
        const setor = (ext.local_setor || "").toLowerCase();
        const desc = (ext.local_descricao || "").toLowerCase();
        const inmetro = (ext.selo_inmetro || "").toLowerCase();
        return num.includes(q) || setor.includes(q) || desc.includes(q) || inmetro.includes(q);
      }
      return true;
    });
  }, [extintoresCalculados, filtroAgente, filtroSituacao, busca]);

  // Contadores
  const metricas = useMemo(() => {
    const total = extintoresCalculados.filter((e) => e.status !== "BAIXADO").length;
    const criticos = extintoresCalculados.filter((e) => e.situacaoCalculada === "CRITICO").length;
    const atencao = extintoresCalculados.filter((e) => e.situacaoCalculada === "ATENCAO").length;
    const ok = extintoresCalculados.filter((e) => e.situacaoCalculada === "OK").length;
    const vencemEm30 = extintoresCalculados.filter(
      (e) => e.diasParaRecarga !== null && e.diasParaRecarga >= 0 && e.diasParaRecarga <= 30
    ).length;
    const atrasadas = extintoresCalculados.filter(
      (e) => e.diasSemInspecao === null || e.diasSemInspecao > 30
    ).length;

    return { total, criticos, atencao, ok, vencemEm30, atrasadas };
  }, [extintoresCalculados]);

  // Excluir extintor
  const handleExcluir = async (ext: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o extintor ${ext.numero}?`)) return;
    try {
      const { error } = await (supabase.from as any)("extintores").delete().eq("id", ext.id);
      if (error) throw error;
      toast({ title: "Extintor removido", description: `TAG ${ext.numero} excluída com sucesso.` });
      carregarDados();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  // Imprimir Etiquetas em PDF
  const handleImprimirEtiquetas = async () => {
    if (extintoresFiltrados.length === 0) {
      toast({ title: "Nenhum extintor", description: "Cadastre ou filtre extintores para gerar etiquetas.", variant: "destructive" });
      return;
    }
    toast({ title: "Gerando etiquetas...", description: "Diagramando folha A4 com QR Codes e dados normativos." });
    try {
      const pdf = await gerarEtiquetasExtintoresPdf(extintoresFiltrados, empresaNome);
      pdf.save(`Etiquetas_Extintores_${empresaNome.replace(/[^A-Za-z0-9]/g, "_")}.pdf`);
      toast({ title: "Etiquetas geradas", description: "Download do PDF iniciado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    }
  };

  const getBadgeSituacao = (sit: string) => {
    switch (sit) {
      case "CRITICO":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white font-medium">🔴 Crítico</Badge>;
      case "ATENCAO":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">🟡 Atenção</Badge>;
      case "OK":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">🟢 Em Dia</Badge>;
      case "BAIXADO":
        return <Badge className="bg-slate-500 text-white font-medium">⚫ Baixado</Badge>;
      default:
        return <Badge variant="outline">{sit}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-7 w-7 text-red-600" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Controle de Extintores de Incêndio
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão preventiva de equipamentos, recargas e inspeções mensais (NR-23 · NBR 12962 · NBR 13434)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button variant="outline" size="sm" onClick={handleImprimirEtiquetas}>
            <QrCode className="h-4 w-4 mr-2 text-primary" />
            Imprimir Etiquetas QR
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setExtintorSelecionado(null);
              setModalFormOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Extintor
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Ativos</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-foreground">{metricas.total}</span>
              <Flame className="h-5 w-5 text-muted-foreground/60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-950 bg-red-50/40 dark:bg-red-950/20">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">Críticos</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-red-700 dark:text-red-400">{metricas.criticos}</span>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Em Atenção</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metricas.atencao}</span>
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-950 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Em Dia (OK)</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metricas.ok}</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Vencem em 30d</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-foreground">{metricas.vencemEm30}</span>
              <Clock className="h-5 w-5 text-muted-foreground/60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-muted-foreground">Inspeção Atrasada</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-foreground">{metricas.atrasadas}</span>
              <ClipboardCheck className="h-5 w-5 text-muted-foreground/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por TAG, setor, localização ou selo Inmetro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-full md:w-[170px]">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas Situações</SelectItem>
            <SelectItem value="CRITICO">🔴 Crítico</SelectItem>
            <SelectItem value="ATENCAO">🟡 Atenção</SelectItem>
            <SelectItem value="OK">🟢 Em Dia</SelectItem>
            <SelectItem value="BAIXADO">⚫ Baixado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroAgente} onValueChange={setFiltroAgente}>
          <SelectTrigger className="w-full md:w-[190px]">
            <SelectValue placeholder="Tipo de Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos Agentes</SelectItem>
            <SelectItem value="PQS_ABC">PQS ABC</SelectItem>
            <SelectItem value="PQS_BC">PQS BC</SelectItem>
            <SelectItem value="CO2">CO2</SelectItem>
            <SelectItem value="AGUA">Água Pressurizada</SelectItem>
            <SelectItem value="ESPUMA">Espuma Mecânica</SelectItem>
            <SelectItem value="CLASSE_K">Classe K</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Extintores */}
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">TAG / Nº</TableHead>
                  <TableHead>Agente / Capacidade</TableHead>
                  <TableHead>Setor / Local</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Próxima Recarga</TableHead>
                  <TableHead>Próximo Teste H.</TableHead>
                  <TableHead>Última Inspeção</TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Carregando dados dos extintores...
                    </TableCell>
                  </TableRow>
                ) : extintoresFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Flame className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">Nenhum extintor encontrado</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setExtintorSelecionado(null);
                            setModalFormOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Cadastrar primeiro extintor
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  extintoresFiltrados.map((ext) => (
                    <TableRow key={ext.id}>
                      <TableCell className="font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{ext.numero}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {ext.agente?.replace(/_/g, " ")} ({ext.classes || "—"})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ext.capacidade} {ext.unidade_capacidade}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{ext.local_setor || "Geral"}</span>
                          {ext.local_descricao && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={ext.local_descricao}>
                              {ext.local_descricao}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>{getBadgeSituacao(ext.situacaoCalculada)}</TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{fmtDate(ext.data_proxima_recarga)}</span>
                          {ext.diasParaRecarga !== null && (
                            <span
                              className={`text-xs ${
                                ext.diasParaRecarga < 0
                                  ? "text-red-600 font-semibold"
                                  : ext.diasParaRecarga <= 30
                                  ? "text-amber-600 font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {ext.diasParaRecarga < 0
                                ? `Vencido há ${Math.abs(ext.diasParaRecarga)} dias`
                                : `Em ${ext.diasParaRecarga} dias`}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">{fmtDate(ext.data_proximo_teste_hidrostatico)}</span>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{fmtDate(ext.data_ultima_inspecao)}</span>
                          {ext.diasSemInspecao !== null && (
                            <span
                              className={`text-xs ${
                                ext.diasSemInspecao > 30 ? "text-amber-600 font-medium" : "text-emerald-600"
                              }`}
                            >
                              {ext.diasSemInspecao > 30 ? "Atrasada (> 30 dias)" : "Inspeção em dia"}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setExtintorSelecionado(ext);
                                setModalInspecaoOpen(true);
                              }}
                            >
                              <ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" />
                              Fazer Inspeção Mensal
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                setExtintorSelecionado(ext);
                                setModalManutencaoOpen(true);
                              }}
                            >
                              <Wrench className="h-4 w-4 mr-2 text-primary" />
                              Lançar Manutenção / Recarga
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                setExtintorSelecionado(ext);
                                setModalFormOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4 mr-2 text-muted-foreground" />
                              Editar Dados
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleExcluir(ext)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogos do Módulo */}
      <ExtintorFormDialog
        open={modalFormOpen}
        onOpenChange={setModalFormOpen}
        empresaId={empresaId}
        extintor={extintorSelecionado}
        onSuccess={carregarDados}
      />

      {extintorSelecionado && (
        <>
          <ExtintorInspecaoDialog
            open={modalInspecaoOpen}
            onOpenChange={setModalInspecaoOpen}
            extintor={extintorSelecionado}
            onSuccess={carregarDados}
          />

          <ExtintorManutencaoDialog
            open={modalManutencaoOpen}
            onOpenChange={setModalManutencaoOpen}
            extintor={extintorSelecionado}
            onSuccess={carregarDados}
          />
        </>
      )}
    </div>
  );
}
