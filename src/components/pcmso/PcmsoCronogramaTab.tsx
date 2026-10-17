import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mesParaData, mesCurto, dataParaMes } from "@/lib/mesPrevisto";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays, Loader2, Sparkles, Pencil, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PcmsoCronogramaTabProps {
  pcmso: any;
}

interface AcaoEditState {
  id?: string;
  acao: string;
  responsavel: string;
  mes: string;
  status: string;
  observacoes: string;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  Planejado: { label: "Planejado", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
  "Em Andamento": { label: "Em Andamento", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  Concluído: { label: "Concluído", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Cancelado: { label: "Cancelado", badgeClass: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function PcmsoCronogramaTab({ pcmso }: PcmsoCronogramaTabProps) {
  const { empresaId } = useAuth();
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();

  // Permite edição em rascunho e em vigente (cronograma é dinâmico durante a vigência anual)
  const formDisabled = !perms.canEdit || pcmso.status === "arquivado" || pcmso.status === "substituido";

  // Estados do formulário rápido inline
  const [acaoDesc, setAcaoDesc] = useState("");
  const [mesPlan, setMesPlan] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [gerandoPadrao, setGerandoPadrao] = useState(false);

  // Estados do modal de criação / edição completa
  const [dialogOpen, setDialogOpen] = useState(false);
  const [acaoEmEdicao, setAcaoEmEdicao] = useState<AcaoEditState | null>(null);

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["pcmso-cronograma", pcmso.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pcmso_cronograma_acoes")
        .select("*")
        .eq("pcmso_id", pcmso.id)
        .order("data_planejada", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pcmso.id,
  });

  const insertMutation = useMutation({
    mutationFn: async (payload: { acao: string; mes: string; responsavel: string; observacoes?: string; status?: string }) => {
      const { error } = await supabase
        .from("pcmso_cronograma_acoes")
        .insert({
          pcmso_id: pcmso.id,
          empresa_id: pcmso.empresa_id || empresaId,
          acao: payload.acao,
          data_planejada: mesParaData(payload.mes),
          responsavel: payload.responsavel || null,
          status: payload.status || "Planejado",
          observacoes: payload.observacoes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação adicionada ao cronograma.");
      setAcaoDesc("");
      setMesPlan("");
      setResponsavel("");
      setDialogOpen(false);
      setAcaoEmEdicao(null);
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    },
    onError: (err: any) => toast.error("Erro ao adicionar: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (dados: AcaoEditState) => {
      if (!dados.id) throw new Error("ID da ação não encontrado.");
      const { error } = await supabase
        .from("pcmso_cronograma_acoes")
        .update({
          acao: dados.acao,
          responsavel: dados.responsavel || null,
          data_planejada: mesParaData(dados.mes),
          status: dados.status || "Planejado",
          observacoes: dados.observacoes || null,
        })
        .eq("id", dados.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação atualizada com sucesso.");
      setDialogOpen(false);
      setAcaoEmEdicao(null);
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pcmso_cronograma_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação removida do cronograma.");
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pcmso_cronograma_acoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status da ação atualizado.");
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    },
    onError: (err: any) => toast.error("Erro ao alterar status: " + err.message),
  });

  const handleQuickAdd = () => {
    if (!acaoDesc.trim()) {
      toast.error("Descreva a ação de saúde.");
      return;
    }
    insertMutation.mutate({
      acao: acaoDesc.trim(),
      mes: mesPlan,
      responsavel: responsavel.trim(),
    });
  };

  const handleOpenNewDialog = () => {
    setAcaoEmEdicao({
      acao: "",
      responsavel: "SESMT / Medicina do Trabalho",
      mes: "",
      status: "Planejado",
      observacoes: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (item: any) => {
    setAcaoEmEdicao({
      id: item.id,
      acao: item.acao || "",
      responsavel: item.responsavel || "",
      mes: dataParaMes(item.data_planejada),
      status: item.status || "Planejado",
      observacoes: item.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSaveDialog = () => {
    if (!acaoEmEdicao || !acaoEmEdicao.acao.trim()) {
      toast.error("Preencha o nome da ação de saúde.");
      return;
    }

    if (acaoEmEdicao.id) {
      updateMutation.mutate(acaoEmEdicao);
    } else {
      insertMutation.mutate({
        acao: acaoEmEdicao.acao.trim(),
        mes: acaoEmEdicao.mes,
        responsavel: acaoEmEdicao.responsavel.trim(),
        status: acaoEmEdicao.status,
        observacoes: acaoEmEdicao.observacoes.trim(),
      });
    }
  };

  const handleDelete = (id: string, nome: string) => {
    if (confirm(`Deseja excluir a ação "${nome}" do cronograma?`)) {
      deleteMutation.mutate(id);
    }
  };

  const gerarAcoesPadraoNr07 = async () => {
    try {
      setGerandoPadrao(true);
      const dataInicio = pcmso.data_vigencia_inicio || new Date().toISOString().split("T")[0];
      const dataFim = pcmso.data_vigencia_fim || null;

      const acoesPadrao = [
        {
          pcmso_id: pcmso.id,
          empresa_id: pcmso.empresa_id || empresaId,
          acao: "Aprovação do Programa",
          responsavel: "Direção da empresa",
          data_planejada: dataInicio,
          status: "Concluído",
          observacoes: "Verificar se há condições de exequibilidade do Programa.",
        },
        {
          pcmso_id: pcmso.id,
          empresa_id: pcmso.empresa_id || empresaId,
          acao: "Contratar empresa para elaboração e gestão do Programa",
          responsavel: "Direção da empresa",
          data_planejada: dataInicio,
          status: "Concluído",
          observacoes: "Necessidade de atender a determinação da Norma Regulamentadora.",
        },
        {
          pcmso_id: pcmso.id,
          empresa_id: pcmso.empresa_id || empresaId,
          acao: "Realizar o Atestado de Saúde Ocupacional (ASO) periódico",
          responsavel: "Clínica de Medicina do Trabalho",
          data_planejada: dataFim,
          status: "Em Andamento",
          observacoes: "Direcionar colaboradores ao atendimento do ASO em clínica contratada/credenciada.",
        },
        {
          pcmso_id: pcmso.id,
          empresa_id: pcmso.empresa_id || empresaId,
          acao: "Levantar as informações para elaboração do Relatório Anual",
          responsavel: "Médico Coordenador / Direção",
          data_planejada: dataFim,
          status: "Planejado",
          observacoes: "Balanço estatístico das avaliações clínicas e exames complementares.",
        },
      ];

      const { error } = await supabase.from("pcmso_cronograma_acoes").insert(acoesPadrao);
      if (error) throw error;
      toast.success("4 Ações padrão regulamentares da NR-07 adicionadas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    } catch (err: any) {
      toast.error("Erro ao gerar ações padrão: " + err.message);
    } finally {
      setGerandoPadrao(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-t-4 border-t-indigo-600 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-indigo-600" /> Cronograma de Ações de Saúde (NR-07)
              </CardTitle>
              <CardDescription>
                Defina o planejamento anual das ações de saúde ocupacional, campanhas e exames periódicos.
              </CardDescription>
            </div>
            {!formDisabled && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={gerarAcoesPadraoNr07}
                  disabled={gerandoPadrao}
                  className="text-xs shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 h-8"
                >
                  {gerandoPadrao ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Ações Padrão NR-07
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenNewDialog}
                  className="text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Nova Ação
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!formDisabled && (
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Adicionar Ação Rápida
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Ação / Atividade *</Label>
                  <Input
                    placeholder="Ex: Campanha de Vacinação, Palestra de Ergonomia..."
                    value={acaoDesc}
                    onChange={(e) => setAcaoDesc(e.target.value)}
                    className="h-9 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuickAdd();
                    }}
                  />
                </div>
                <div className="w-full sm:w-44 space-y-1">
                  <Label className="text-xs">Responsável</Label>
                  <Input
                    placeholder="Ex: SESMT / CIPA"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="w-full sm:w-36 space-y-1">
                  <Label className="text-xs">Mês Previsto</Label>
                  <Input
                    type="month"
                    value={mesPlan}
                    onChange={(e) => setMesPlan(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleQuickAdd}
                    disabled={insertMutation.isPending}
                    className="w-full sm:w-auto h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0"
                  >
                    {insertMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold text-xs">Ação de Saúde</TableHead>
                  <TableHead className="font-semibold text-xs">Responsável</TableHead>
                  <TableHead className="font-semibold text-xs">Previsão</TableHead>
                  <TableHead className="font-semibold text-xs hidden md:table-cell text-center">Grade Anual (12 Meses)</TableHead>
                  <TableHead className="w-40 font-semibold text-xs">Status</TableHead>
                  {!formDisabled && <TableHead className="w-24 text-right font-semibold text-xs">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={formDisabled ? 5 : 6} className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Carregando cronograma...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : acoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={formDisabled ? 5 : 6} className="text-center py-10">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="h-10 w-10 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            Nenhuma ação cadastrada para este PCMSO.
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            O cronograma deve conter as ações anuais de saúde ocupacional, campanhas preventivas e exames periódicos da NR-07.
                          </p>
                        </div>
                        {!formDisabled && (
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={gerarAcoesPadraoNr07}
                              disabled={gerandoPadrao}
                              className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1" /> Inserir 4 Ações Regulamentares da NR-07
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleOpenNewDialog}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar Ação
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  acoes.map((a: any) => {
                    const identificarMesAtivo = (numMes: number): boolean => {
                      if (a.data_planejada) {
                        const m = String(a.data_planejada).match(/\d{4}-(\d{2})/);
                        if (m && parseInt(m[1], 10) === numMes) return true;
                      }
                      if (a.acao) {
                        const t = a.acao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const MAPA: [string, number][] = [
                          ["janeiro", 1], ["fevereiro", 2], ["marco", 3], ["abril", 4],
                          ["maio", 5], ["junho", 6], ["julho", 7], ["agosto", 8],
                          ["setembro", 9], ["outubro", 10], ["novembro", 11], ["dezembro", 12],
                        ];
                        for (const [nome, num] of MAPA) {
                          if (t.includes(nome) && num === numMes) return true;
                        }
                      }
                      return false;
                    };

                    const MESES_ROTULOS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
                    const MESES_NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

                    return (
                      <TableRow key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {a.acao.replace(/^AÇÃO:\s*/i, "").replace(/^ACAO:\s*/i, "")}
                          </div>
                          {a.observacoes && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.observacoes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                          {a.responsavel || "Direção da empresa"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {mesCurto(a.data_planejada) ? (
                            <Badge variant="outline" className="font-semibold text-xs bg-slate-50 text-slate-700">
                              {mesCurto(a.data_planejada)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Durante a vigência</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center justify-center gap-0.5">
                            {MESES_ROTULOS.map((rotulo, idx) => {
                              const mNum = idx + 1;
                              const ativo = identificarMesAtivo(mNum);
                              return (
                                <div
                                  key={idx}
                                  title={`${MESES_NOMES[idx]}: ${ativo ? a.status || "Planejado" : "Sem atividade programada"}`}
                                  className={`h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                                    ativo
                                      ? a.status === "Concluído"
                                        ? "bg-emerald-600 text-white shadow-2xs scale-105"
                                        : a.status === "Em Andamento"
                                        ? "bg-amber-500 text-white shadow-2xs scale-105"
                                        : "bg-indigo-600 text-white shadow-2xs scale-105"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600"
                                  }`}
                                >
                                  {rotulo}
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Select
                            value={a.status || "Planejado"}
                            onValueChange={(val) => statusMutation.mutate({ id: a.id, status: val })}
                            disabled={formDisabled}
                          >
                            <SelectTrigger className="h-8 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Planejado" className="text-xs">
                                <span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-2" />
                                Planejado
                              </SelectItem>
                              <SelectItem value="Em Andamento" className="text-xs">
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                                Em Andamento
                              </SelectItem>
                              <SelectItem value="Concluído" className="text-xs">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                Concluído
                              </SelectItem>
                              <SelectItem value="Cancelado" className="text-xs">
                                <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-2" />
                                Cancelado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {!formDisabled && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDialog(a)}
                                className="h-7 w-7 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                title="Editar detalhes da ação"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(a.id, a.acao)}
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Excluir ação"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Edição / Criação Completa de Ação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              {acaoEmEdicao?.id ? "Editar Ação do Cronograma" : "Nova Ação de Saúde (NR-07)"}
            </DialogTitle>
            <DialogDescription>
              Planejamento da ação de saúde ocupacional conforme a Norma Regulamentadora NR-07.
            </DialogDescription>
          </DialogHeader>

          {acaoEmEdicao && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="acao-nome" className="text-xs">
                  Nome da Ação / Atividade *
                </Label>
                <Input
                  id="acao-nome"
                  placeholder="Ex: Campanha de Prevenção à Hipertensão e Diabetes"
                  value={acaoEmEdicao.acao}
                  onChange={(e) => setAcaoEmEdicao({ ...acaoEmEdicao, acao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acao-resp" className="text-xs">
                    Responsável
                  </Label>
                  <Input
                    id="acao-resp"
                    placeholder="Ex: Médico Coordenador"
                    value={acaoEmEdicao.responsavel}
                    onChange={(e) => setAcaoEmEdicao({ ...acaoEmEdicao, responsavel: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="acao-mes" className="text-xs">
                    Mês Previsto
                  </Label>
                  <Input
                    id="acao-mes"
                    type="month"
                    value={acaoEmEdicao.mes}
                    onChange={(e) => setAcaoEmEdicao({ ...acaoEmEdicao, mes: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acao-status" className="text-xs">
                  Status da Ação
                </Label>
                <Select
                  value={acaoEmEdicao.status}
                  onValueChange={(val) => setAcaoEmEdicao({ ...acaoEmEdicao, status: val })}
                >
                  <SelectTrigger id="acao-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Planejado">Planejado</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acao-obs" className="text-xs">
                  Observações e Metodologia
                </Label>
                <Textarea
                  id="acao-obs"
                  placeholder="Ex: Palestra orientativa ministrada para todos os setores no auditório principal..."
                  value={acaoEmEdicao.observacoes}
                  onChange={(e) => setAcaoEmEdicao({ ...acaoEmEdicao, observacoes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveDialog}
              disabled={insertMutation.isPending || updateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {(insertMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {acaoEmEdicao?.id ? "Salvar Alterações" : "Adicionar Ação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
