import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

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

export default function ConferenciaEstoque({ unidades, contratos, matrizId, userContratoId, hasGestaoEstoque, onConferenciaFinalizada }: Props) {
  const { empresaId } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [unidadeId, setUnidadeId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [tipoConferencia, setTipoConferencia] = useState<"semanal" | "mensal">("semanal");
  const [itens, setItens] = useState<ConferenciaItem[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isContractBound = !!userContratoId && !hasGestaoEstoque;

  const filiais = useMemo(() => unidades.filter(u => u.empresa_pai_id === matrizId), [unidades, matrizId]);
  const contratosFiltered = useMemo(() => contratos.filter(c => c.unidade_id === unidadeId), [contratos, unidadeId]);

  // Auto-select unit/contract for users with a linked contract
  useEffect(() => {
    if (!userContratoId || !open) return;
    const contrato = contratos.find(c => c.id === userContratoId);
    if (contrato) {
      setUnidadeId(contrato.unidade_id);
      setContratoId(contrato.id);
    }
  }, [userContratoId, contratos, open]);

  // Load EPIs when contract is selected
  useEffect(() => {
    if (!contratoId) { setItens([]); return; }
    loadContratoEpis();
  }, [contratoId]);

  const loadContratoEpis = async () => {
    setLoadingItens(true);
    const { data: cepis } = await supabase
      .from("contrato_epis")
      .select("id, epi_id, estoque")
      .eq("contrato_id", contratoId);

    if (!cepis || cepis.length === 0) {
      setItens([]);
      setLoadingItens(false);
      return;
    }

    const epiIds = cepis.map(c => c.epi_id);
    const { data: episData } = await supabase
      .from("epis")
      .select("id, nome, tamanho, ca, estoque_minimo")
      .in("id", epiIds);

    const epiMap = Object.fromEntries((episData || []).map(e => [e.id, e]));

    const items: ConferenciaItem[] = cepis
      .map(ce => ({
        contrato_epi_id: ce.id,
        epi_id: ce.epi_id,
        epi_nome: epiMap[ce.epi_id]?.nome || "—",
        ca: epiMap[ce.epi_id]?.ca || null,
        tamanho: epiMap[ce.epi_id]?.tamanho || null,
        estoque_sistema: ce.estoque || 0,
        estoque_minimo: epiMap[ce.epi_id]?.estoque_minimo || 0,
        contagem_fisica: null,
        divergencia: 0,
        justificativa: "",
      }))
      .sort((a, b) => {
        // Prioritize zero/low stock items
        const aStatus = a.estoque_sistema === 0 ? 0 : a.estoque_sistema <= a.estoque_minimo ? 1 : 2;
        const bStatus = b.estoque_sistema === 0 ? 0 : b.estoque_sistema <= b.estoque_minimo ? 1 : 2;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return a.epi_nome.localeCompare(b.epi_nome);
      });

    setItens(items);
    setLoadingItens(false);
  };

  const updateContagem = (idx: number, value: string) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const contagem = value === "" ? null : Math.max(0, parseInt(value) || 0);
      return {
        ...item,
        contagem_fisica: contagem,
        divergencia: contagem !== null ? contagem - item.estoque_sistema : 0,
      };
    }));
  };

  const updateJustificativa = (idx: number, value: string) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, justificativa: value } : item));
  };

  const totalDivergencias = useMemo(() => itens.filter(i => i.contagem_fisica !== null && i.divergencia !== 0).length, [itens]);
  const allCounted = useMemo(() => itens.length > 0 && itens.every(i => i.contagem_fisica !== null), [itens]);
  const hasMissingJustificativa = useMemo(
    () => itens.some(i => i.contagem_fisica !== null && i.divergencia !== 0 && !i.justificativa.trim()),
    [itens]
  );

  const handleFinalize = async () => {
    if (hasMissingJustificativa) {
      toast({ title: "Justificativas pendentes", description: "Preencha a justificativa para todos os itens com divergência.", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const executeFinalize = async () => {
    setSaving(true);
    setConfirmOpen(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const unidade = unidades.find(u => u.id === unidadeId);

      const { data: conf, error: confError } = await (supabase.from as any)("conferencias_estoque").insert({
        contrato_id: contratoId,
        unidade_id: unidadeId,
        empresa_id: unidade?.empresa_pai_id || empresaId,
        tipo: tipoConferencia,
        status: "finalizada",
        created_by: user?.id,
        finalizado_por: user?.id,
        finalizado_em: new Date().toISOString(),
      }).select("id").single();

      if (confError) throw confError;

      const confItens = itens.map(item => ({
        conferencia_id: conf.id,
        contrato_epi_id: item.contrato_epi_id,
        epi_id: item.epi_id,
        estoque_sistema: item.estoque_sistema,
        contagem_fisica: item.contagem_fisica ?? 0,
        justificativa: item.justificativa || null,
      }));

      const { error: itensError } = await (supabase.from as any)("conferencia_itens").insert(confItens);
      if (itensError) throw itensError;

      const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", user?.id || "").maybeSingle();

      for (const item of itens) {
        if (item.contagem_fisica === null || item.divergencia === 0) continue;

        await (supabase.from as any)("contrato_epis")
          .update({ estoque: item.contagem_fisica })
          .eq("id", item.contrato_epi_id);

        const tipoMov = item.divergencia > 0 ? "entrada" : "saida";
        const motivo = `Ajuste de Inventário (${tipoConferencia === "semanal" ? "Semanal" : "Mensal"}) — ${item.justificativa}`;

        await (supabase.from as any)("contrato_epis_movimentacoes").insert({
          contrato_epi_id: item.contrato_epi_id,
          contrato_id: contratoId,
          epi_id: item.epi_id,
          empresa_id: unidade?.empresa_pai_id || empresaId,
          tipo: tipoMov,
          quantidade: Math.abs(item.divergencia),
          motivo,
          responsavel_nome: profile?.nome || "Sistema",
          created_by: user?.id,
        });
      }

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
  };

  const getStockStatus = (estoque: number, minimo: number) => {
    if (estoque === 0) return "zerado";
    if (estoque <= minimo) return "baixo";
    return "ok";
  };

  const getRowHighlight = (item: ConferenciaItem) => {
    const status = getStockStatus(item.estoque_sistema, item.estoque_minimo);
    if (status === "zerado") return "bg-red-50/60 dark:bg-red-950/20";
    if (status === "baixo") return "bg-amber-50/60 dark:bg-amber-950/20";
    return "";
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck className="w-3.5 h-3.5" />
        Conferência de Estoque
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="w-4 h-4" />
              Conferência de Estoque (Inventário)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o contrato, registre a contagem física e ajuste as divergências.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={unidadeId}
                  onValueChange={(v) => { setUnidadeId(v); setContratoId(""); setItens([]); }}
                  disabled={isContractBound}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {filiais.map(f => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Contrato</Label>
                <Select
                  value={contratoId}
                  onValueChange={setContratoId}
                  disabled={!unidadeId || isContractBound}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contratosFiltered.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Conferência</Label>
                <Select value={tipoConferencia} onValueChange={(v: "semanal" | "mensal") => setTipoConferencia(v)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal" className="text-xs">Semanal</SelectItem>
                    <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items Table */}
            {loadingItens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : itens.length > 0 ? (
              <div className="space-y-3">
                {/* Summary badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs gap-1">
                    <ClipboardCheck className="w-3 h-3" />
                    {itens.length} itens
                  </Badge>
                  {itens.filter(i => getStockStatus(i.estoque_sistema, i.estoque_minimo) === "zerado").length > 0 && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {itens.filter(i => getStockStatus(i.estoque_sistema, i.estoque_minimo) === "zerado").length} zerado(s)
                    </Badge>
                  )}
                  {itens.filter(i => getStockStatus(i.estoque_sistema, i.estoque_minimo) === "baixo").length > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {itens.filter(i => getStockStatus(i.estoque_sistema, i.estoque_minimo) === "baixo").length} estoque baixo
                    </Badge>
                  )}
                  {allCounted && totalDivergencias === 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Sem divergências
                    </Badge>
                  )}
                  {totalDivergencias > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {totalDivergencias} divergência(s)
                    </Badge>
                  )}
                </div>

                <div className="overflow-auto max-h-[400px] rounded-md border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px]">
                        <TableHead className="px-2 py-1.5">EPI</TableHead>
                        <TableHead className="px-2 py-1.5 text-center w-[60px]">Status</TableHead>
                        <TableHead className="px-2 py-1.5 text-right w-[80px]">Sistema</TableHead>
                        <TableHead className="px-2 py-1.5 text-center w-[100px]">Contagem Física</TableHead>
                        <TableHead className="px-2 py-1.5 text-center w-[90px]">Divergência</TableHead>
                        <TableHead className="px-2 py-1.5 w-[200px]">Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, idx) => {
                        const hasDivergencia = item.contagem_fisica !== null && item.divergencia !== 0;
                        const isCounted = item.contagem_fisica !== null;
                        const stockStatus = getStockStatus(item.estoque_sistema, item.estoque_minimo);
                        return (
                          <TableRow key={item.contrato_epi_id} className={`text-xs ${getRowHighlight(item)}`}>
                            <TableCell className="px-2 py-1.5 max-w-[180px]">
                              <span className="truncate block">{item.epi_nome}</span>
                              <div className="flex gap-1 items-center">
                                {item.tamanho && (
                                  <span className="text-[10px] text-muted-foreground">({item.tamanho})</span>
                                )}
                                {item.ca && (
                                  <span className="text-[10px] text-muted-foreground">C.A. {item.ca}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${
                                  stockStatus === "zerado"
                                    ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20"
                                    : stockStatus === "baixo"
                                    ? "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                                    : "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                                }`}
                              >
                                {stockStatus === "zerado" ? "Zerado" : stockStatus === "baixo" ? "Baixo" : "Ok"}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right font-semibold">
                              {item.estoque_sistema}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-center">
                              <Input
                                type="number"
                                min={0}
                                value={item.contagem_fisica ?? ""}
                                onChange={(e) => updateContagem(idx, e.target.value)}
                                className="h-7 text-xs text-center w-[70px] mx-auto"
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-center">
                              {isCounted ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 gap-0.5 ${
                                    item.divergencia === 0
                                      ? "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                                      : item.divergencia < 0
                                      ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20"
                                      : "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                                  }`}
                                >
                                  {item.divergencia === 0 ? (
                                    <><CheckCircle2 className="w-3 h-3" /> Bateu</>
                                  ) : item.divergencia < 0 ? (
                                    <><TrendingDown className="w-3 h-3" /> {item.divergencia}</>
                                  ) : (
                                    <><TrendingUp className="w-3 h-3" /> +{item.divergencia}</>
                                  )}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              {hasDivergencia ? (
                                <Input
                                  value={item.justificativa}
                                  onChange={(e) => updateJustificativa(idx, e.target.value)}
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
              </div>
            ) : contratoId ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum EPI cadastrado neste contrato.
              </div>
            ) : null}
          </div>

          {itens.length > 0 && (
            <DialogFooter className="mt-4">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetState(); }} className="text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleFinalize}
                disabled={!allCounted || saving}
                className="text-xs gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Finalizar e Ajustar Estoque
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
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
            <Button size="sm" onClick={executeFinalize} disabled={saving} className="text-xs gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
