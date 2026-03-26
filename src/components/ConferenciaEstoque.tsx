import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Save, TrendingDown, TrendingUp } from "lucide-react";

interface ConferenciaItem {
  contrato_epi_id: string;
  epi_id: string;
  epi_nome: string;
  ca: string | null;
  tamanho: string | null;
  estoque_sistema: number;
  estoque_minimo: number;
  contagem_fisica: number | null;
  divergencia: number;
  justificativa: string;
}

interface Props {
  unidades: { id: string; nome: string; empresa_pai_id: string | null }[];
  contratos: { id: string; nome: string; unidade_id: string }[];
  matrizId: string | null;
  userContratoId?: string | null;
  hasGestaoEstoque?: boolean;
  onConferenciaFinalizada?: () => void;
}

interface ConferenciaDraft {
  unidadeId: string;
  contratoId: string;
  tipoConferencia: "semanal" | "mensal";
  observacaoGeral: string;
  itens: Array<{
    contrato_epi_id: string;
    contagem_fisica: number | null;
    justificativa: string;
  }>;
  updatedAt: string;
}

interface DraftPointer {
  unidadeId: string;
  contratoId: string;
  tipoConferencia: "semanal" | "mensal";
  updatedAt: string;
}

export default function ConferenciaEstoque({ unidades, contratos, matrizId, userContratoId, hasGestaoEstoque, onConferenciaFinalizada }: Props) {
  const { empresaId, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [unidadeId, setUnidadeId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [tipoConferencia, setTipoConferencia] = useState<"semanal" | "mensal">("semanal");
  const [itens, setItens] = useState<ConferenciaItem[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [pendingDraft, setPendingDraft] = useState<ConferenciaDraft | null>(null);
  const [handledDraftKey, setHandledDraftKey] = useState<string | null>(null);

  const isContractBound = !!userContratoId && !hasGestaoEstoque;
  const draftStorageKey = useMemo(
    () => (user?.id && contratoId ? `conferencia_estoque_draft:${user.id}:${contratoId}` : null),
    [contratoId, user?.id]
  );
  const draftPointerKey = useMemo(
    () => (user?.id ? `conferencia_estoque_draft_last:${user.id}` : null),
    [user?.id]
  );

  const filiais = useMemo(() => {
    const directChildren = unidades.filter((unidade) => unidade.empresa_pai_id === matrizId);
    if (directChildren.length > 0) return directChildren;

    if (isContractBound && userContratoId) {
      const contrato = contratos.find((item) => item.id === userContratoId);
      if (!contrato) return [];
      return unidades.filter((unidade) => unidade.id === contrato.unidade_id);
    }

    return [];
  }, [contratos, isContractBound, matrizId, unidades, userContratoId]);

  const contratosFiltered = useMemo(
    () => contratos.filter((contrato) => contrato.unidade_id === unidadeId),
    [contratos, unidadeId]
  );

  const hasDraftableChanges = useMemo(
    () => !!contratoId && (
      observacaoGeral.trim().length > 0 ||
      itens.some((item) => item.contagem_fisica !== null || item.justificativa.trim().length > 0)
    ),
    [contratoId, itens, observacaoGeral]
  );

  const totalZerados = useMemo(
    () => itens.filter((item) => getStockStatus(item.estoque_sistema, item.estoque_minimo) === "zerado").length,
    [itens]
  );

  const totalBaixo = useMemo(
    () => itens.filter((item) => getStockStatus(item.estoque_sistema, item.estoque_minimo) === "baixo").length,
    [itens]
  );

  const totalDivergencias = useMemo(
    () => itens.filter((item) => item.contagem_fisica !== null && item.divergencia !== 0).length,
    [itens]
  );

  const allCounted = useMemo(
    () => itens.length > 0 && itens.every((item) => item.contagem_fisica !== null),
    [itens]
  );

  const hasMissingJustificativa = useMemo(
    () => itens.some((item) => item.contagem_fisica !== null && item.divergencia !== 0 && !item.justificativa.trim()),
    [itens]
  );

  useEffect(() => {
    if (authLoading || !userContratoId || !open) return;
    const contrato = contratos.find((item) => item.id === userContratoId);
    if (!contrato) return;

    setUnidadeId(contrato.unidade_id);
    setContratoId(contrato.id);
  }, [authLoading, contratos, open, userContratoId]);

  useEffect(() => {
    if (!open || !draftPointerKey || contratoId) return;

    try {
      const rawPointer = localStorage.getItem(draftPointerKey);
      if (!rawPointer) return;

      const pointer = JSON.parse(rawPointer) as DraftPointer;
      const unidadeExiste = unidades.some((unidade) => unidade.id === pointer.unidadeId);
      const contratoExiste = contratos.some(
        (contrato) => contrato.id === pointer.contratoId && contrato.unidade_id === pointer.unidadeId
      );

      if (unidadeExiste && contratoExiste) {
        setUnidadeId(pointer.unidadeId);
        setContratoId(pointer.contratoId);
        setTipoConferencia(pointer.tipoConferencia || "semanal");
      }
    } catch {
      // ignore corrupted draft pointer
    }
  }, [contratoId, contratos, draftPointerKey, open, unidades]);

  useEffect(() => {
    if (!contratoId) {
      setItens([]);
      return;
    }

    loadContratoEpis();
  }, [contratoId]);

  useEffect(() => {
    if (!open || !draftStorageKey || itens.length === 0 || handledDraftKey === draftStorageKey) return;

    try {
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft) as ConferenciaDraft;
      if (draft.contratoId !== contratoId) return;

      setPendingDraft(draft);
      setRestoreOpen(true);
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [contratoId, draftStorageKey, handledDraftKey, itens.length, open]);

  useEffect(() => {
    if (!open || !draftStorageKey || !hasDraftableChanges || itens.length === 0) return;

    const draft: ConferenciaDraft = {
      unidadeId,
      contratoId,
      tipoConferencia,
      observacaoGeral,
      itens: itens.map((item) => ({
        contrato_epi_id: item.contrato_epi_id,
        contagem_fisica: item.contagem_fisica,
        justificativa: item.justificativa,
      })),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));

      if (draftPointerKey) {
        const pointer: DraftPointer = {
          unidadeId,
          contratoId,
          tipoConferencia,
          updatedAt: draft.updatedAt,
        };
        localStorage.setItem(draftPointerKey, JSON.stringify(pointer));
      }
    } catch {
      // ignore storage errors
    }
  }, [contratoId, draftPointerKey, draftStorageKey, hasDraftableChanges, itens, observacaoGeral, open, tipoConferencia, unidadeId]);

  useEffect(() => {
    if (!open || !hasDraftableChanges || saving) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Você tem alterações não salvas. Deseja realmente sair?";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraftableChanges, open, saving]);

  const loadContratoEpis = async () => {
    setLoadingItens(true);

    const { data: cepis, error: cepisError } = await supabase
      .from("contrato_epis")
      .select("id, epi_id, estoque")
      .eq("contrato_id", contratoId);

    console.log("[ConferenciaEstoque] contrato_epis", { contratoId, cepis, cepisError });

    if (cepisError) {
      toast({ title: "Erro ao carregar EPIs", description: cepisError.message, variant: "destructive" });
      setItens([]);
      setLoadingItens(false);
      return;
    }

    if (!cepis || cepis.length === 0) {
      setItens([]);
      setLoadingItens(false);
      return;
    }

    const epiIds = cepis.map((item) => item.epi_id);
    const { data: episData, error: episError } = await supabase
      .from("epis")
      .select("id, nome, tamanho, ca, estoque_minimo")
      .in("id", epiIds);

    console.log("[ConferenciaEstoque] epis", { epiIds, episData, episError });

    if (episError) {
      toast({ title: "Erro ao carregar detalhes dos EPIs", description: episError.message, variant: "destructive" });
      setItens([]);
      setLoadingItens(false);
      return;
    }

    const epiMap = Object.fromEntries((episData || []).map((item) => [item.id, item]));

    const items: ConferenciaItem[] = cepis
      .map((item) => ({
        contrato_epi_id: item.id,
        epi_id: item.epi_id,
        epi_nome: epiMap[item.epi_id]?.nome || "—",
        ca: epiMap[item.epi_id]?.ca || null,
        tamanho: epiMap[item.epi_id]?.tamanho || null,
        estoque_sistema: item.estoque || 0,
        estoque_minimo: epiMap[item.epi_id]?.estoque_minimo || 0,
        contagem_fisica: null,
        divergencia: 0,
        justificativa: "",
      }))
      .sort((a, b) => {
        const statusA = a.estoque_sistema === 0 ? 0 : a.estoque_sistema <= a.estoque_minimo ? 1 : 2;
        const statusB = b.estoque_sistema === 0 ? 0 : b.estoque_sistema <= b.estoque_minimo ? 1 : 2;
        if (statusA !== statusB) return statusA - statusB;
        return a.epi_nome.localeCompare(b.epi_nome);
      });

    setItens(items);
    setLoadingItens(false);
  };

  const clearDraftStorage = () => {
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey);
    }

    if (!draftPointerKey) return;

    try {
      const rawPointer = localStorage.getItem(draftPointerKey);
      if (!rawPointer) return;

      const pointer = JSON.parse(rawPointer) as DraftPointer;
      if (!pointer.contratoId || pointer.contratoId === contratoId) {
        localStorage.removeItem(draftPointerKey);
      }
    } catch {
      localStorage.removeItem(draftPointerKey);
    }
  };

  const applyDraft = (draft: ConferenciaDraft) => {
    const draftItems = new Map(draft.itens.map((item) => [item.contrato_epi_id, item]));

    setTipoConferencia(draft.tipoConferencia || "semanal");
    setObservacaoGeral(draft.observacaoGeral || "");
    setItens((current) => current.map((item) => {
      const draftItem = draftItems.get(item.contrato_epi_id);
      if (!draftItem) return item;

      const contagem = typeof draftItem.contagem_fisica === "number" ? draftItem.contagem_fisica : null;
      return {
        ...item,
        contagem_fisica: contagem,
        divergencia: contagem !== null ? contagem - item.estoque_sistema : 0,
        justificativa: draftItem.justificativa || "",
      };
    }));
  };

  const handleRestoreDraft = () => {
    if (pendingDraft) {
      applyDraft(pendingDraft);
      toast({ title: "Rascunho restaurado", description: "A conferência anterior foi recuperada." });
    }

    setHandledDraftKey(draftStorageKey);
    setPendingDraft(null);
    setRestoreOpen(false);
  };

  const handleDiscardDraft = () => {
    clearDraftStorage();
    setHandledDraftKey(draftStorageKey);
    setPendingDraft(null);
    setRestoreOpen(false);
    setObservacaoGeral("");
  };

  const updateContagem = (idx: number, value: string) => {
    setItens((current) => current.map((item, index) => {
      if (index !== idx) return item;

      const contagem = value === "" ? null : Math.max(0, parseInt(value, 10) || 0);
      return {
        ...item,
        contagem_fisica: contagem,
        divergencia: contagem !== null ? contagem - item.estoque_sistema : 0,
      };
    }));
  };

  const updateJustificativa = (idx: number, value: string) => {
    setItens((current) => current.map((item, index) => index === idx ? { ...item, justificativa: value } : item));
  };

  const handleFinalize = () => {
    if (hasMissingJustificativa) {
      toast({
        title: "Justificativas pendentes",
        description: "Preencha a justificativa para todos os itens com divergência.",
        variant: "destructive",
      });
      return;
    }

    setConfirmOpen(true);
  };

  const executeFinalize = async () => {
    setSaving(true);
    setConfirmOpen(false);

    try {
      const unidade = unidades.find((item) => item.id === unidadeId);
      const payloadItens = itens.map((item) => ({
        contrato_epi_id: item.contrato_epi_id,
        epi_id: item.epi_id,
        estoque_sistema: item.estoque_sistema,
        contagem_fisica: item.contagem_fisica,
        justificativa: item.justificativa,
      }));

      const { data, error } = await supabase.rpc("finalizar_conferencia_estoque" as never, {
        _contrato_id: contratoId,
        _unidade_id: unidadeId,
        _empresa_id: unidade?.empresa_pai_id || empresaId,
        _tipo: tipoConferencia,
        _itens: payloadItens,
        _observacao_geral: observacaoGeral || null,
      } as never);

      console.log("[ConferenciaEstoque] finalizar_conferencia_estoque", { contratoId, unidadeId, payloadItens, data, error });

      if (error) throw error;

      clearDraftStorage();
      toast({ title: "Conferência finalizada", description: `${totalDivergencias} ajuste(s) aplicado(s) ao estoque.` });
      setOpen(false);
      resetState();
      onConferenciaFinalizada?.();
    } catch (err: any) {
      console.error("Erro ao finalizar conferência:", err);
      toast({ title: "Erro", description: err.message || "Falha ao salvar conferência.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setUnidadeId("");
    setContratoId("");
    setItens([]);
    setTipoConferencia("semanal");
    setObservacaoGeral("");
    setPendingDraft(null);
    setRestoreOpen(false);
    setHandledDraftKey(null);
  };

  function getStockStatus(estoque: number, minimo: number) {
    if (estoque === 0) return "zerado";
    if (estoque <= minimo) return "baixo";
    return "ok";
  }

  function getRowHighlight(item: ConferenciaItem) {
    const status = getStockStatus(item.estoque_sistema, item.estoque_minimo);
    if (status === "zerado") return "bg-destructive/5";
    if (status === "baixo") return "bg-warning/5";
    return "";
  }

  function getStatusBadgeClass(status: ReturnType<typeof getStockStatus>) {
    if (status === "zerado") return "border-destructive/30 bg-destructive/10 text-destructive";
    if (status === "baixo") return "border-warning/30 bg-warning/10 text-warning";
    return "border-success/30 bg-success/10 text-success";
  }

  function getDivergenceBadgeClass(divergencia: number) {
    if (divergencia === 0) return "border-success/30 bg-success/10 text-success";
    if (divergencia < 0) return "border-destructive/30 bg-destructive/10 text-destructive";
    return "border-info/30 bg-info/10 text-info";
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <ClipboardCheck className="h-3.5 w-3.5" />
        Conferência de Estoque
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-h-[90vh]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Conferência de Estoque
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a contagem física e ajuste as divergências.
            </DialogDescription>
            {hasDraftableChanges && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Save className="h-3 w-3" /> Rascunho salvo automaticamente
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={unidadeId}
                  onValueChange={(value) => {
                    setUnidadeId(value);
                    setContratoId("");
                    setItens([]);
                    setHandledDraftKey(null);
                  }}
                  disabled={isContractBound}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {filiais.map((filial) => (
                      <SelectItem key={filial.id} value={filial.id} className="text-xs">
                        {filial.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Contrato</Label>
                <Select
                  value={contratoId}
                  onValueChange={(value) => {
                    setContratoId(value);
                    setHandledDraftKey(null);
                  }}
                  disabled={!unidadeId || isContractBound}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratosFiltered.map((contrato) => (
                      <SelectItem key={contrato.id} value={contrato.id} className="text-xs">
                        {contrato.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Tipo de Conferência</Label>
                <Select value={tipoConferencia} onValueChange={(value: "semanal" | "mensal") => setTipoConferencia(value)}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal" className="text-xs">Semanal</SelectItem>
                    <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingItens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : itens.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <ClipboardCheck className="h-3 w-3" />
                    {itens.length} itens
                  </Badge>

                  {totalZerados > 0 && (
                    <Badge className="gap-1 border-destructive/30 bg-destructive/10 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {totalZerados} zerado(s)
                    </Badge>
                  )}

                  {totalBaixo > 0 && (
                    <Badge className="gap-1 border-warning/30 bg-warning/10 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {totalBaixo} estoque baixo
                    </Badge>
                  )}

                  {allCounted && totalDivergencias === 0 && (
                    <Badge className="gap-1 border-success/30 bg-success/10 text-xs text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Sem divergências
                    </Badge>
                  )}

                  {totalDivergencias > 0 && (
                    <Badge className="gap-1 border-warning/30 bg-warning/10 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {totalDivergencias} divergência(s)
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observação geral</Label>
                  <Input
                    value={observacaoGeral}
                    onChange={(event) => setObservacaoGeral(event.target.value)}
                    className="h-8 text-xs"
                    placeholder="Observações da conferência, avarias ou extravios..."
                  />
                </div>

                {/* Mobile: Card Layout */}
                {isMobile ? (
                  <div className="space-y-3">
                    {itens.map((item, idx) => {
                      const hasDivergencia = item.contagem_fisica !== null && item.divergencia !== 0;
                      const isCounted = item.contagem_fisica !== null;
                      const stockStatus = getStockStatus(item.estoque_sistema, item.estoque_minimo);

                      return (
                        <div
                          key={item.contrato_epi_id}
                          className={`rounded-lg border p-3 ${getRowHighlight(item)} space-y-2`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-tight">{item.epi_nome}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {item.tamanho && <span>({item.tamanho})</span>}
                                {item.ca && <span>C.A. {item.ca}</span>}
                              </div>
                            </div>
                            <Badge variant="outline" className={`shrink-0 px-1.5 py-0.5 text-[10px] ${getStatusBadgeClass(stockStatus)}`}>
                              {stockStatus === "zerado" ? "Zerado" : stockStatus === "baixo" ? "Baixo" : "Ok"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <span className="block text-[10px] text-muted-foreground">Sistema</span>
                              <span className="text-lg font-bold">{item.estoque_sistema}</span>
                            </div>

                            <div className="flex-1">
                              <Input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={0}
                                value={item.contagem_fisica ?? ""}
                                onChange={(event) => updateContagem(idx, event.target.value)}
                                className="h-12 text-center text-lg font-semibold"
                                placeholder="Contagem"
                              />
                            </div>

                            <div className="w-20 text-center">
                              {isCounted ? (
                                <Badge variant="outline" className={`gap-0.5 px-2 py-1 text-xs ${getDivergenceBadgeClass(item.divergencia)}`}>
                                  {item.divergencia === 0 ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Bateu
                                    </>
                                  ) : item.divergencia < 0 ? (
                                    <>
                                      <TrendingDown className="h-3.5 w-3.5" /> {item.divergencia}
                                    </>
                                  ) : (
                                    <>
                                      <TrendingUp className="h-3.5 w-3.5" /> +{item.divergencia}
                                    </>
                                  )}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>

                          {hasDivergencia && (
                            <Input
                              value={item.justificativa}
                              onChange={(event) => updateJustificativa(idx, event.target.value)}
                              className="h-10 text-sm"
                              placeholder="Motivo da divergência..."
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Desktop: Table Layout */
                  <div className="max-h-[400px] overflow-auto rounded-md border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[10px]">
                          <TableHead className="px-2 py-1.5">EPI</TableHead>
                          <TableHead className="w-[60px] px-2 py-1.5 text-center">Status</TableHead>
                          <TableHead className="w-[80px] px-2 py-1.5 text-right">Sistema</TableHead>
                          <TableHead className="w-[100px] px-2 py-1.5 text-center">Contagem Física</TableHead>
                          <TableHead className="w-[90px] px-2 py-1.5 text-center">Divergência</TableHead>
                          <TableHead className="w-[200px] px-2 py-1.5">Justificativa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((item, idx) => {
                          const hasDivergencia = item.contagem_fisica !== null && item.divergencia !== 0;
                          const isCounted = item.contagem_fisica !== null;
                          const stockStatus = getStockStatus(item.estoque_sistema, item.estoque_minimo);

                          return (
                            <TableRow key={item.contrato_epi_id} className={`text-xs ${getRowHighlight(item)}`}>
                              <TableCell className="max-w-[180px] px-2 py-1.5">
                                <span className="block truncate">{item.epi_nome}</span>
                                <div className="flex items-center gap-1">
                                  {item.tamanho && <span className="text-[10px] text-muted-foreground">({item.tamanho})</span>}
                                  {item.ca && <span className="text-[10px] text-muted-foreground">C.A. {item.ca}</span>}
                                </div>
                              </TableCell>

                              <TableCell className="px-2 py-1.5 text-center">
                                <Badge variant="outline" className={`px-1 py-0 text-[9px] ${getStatusBadgeClass(stockStatus)}`}>
                                  {stockStatus === "zerado" ? "Zerado" : stockStatus === "baixo" ? "Baixo" : "Ok"}
                                </Badge>
                              </TableCell>

                              <TableCell className="px-2 py-1.5 text-right font-semibold">
                                {item.estoque_sistema}
                              </TableCell>

                              <TableCell className="px-2 py-1.5 text-center">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={item.contagem_fisica ?? ""}
                                  onChange={(event) => updateContagem(idx, event.target.value)}
                                  className="mx-auto h-7 w-[70px] text-center text-xs"
                                  placeholder="—"
                                />
                              </TableCell>

                              <TableCell className="px-2 py-1.5 text-center">
                                {isCounted ? (
                                  <Badge variant="outline" className={`gap-0.5 px-1.5 py-0 text-[10px] ${getDivergenceBadgeClass(item.divergencia)}`}>
                                    {item.divergencia === 0 ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" /> Bateu
                                      </>
                                    ) : item.divergencia < 0 ? (
                                      <>
                                        <TrendingDown className="h-3 w-3" /> {item.divergencia}
                                      </>
                                    ) : (
                                      <>
                                        <TrendingUp className="h-3 w-3" /> +{item.divergencia}
                                      </>
                                    )}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </TableCell>

                              <TableCell className="px-2 py-1.5">
                                {hasDivergencia ? (
                                  <Input
                                    value={item.justificativa}
                                    onChange={(event) => updateJustificativa(idx, event.target.value)}
                                    className="h-7 text-xs"
                                    placeholder="Motivo da divergência..."
                                  />
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : contratoId ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum EPI cadastrado neste contrato.
              </div>
            ) : null}
          </div>

          {itens.length > 0 && (
            <DialogFooter className="mt-4">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetState(); }} className="text-xs">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleFinalize} disabled={!allCounted || saving} className="gap-1.5 text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Finalizar e Ajustar Estoque
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Confirmar ajuste de estoque?</DialogTitle>
            <DialogDescription className="text-xs">
              {totalDivergencias === 0
                ? "Nenhuma divergência encontrada. A conferência será registrada sem ajustes."
                : `${totalDivergencias} item(ns) terão o estoque ajustado. Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={executeFinalize} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Rascunho encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja continuar a conferência anterior?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardDraft}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreDraft}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}