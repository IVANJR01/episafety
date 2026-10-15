import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  MapPin,
  ExternalLink,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/pdfTimbrado";
import { ExtintorFormDialog } from "./ExtintorFormDialog";
import { ExtintorInspecaoDialog } from "./ExtintorInspecaoDialog";
import { ExtintorManutencaoDialog } from "./ExtintorManutencaoDialog";
import { ExtintorCadastrosApoioDialog } from "./ExtintorCadastrosApoioDialog";
import { gerarEtiquetasExtintoresPdf } from "@/lib/extintoresEtiquetasPdf";
import {
  carregarExtintoresLocal,
  excluirExtintorLocal,
  isTableMissingError,
} from "@/lib/extintoresStorageFallback";

export default function ExtintoresDashboard() {
  const navigate = useNavigate();
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
  const [modalApoioOpen, setModalApoioOpen] = useState(false);
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

      let listaFinal = res.data || [];

      // Se der erro ou a lista estiver vazia, combina com os extintores locais (fallback offline)
      const locais = carregarExtintoresLocal(empresaId);
      if (locais.length > 0) {
        const idsExistentes = new Set(listaFinal.map((e: any) => e.id));
        locais.forEach((loc) => {
          if (!idsExistentes.has(loc.id)) {
            listaFinal.push(loc);
          }
        });
      }

      setExtintores(listaFinal);
    } catch (err: any) {
      console.warn("Erro ao carregar extintores da nuvem, buscando locais:", err);
      const locais = carregarExtintoresLocal(empresaId);
      setExtintores(locais);
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
      excluirExtintorLocal(empresaId, ext.id);
      const { error } = await (supabase.from as any)("extintores").delete().eq("id", ext.id);
      if (error && !isTableMissingError(error)) throw error;
      toast({ title: "Extintor removido", description: `TAG ${ext.numero} excluída com sucesso.` });
      carregarDados();
    } catch (err: any) {
      if (isTableMissingError(err)) {
        excluirExtintorLocal(empresaId, ext.id);
        toast({ title: "Extintor removido", description: `TAG ${ext.numero} excluída com sucesso.` });
        carregarDados();
      } else {
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      }
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
    <div className="container mx-auto px-2.5 py-3 sm:p-4 md:p-6 space-y-3.5 sm:space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 dark:bg-red-950/60 rounded-xl text-red-600 shrink-0 shadow-2xs">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Extintores de Incêndio
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Gestão de equipamentos, recargas e inspeções mensais (NR-23 · NBR 12962)
              </p>
            </div>
          </div>
          <Badge variant="outline" className="sm:hidden font-bold text-xs px-2 py-0.5">
            {metricas.total} extintores
          </Badge>
        </div>

        {/* Botões de Ação no Mobile (Grid 2x2 touch) e Desktop (flex) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => {
              setExtintorSelecionado(null);
              setModalFormOpen(true);
            }}
            className="h-10 sm:h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm order-1"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Extintor
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalApoioOpen(true)}
            className="h-10 sm:h-9 text-slate-700 dark:text-slate-200 font-semibold order-2"
          >
            <Building2 className="h-4 w-4 mr-1.5 text-primary" />
            <span className="truncate">Setores & Marcas</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImprimirEtiquetas}
            className="h-10 sm:h-9 text-slate-700 dark:text-slate-200 font-medium order-3"
          >
            <QrCode className="h-4 w-4 mr-1.5 text-primary" />
            <span className="truncate">Etiquetas QR</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="h-10 sm:h-9 font-medium order-4"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas (Grade compacta 3x2 no mobile, 6x1 no desktop) */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
        <Card className="border-border shadow-2xs">
          <CardContent className="p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground truncate">Ativos</span>
              <Flame className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground/60 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-foreground">{metricas.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 shadow-2xs">
          <CardContent className="p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-red-700 dark:text-red-400 truncate">Críticos</span>
              <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-red-600 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-red-700 dark:text-red-400">{metricas.criticos}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-950 bg-amber-50/50 dark:bg-amber-950/20 shadow-2xs">
          <CardContent className="p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 truncate">Atenção</span>
              <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400">{metricas.atencao}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-950 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-2xs">
          <CardContent className="p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">Em Dia</span>
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-emerald-600 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">{metricas.ok}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground truncate">Venc. 30d</span>
              <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground/60 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-foreground">{metricas.vencemEm30}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-2 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground truncate">Atrasadas</span>
              <ClipboardCheck className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-muted-foreground/60 shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2">
              <span className="text-base sm:text-2xl font-black text-foreground">{metricas.atrasadas}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros Otimizada para Mobile */}
      <div className="flex flex-col md:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar TAG, setor, local ou Inmetro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:w-auto">
          <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
            <SelectTrigger className="w-full md:w-[170px] h-10 text-xs sm:text-sm">
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
            <SelectTrigger className="w-full md:w-[185px] h-10 text-xs sm:text-sm">
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
      </div>

      {/* Tabela de Extintores (Desktop) e Cards (Mobile) */}
      <Card className="border-border">
        <CardContent className="p-0">
          {/* VISUALIZAÇÃO EM TABELA PARA TELAS MÉDIAS E GRANDES (DESKTOP) */}
          <div className="hidden md:block overflow-x-auto">
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
                              onClick={() => navigate(`/extintores/qr/${ext.qr_token || ext.id}`)}
                            >
                              <QrCode className="h-4 w-4 mr-2 text-primary" />
                              Ver Ficha QR / Etiqueta
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

          {/* VISUALIZAÇÃO EM CARDS PARA MODO MOBILE (TELAS PEQUENAS) */}
          <div className="block md:hidden p-2.5 sm:p-3 space-y-3">
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Carregando dados dos extintores...
              </div>
            ) : extintoresFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
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
            ) : (
              extintoresFiltrados.map((ext) => (
                <div
                  key={ext.id}
                  className="bg-card rounded-xl border border-border p-3.5 shadow-xs space-y-3 transition-colors"
                >
                  {/* Cabeçalho do Card Mobile */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-foreground tracking-tight">TAG {ext.numero}</span>
                        {getBadgeSituacao(ext.situacaoCalculada)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ext.agente?.replace(/_/g, " ")} ({ext.classes || "—"}) · {ext.capacidade} {ext.unidade_capacidade}
                        {ext.fabricante ? ` · ${ext.fabricante}` : ""}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1.5 -mt-1 text-muted-foreground">
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
                          <ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" /> Inspecionar Agora
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setExtintorSelecionado(ext);
                            setModalManutencaoOpen(true);
                          }}
                        >
                          <Wrench className="h-4 w-4 mr-2 text-primary" /> Lançar Manutenção
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/extintores/qr/${ext.qr_token || ext.id}`)}
                        >
                          <QrCode className="h-4 w-4 mr-2 text-primary" /> Ver Ficha QR
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setExtintorSelecionado(ext);
                            setModalFormOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" /> Editar Dados
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExcluir(ext)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Informações Centrais em Grade */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Setor / Local</span>
                      <p className="font-semibold text-foreground truncate mt-0.5">{ext.local_setor || "Geral"}</p>
                      {ext.local_descricao && (
                        <p className="text-[11px] text-muted-foreground truncate">{ext.local_descricao}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Próx. Recarga</span>
                      <p className="font-semibold text-foreground mt-0.5">{fmtDate(ext.data_proxima_recarga)}</p>
                      {ext.diasParaRecarga !== null && (
                        <p
                          className={`text-[10px] font-bold ${
                            ext.diasParaRecarga < 0
                              ? "text-red-600"
                              : ext.diasParaRecarga <= 30
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {ext.diasParaRecarga < 0
                            ? `Vencido há ${Math.abs(ext.diasParaRecarga)}d`
                            : `Em ${ext.diasParaRecarga} dias`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rodapé informativo sutil (Última inspeção) */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                    <span>
                      Última Inspeção:{" "}
                      <strong className={ext.data_ultima_inspecao ? "text-foreground" : "text-amber-600"}>
                        {ext.data_ultima_inspecao ? fmtDate(ext.data_ultima_inspecao) : "Pendente"}
                      </strong>
                    </span>
                    {ext.selo_inmetro && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        Selo: {ext.selo_inmetro}
                      </span>
                    )}
                  </div>

                  {/* BOTÕES DE AÇÃO TOUCH RÁPIDOS NO MOBILE */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <Button
                      size="sm"
                      className="h-11 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                      onClick={() => {
                        setExtintorSelecionado(ext);
                        setModalInspecaoOpen(true);
                      }}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Inspecionar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 border-slate-300 dark:border-slate-700"
                      onClick={() => {
                        setExtintorSelecionado(ext);
                        setModalManutencaoOpen(true);
                      }}
                    >
                      <Wrench className="w-4 h-4 text-primary" />
                      Manutenção
                    </Button>
                  </div>
                </div>
              ))
            )}
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

      {/* Gerenciador de Cadastros de Apoio (Setores, Locais e Fabricantes) */}
      <ExtintorCadastrosApoioDialog
        open={modalApoioOpen}
        onOpenChange={setModalApoioOpen}
        empresaId={empresaId}
        onUpdated={carregarDados}
      />
    </div>
  );
}
