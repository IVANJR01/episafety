import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, History, X, Pencil } from "lucide-react";
import MfaActionButton from "@/components/cat/MfaActionButton";
import {
  ACAO_STATUS_LABEL, ACAO_STATUS_COLOR, MEDIDA_LABEL,
  PgrAcaoStatus, isAtrasada,
} from "@/lib/pgrAcoes";

const MESES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  empresaId: string;
  pgrVersao: number;
  acaoId?: string | null;
  defaults?: any;
  canEdit: boolean;
  pgrEditavel: boolean;
  onSaved: () => void;
}

const MEDIDAS = ["eliminacao","substituicao","engenharia","administrativa","epi"];

export default function PgrAcaoDialog({
  open, onOpenChange, pgrId, empresaId, pgrVersao, acaoId, defaults, canEdit, pgrEditavel, onSaved,
}: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [isCustomWhere, setIsCustomWhere] = useState(false);
  const [isCustomGes, setIsCustomGes] = useState(false);
  const [form, setForm] = useState<any>({
    descricao: "", tipo: "engenharia", responsavel_id: null, responsavel_nome: "",
    prazo: "", prioridade: 3, custo_estimado: "", inventario_item_id: null,
    what: "", why: "", where_local: "", how: "",
    corresponsavel_nome: "", responsavel_setor: "", quanto_texto: "",
    meses_execucao: [] as number[],
  });

  const [showProrrog, setShowProrrog] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState("");
  const [justProrrog, setJustProrrog] = useState("");

  const [showConcluir, setShowConcluir] = useState(false);
  const [dataConcl, setDataConcl] = useState(new Date().toISOString().slice(0,10));

  const [showCancelar, setShowCancelar] = useState(false);
  const [motivoCanc, setMotivoCanc] = useState("");

  useEffect(() => {
    if (!open) return;
    if (acaoId) {
      (async () => {
        const { data } = await (supabase.from as any)("pgr_acoes").select("*").eq("id", acaoId).maybeSingle();
        if (data) {
          let meses = data.meses_execucao ?? [];
          if ((!meses || meses.length === 0) && data.prazo) {
            const m = parseInt(String(data.prazo).slice(5, 7), 10);
            if (!isNaN(m) && m >= 1 && m <= 12) meses = [m];
          }
          setForm({
            ...data,
            what: data.what || data.descricao || "",
            custo_estimado: data.custo_estimado ?? "",
            meses_execucao: meses,
          });
        }
      })();
    } else if (defaults) {
      let mesesIniciais = defaults.meses_execucao || [];
      if (mesesIniciais.length === 0 && defaults.prazo) {
        const m = parseInt(String(defaults.prazo).slice(5, 7), 10);
        if (!isNaN(m) && m >= 1 && m <= 12) mesesIniciais = [m];
      }
      setForm((f: any) => ({
        ...f,
        ...defaults,
        what: defaults.what || defaults.descricao || "",
        meses_execucao: mesesIniciais,
      }));
    }
  }, [open, acaoId, defaults]);

  const { data: acao } = useQuery({
    queryKey: ["pgr-acao", acaoId],
    queryFn: async () => {
      if (!acaoId) return null;
      const { data } = await (supabase.from as any)("pgr_acoes").select("*").eq("id", acaoId).maybeSingle();
      return data;
    },
    enabled: !!acaoId && open,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["pgr-acao-hist", acaoId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_historico")
        .select("*").eq("acao_id", acaoId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!acaoId && open,
  });

  const { data: listaSetoresGes = [] } = useQuery({
    queryKey: ["pgr-setores-ges-list", empresaId],
    queryFn: async () => {
      if (!empresaId || !open) return [];
      const [rsGes, rsSetores] = await Promise.all([
        (supabase.from as any)("ghe_ges").select("nome, codigo").eq("empresa_id", empresaId),
        (supabase.from as any)("sst_setores").select("nome").eq("empresa_id", empresaId)
      ]);
      const nomes = new Set<string>();
      (rsGes.data || []).forEach((g: any) => { if (g.nome) nomes.add(g.nome); if (g.codigo) nomes.add(g.codigo); });
      (rsSetores.data || []).forEach((s: any) => { if (s.nome) nomes.add(s.nome); });
      return Array.from(nomes).sort();
    },
    enabled: !!empresaId && open,
  });

  const status: PgrAcaoStatus = acao?.status || "pendente";
  const isCritica = (acao?.prioridade ?? form.prioridade) >= 4;

  const salvar = async () => {
    const desc = (form.what || form.descricao || "").trim();
    if (!desc || desc.length < 3) {
      toast.error("Descrição da ação (What) é obrigatória (mínimo 3 caracteres)");
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        inventario_item_id: form.inventario_item_id || null,
        descricao: desc,
        tipo: form.tipo || "engenharia",
        responsavel_id: form.responsavel_id || null,
        responsavel_nome: form.responsavel_nome?.trim() || null,
        prazo: form.prazo || null,
        prioridade: Number(form.prioridade) || 3,
        custo_estimado: form.custo_estimado !== "" && form.custo_estimado != null ? Number(form.custo_estimado) : null,
        what: desc,
        why: form.why?.trim() || null,
        where_local: form.where_local?.trim() || null,
        how: form.how?.trim() || null,
        corresponsavel_nome: form.corresponsavel_nome?.trim() || null,
        responsavel_setor: form.responsavel_setor?.trim() || null,
        quanto_texto: form.quanto_texto?.trim() || null,
        meses_execucao: (form.meses_execucao || []).length ? form.meses_execucao : null,
      };

      if (acaoId) {
        const { error } = await (supabase.from as any)("pgr_acoes").update(payload).eq("id", acaoId);
        if (error) throw error;
        toast.success("Ação atualizada");
      } else {
        const { error } = await (supabase.from as any)("pgr_acoes").insert(payload);
        if (error) throw error;
        toast.success("Ação criada");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const trocarStatus = async (novo: PgrAcaoStatus) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("pgr_acao_set_status", {
        _acao_id: acaoId, _novo_status: novo,
      });
      if (error) throw error;
      toast.success(`Status: ${ACAO_STATUS_LABEL[novo]}`);
      onSaved();
      qc.invalidateQueries({ queryKey: ["pgr-acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["pgr-acao-hist", acaoId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const concluir = async () => {
    if (!dataConcl) { toast.error("Informe a data de conclusão"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("pgr_acao_set_status", {
        _acao_id: acaoId, _novo_status: "concluida", _data_conclusao: dataConcl,
      });
      if (error) throw error;
      toast.success("Ação concluída");
      setShowConcluir(false); onSaved();
      qc.invalidateQueries({ queryKey: ["pgr-acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["pgr-acao-hist", acaoId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async () => {
    if (motivoCanc.trim().length < 5) { toast.error("Motivo obrigatório (≥5 caracteres)"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("pgr_acao_set_status", {
        _acao_id: acaoId, _novo_status: "cancelada", _motivo: motivoCanc.trim(),
      });
      if (error) throw error;
      toast.success("Ação cancelada");
      setShowCancelar(false); setMotivoCanc(""); onSaved();
      qc.invalidateQueries({ queryKey: ["pgr-acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["pgr-acao-hist", acaoId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const prorrogar = async () => {
    if (!novoPrazo) { toast.error("Informe o novo prazo"); return; }
    if (justProrrog.trim().length < 5) { toast.error("Justificativa obrigatória"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("pgr_acao_set_status", {
        _acao_id: acaoId, _novo_status: acao?.status || "pendente",
        _motivo: justProrrog.trim(), _novo_prazo: novoPrazo,
      });
      if (error) throw error;
      toast.success("Prazo prorrogado");
      setShowProrrog(false); setNovoPrazo(""); setJustProrrog(""); onSaved();
      qc.invalidateQueries({ queryKey: ["pgr-acao", acaoId] });
      qc.invalidateQueries({ queryKey: ["pgr-acao-hist", acaoId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const excluirAcao = async () => {
    if (!confirm("Tem certeza que deseja excluir esta ação do plano de ação?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from as any)("pgr_acoes").delete().eq("id", acaoId);
      if (error) throw error;
      toast.success("Ação excluída com sucesso");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir ação");
    } finally {
      setBusy(false);
    }
  };

  const editavel = pgrEditavel && canEdit;

  const bloco5w2h = (
    <div className="space-y-4">
      {/* WHAT */}
      <div>
        <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          What — O que será feito (Descrição da ação) *
        </Label>
        <Textarea
          rows={2}
          value={form.what || form.descricao || ""}
          onChange={(e) => setForm({ ...form, what: e.target.value, descricao: e.target.value })}
          disabled={!editavel}
          placeholder="Descreva a ação de melhoria ou prevenção..."
          className="mt-1"
        />
      </div>

      {/* MEDIDA & WHY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <Label className="text-xs font-medium">Tipo de medida (hierarquia NR-01)</Label>
          <Select
            value={form.tipo || "engenharia"}
            onValueChange={(v) => setForm({ ...form, tipo: v })}
            disabled={!editavel}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEDIDAS.map(m => (
                <SelectItem key={m} value={m}>{MEDIDA_LABEL[m as keyof typeof MEDIDA_LABEL]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium">Why — Por que será feito</Label>
          <Input
            value={form.why || ""}
            onChange={(e) => setForm({ ...form, why: e.target.value })}
            disabled={!editavel}
            placeholder="Motivo / justificativa da medida..."
            className="mt-1"
          />
        </div>
      </div>

      {/* WHERE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <Label className="text-xs font-medium">Where — Local / Ambiente</Label>
          <div className="mt-1">
            {isCustomWhere ? (
              <div className="flex items-center gap-2">
                <Input
                  value={form.where_local || ""}
                  onChange={(e) => setForm({ ...form, where_local: e.target.value })}
                  disabled={!editavel}
                  autoFocus
                  placeholder="Digite o local livremente..."
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsCustomWhere(false)} disabled={!editavel}>
                  <X className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={form.where_local ? (listaSetoresGes.includes(form.where_local) ? form.where_local : "outro") : ""}
                  onValueChange={(val) => {
                    if (val === "outro") { setIsCustomWhere(true); }
                    else setForm({ ...form, where_local: val });
                  }}
                  disabled={!editavel}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o local/ambiente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {listaSetoresGes.map((i: string) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    <SelectItem value="outro">— Outro local (texto livre) —</SelectItem>
                  </SelectContent>
                </Select>
                {form.where_local && !listaSetoresGes.includes(form.where_local) && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setIsCustomWhere(true)} disabled={!editavel} title="Editar texto livre">
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium">Where — Setor / GES</Label>
          <div className="mt-1">
            {isCustomGes ? (
              <div className="flex items-center gap-2">
                <Input
                  value={form.responsavel_setor || ""}
                  onChange={(e) => setForm({ ...form, responsavel_setor: e.target.value })}
                  disabled={!editavel}
                  autoFocus
                  placeholder="Digite o setor..."
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsCustomGes(false)} disabled={!editavel}>
                  <X className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={form.responsavel_setor ? (listaSetoresGes.includes(form.responsavel_setor) ? form.responsavel_setor : "outro") : ""}
                  onValueChange={(val) => {
                    if (val === "outro") { setIsCustomGes(true); }
                    else setForm({ ...form, responsavel_setor: val });
                  }}
                  disabled={!editavel}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o Setor/GES..." />
                  </SelectTrigger>
                  <SelectContent>
                    {listaSetoresGes.map((i: string) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    <SelectItem value="outro">— Outro setor (texto livre) —</SelectItem>
                  </SelectContent>
                </Select>
                {form.responsavel_setor && !listaSetoresGes.includes(form.responsavel_setor) && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setIsCustomGes(true)} disabled={!editavel} title="Editar texto livre">
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HOW */}
      <div>
        <Label className="text-xs font-medium">How — Como será feito</Label>
        <Textarea
          rows={2}
          value={form.how || ""}
          onChange={(e) => setForm({ ...form, how: e.target.value })}
          disabled={!editavel}
          placeholder="Método, etapas de implantação, procedimentos..."
          className="mt-1"
        />
      </div>

      {/* WHO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <Label className="text-xs font-medium">Who — Responsável (nome)</Label>
          <Input
            value={form.responsavel_nome || ""}
            onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })}
            disabled={!editavel}
            placeholder="Responsável pela execução"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Who — Corresponsável</Label>
          <Input
            value={form.corresponsavel_nome || ""}
            onChange={(e) => setForm({ ...form, corresponsavel_nome: e.target.value })}
            disabled={!editavel}
            placeholder="Quem apoia a execução"
            className="mt-1"
          />
        </div>
      </div>

      {/* WHEN & HOW MUCH */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 [&>*]:min-w-0">
        <div>
          <Label className="text-xs font-medium">When — Prazo final</Label>
          <Input
            type="date"
            value={form.prazo || ""}
            onChange={(e) => {
              const novoPrazo = e.target.value;
              let novosMeses = [...(form.meses_execucao || [])];
              if (novoPrazo) {
                const mes = parseInt(novoPrazo.slice(5, 7), 10);
                if (!isNaN(mes) && mes >= 1 && mes <= 12) {
                  if (!novosMeses.includes(mes)) {
                    novosMeses = [...novosMeses, mes].sort((a, b) => a - b);
                  }
                }
              }
              setForm({ ...form, prazo: novoPrazo, meses_execucao: novosMeses });
            }}
            disabled={!editavel}
            className="mt-1"
          />
          {acao?.prazo_original && acao.prazo_original !== acao.prazo && (
            <div className="text-[11px] text-amber-700 mt-1 font-medium">
              Prazo original: {new Date(acao.prazo_original + "T00:00:00").toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium">How much — Custo estimado (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.custo_estimado}
            onChange={(e) => setForm({ ...form, custo_estimado: e.target.value })}
            disabled={!editavel}
            placeholder="0.00"
            className="mt-1"
          />
        </div>
      </div>

      {/* DETALHAMENTO DO CUSTO */}
      <div>
        <Label className="text-xs font-medium">How much — Detalhamento do custo</Label>
        <Input
          value={form.quanto_texto || ""}
          onChange={(e) => setForm({ ...form, quanto_texto: e.target.value })}
          disabled={!editavel}
          placeholder="Ex.: Recursos próprios, cotação de 3 orçamentos, sem custo direto..."
          className="mt-1"
        />
      </div>

      {/* MESES PREVISTOS (CRONOGRAMA DO 5W2H) */}
      <div>
        <Label className="text-xs font-medium">When — Meses previstos de execução</Label>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mt-1.5">
          {MESES.map((m, i) => {
            const num = i + 1;
            const marcado = (form.meses_execucao || []).includes(num);
            return (
              <button
                key={m}
                type="button"
                disabled={!editavel}
                onClick={() => {
                  const atual: number[] = form.meses_execucao || [];
                  setForm({
                    ...form,
                    meses_execucao: marcado
                      ? atual.filter((x) => x !== num)
                      : [...atual, num].sort((a, b) => a - b),
                  });
                }}
                className={`text-[10px] py-2 rounded border transition ${
                  marcado
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                    : "bg-muted/40 hover:bg-muted"
                } ${!editavel ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={[
        "w-[calc(100vw-1rem)] max-h-[92vh] overflow-y-auto overflow-x-hidden",
        "sm:w-[calc(100vw-4rem)] sm:max-w-3xl sm:max-h-[92vh]",
        "lg:max-w-4xl",
      ].join(" ")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {acaoId ? "Ação do Plano de Ação" : "Nova Ação"}
            {acao && <Badge className={ACAO_STATUS_COLOR[status]} variant="outline">{ACAO_STATUS_LABEL[status]}</Badge>}
            {acao && isAtrasada(acao) && <Badge className={ACAO_STATUS_COLOR.atrasada} variant="outline">ATRASADA</Badge>}
          </DialogTitle>
          <DialogDescription>
            Metodologia 5W2H: What, Why, Where, How, Who, When e How much.
          </DialogDescription>
        </DialogHeader>

        {!acaoId ? (
          <div>{bloco5w2h}</div>
        ) : (
          <Tabs defaultValue="5w2h">
            <TabsList className="w-full justify-start border-b rounded-none pb-0 h-auto bg-transparent p-0 gap-2">
              <TabsTrigger
                value="5w2h"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              >
                5W2H
              </TabsTrigger>
              <TabsTrigger
                value="hist"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
              >
                Histórico ({historico.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="5w2h" className="mt-4">
              {bloco5w2h}
            </TabsContent>

            <TabsContent value="hist" className="mt-4">
              {historico.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">Nenhuma alteração registrada no histórico.</p>
              ) : (
                <ul className="space-y-2">
                  {historico.map((h: any) => (
                    <li key={h.id} className="border rounded-lg p-2.5 text-xs bg-muted/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <History className="h-3.5 w-3.5 text-primary" />
                          {h.campo_alterado === "status"
                            ? `Status: ${h.status_anterior || "—"} → ${h.status_novo}`
                            : `${h.campo_alterado}: ${h.valor_anterior ?? "—"} → ${h.valor_novo ?? "—"}`}
                        </div>
                        <span className="text-muted-foreground text-[11px]">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {h.motivo && <div className="text-muted-foreground mt-1 text-[11px] italic">{h.motivo}</div>}
                      {h.user_email && <div className="text-[10px] text-muted-foreground/80 mt-0.5">por {h.user_email}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}

        {acaoId && editavel && (
          <div className="border-t pt-3 flex flex-wrap gap-2 items-center">
            {status !== "em_andamento" && status !== "concluida" && status !== "cancelada" && (
              <Button size="sm" variant="outline" onClick={() => trocarStatus("em_andamento")} disabled={busy}>Iniciar</Button>
            )}
            {status !== "concluida" && status !== "cancelada" && (
              <>
                {isCritica
                  ? <MfaActionButton size="sm" onClick={() => setShowConcluir(true)}>Concluir</MfaActionButton>
                  : <Button size="sm" onClick={() => setShowConcluir(true)}>Concluir</Button>}
                {isCritica
                  ? <MfaActionButton size="sm" variant="outline" onClick={() => setShowProrrog(true)}>Prorrogar prazo</MfaActionButton>
                  : <Button size="sm" variant="outline" onClick={() => setShowProrrog(true)}>Prorrogar prazo</Button>}
                {isCritica
                  ? <MfaActionButton size="sm" variant="outline" onClick={() => setShowCancelar(true)}>Cancelar ação</MfaActionButton>
                  : <Button size="sm" variant="outline" onClick={() => setShowCancelar(true)}>Cancelar ação</Button>}
              </>
            )}
            {(status === "concluida" || status === "cancelada") && (
              <Button size="sm" variant="outline" onClick={() => trocarStatus("pendente")} disabled={busy}>Reabrir</Button>
            )}
            <Button size="sm" variant="ghost" onClick={excluirAcao} disabled={busy} className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir ação
            </Button>
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {editavel && <Button onClick={salvar} disabled={busy}>{acaoId ? "Salvar alterações" : "Criar ação"}</Button>}
        </DialogFooter>

        {/* Modal Concluir */}
        <Dialog open={showConcluir} onOpenChange={setShowConcluir}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Concluir ação</DialogTitle>
              <DialogDescription>Informe a data efetiva da conclusão.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label className="text-xs">Data de conclusão *</Label>
              <Input type="date" value={dataConcl} onChange={(e) => setDataConcl(e.target.value)} className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConcluir(false)}>Cancelar</Button>
              <Button onClick={concluir} disabled={busy}>Confirmar conclusão</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Cancelar */}
        <Dialog open={showCancelar} onOpenChange={setShowCancelar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar ação</DialogTitle>
              <DialogDescription>Informe o motivo do cancelamento.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label className="text-xs">Motivo *</Label>
              <Textarea rows={3} value={motivoCanc} onChange={(e) => setMotivoCanc(e.target.value)} className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelar(false)}>Voltar</Button>
              <Button onClick={cancelar} disabled={busy}>Cancelar ação</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Prorrogar */}
        <Dialog open={showProrrog} onOpenChange={setShowProrrog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Prorrogar prazo</DialogTitle>
              <DialogDescription>Informe o novo prazo e a justificativa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Novo prazo *</Label>
                <Input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Justificativa *</Label>
                <Textarea rows={3} value={justProrrog} onChange={(e) => setJustProrrog(e.target.value)} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProrrog(false)}>Cancelar</Button>
              <Button onClick={prorrogar} disabled={busy}>Prorrogar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
