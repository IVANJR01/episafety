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
import { Upload, Trash2, FileText, History } from "lucide-react";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { uploadToDrive } from "@/lib/googleDriveStorage";
import {
  ACAO_STATUS_LABEL, ACAO_STATUS_COLOR, MEDIDA_LABEL,
  PgrAcaoStatus, isAtrasada,
} from "@/lib/pgrAcoes";
import { PGR_HIERARQUIA_LABEL, PGR_HIERARQUIA_ORDENADA } from "@/lib/pgrTypes";

import ItemEficaciaPanel from "./ItemEficaciaPanel";

const MESES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  empresaId: string;
  pgrVersao: number;
  acaoId?: string | null;
  defaults?: any;          // valores sugeridos ao criar
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
  const [form, setForm] = useState<any>({
    descricao: "", tipo: "engenharia", responsavel_id: null, responsavel_nome: "",
    prazo: "", prioridade: 3, custo_estimado: "", inventario_item_id: null,
    what: "", why: "", where_local: "", how: "",
    corresponsavel_nome: "", responsavel_setor: "", quanto_texto: "",
    meses_execucao: [] as number[],
    objetivo: "", justificativa: "", hierarquia_medida: "",
    data_abertura: "", data_inicio: "", percentual_execucao: 0,
    indicador: "", meta_criterio: "", forma_acompanhamento: "",
    evidencia_esperada: "", recursos_necessarios: "",
    trabalhadores_atingidos: "", data_reavaliacao_residual: "",
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
        if (data) setForm({
          ...data,
          custo_estimado: data.custo_estimado ?? "",
          meses_execucao: data.meses_execucao ?? [],
          percentual_execucao: data.percentual_execucao ?? 0,
          trabalhadores_atingidos: data.trabalhadores_atingidos ?? "",
        });
      })();
    } else if (defaults) {
      setForm((f: any) => ({ ...f, ...defaults }));
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

  const { data: evidencias = [] } = useQuery({
    queryKey: ["pgr-evidencias", acaoId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_evidencias")
        .select("*").eq("acao_id", acaoId).order("created_at", { ascending: false });
      return data || [];
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

  const status: PgrAcaoStatus = acao?.status || "pendente";
  const isCritica = (acao?.prioridade ?? form.prioridade) >= 4;

  const salvar = async () => {
    if (!form.descricao || form.descricao.length < 3) { toast.error("Descrição obrigatória"); return; }
    setBusy(true);
    try {
      const payload: any = {
        pgr_id: pgrId, empresa_id: empresaId,
        inventario_item_id: form.inventario_item_id || null,
        descricao: form.descricao,
        tipo: form.tipo,
        responsavel_id: form.responsavel_id || null,
        responsavel_nome: form.responsavel_nome || null,
        prazo: form.prazo || null,
        prioridade: Number(form.prioridade) || 3,
        custo_estimado: form.custo_estimado !== "" ? Number(form.custo_estimado) : null,
        what: form.what || null, why: form.why || null,
        where_local: form.where_local || null, how: form.how || null,
        corresponsavel_nome: form.corresponsavel_nome || null,
        responsavel_setor: form.responsavel_setor || null,
        quanto_texto: form.quanto_texto || null,
        // Array vazio vira null: [] e "sem cronograma" são a mesma coisa aqui,
        // e null deixa isso explícito no banco.
        meses_execucao: (form.meses_execucao || []).length ? form.meses_execucao : null,
        objetivo: form.objetivo || null,
        justificativa: form.justificativa || null,
        hierarquia_medida: form.hierarquia_medida || null,
        data_abertura: form.data_abertura || null,
        data_inicio: form.data_inicio || null,
        percentual_execucao: Number(form.percentual_execucao) || 0,
        indicador: form.indicador || null,
        meta_criterio: form.meta_criterio || null,
        forma_acompanhamento: form.forma_acompanhamento || null,
        evidencia_esperada: form.evidencia_esperada || null,
        recursos_necessarios: form.recursos_necessarios || null,
        trabalhadores_atingidos:
          form.trabalhadores_atingidos !== "" ? Number(form.trabalhadores_atingidos) : null,
        data_reavaliacao_residual: form.data_reavaliacao_residual || null,
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
    } finally { setBusy(false); }
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
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
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
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
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
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
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
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const uploadEvidencia = async (file: File) => {
    if (!acaoId) { toast.error("Salve a ação antes de anexar evidências"); return; }
    setBusy(true);
    try {
      const folder = `pgr/v${pgrVersao}/acoes/${acaoId}`;
      const fname = `${Date.now()}-${file.name}`;
      const up = await uploadToDrive(file, folder, fname, { makePublic: false });
      const { error } = await (supabase.from as any)("pgr_acao_evidencias").insert({
        acao_id: acaoId, pgr_id: pgrId, empresa_id: empresaId,
        nome_arquivo: file.name,
        mime_type: file.type || "application/octet-stream",
        tamanho_bytes: file.size,
        drive_file_id: up.fileId,
        drive_view_link: up.webViewLink,
        drive_path: folder,
      });
      if (error) throw error;
      toast.success("Evidência anexada");
      qc.invalidateQueries({ queryKey: ["pgr-evidencias", acaoId] });
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally { setBusy(false); }
  };

  const removerEvidencia = async (id: string) => {
    if (!confirm("Remover esta evidência? (o arquivo permanecerá no Drive da empresa para auditoria)")) return;
    const { error } = await (supabase.from as any)("pgr_acao_evidencias").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Evidência removida"); qc.invalidateQueries({ queryKey: ["pgr-evidencias", acaoId] }); }
  };

  const editavel = pgrEditavel && canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {acaoId ? "Ação do Plano de Ação" : "Nova ação"}
            {acao && <Badge className={ACAO_STATUS_COLOR[status]} variant="outline">{ACAO_STATUS_LABEL[status]}</Badge>}
            {acao && isAtrasada(acao) && <Badge className={ACAO_STATUS_COLOR.atrasada} variant="outline">ATRASADA</Badge>}
          </DialogTitle>
          <DialogDescription>5W2H: What/Why/Where/When/Who/How/How much. Evidências vão para o Google Drive da empresa.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="5w2h">5W2H</TabsTrigger>
            <TabsTrigger value="acomp">Acompanhamento</TabsTrigger>
            <TabsTrigger value="eficacia" disabled={!acaoId}>Eficácia</TabsTrigger>
            <TabsTrigger value="evid" disabled={!acaoId}>Evidências ({evidencias.length})</TabsTrigger>
            <TabsTrigger value="hist" disabled={!acaoId}>Histórico ({historico.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3">
            <div>
              <Label className="text-xs">Descrição da ação *</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} disabled={!editavel} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de medida (hierarquia)</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })} disabled={!editavel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEDIDAS.map(m => <SelectItem key={m} value={m}>{MEDIDA_LABEL[m as keyof typeof MEDIDA_LABEL]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prioridade (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.prioridade}
                  onChange={(e) => setForm({ ...form, prioridade: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Responsável (nome)</Label>
                <Input value={form.responsavel_nome || ""} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Prazo (When)</Label>
                <Input type="date" value={form.prazo || ""} onChange={(e) => setForm({ ...form, prazo: e.target.value })} disabled={!editavel} />
                {acao?.prazo_original && acao.prazo_original !== acao.prazo && (
                  <div className="text-[11px] text-amber-700 mt-1">Prazo original: {new Date(acao.prazo_original+"T00:00:00").toLocaleDateString("pt-BR")}</div>
                )}
              </div>
              <div>
                <Label className="text-xs">Custo estimado (How much) — R$</Label>
                <Input type="number" step="0.01" value={form.custo_estimado} onChange={(e) => setForm({ ...form, custo_estimado: e.target.value })} disabled={!editavel} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="5w2h" className="space-y-3">
            <div>
              <Label className="text-xs">What — O que será feito</Label>
              <Textarea rows={2} value={form.what || ""} onChange={(e) => setForm({ ...form, what: e.target.value })} disabled={!editavel} />
            </div>
            <div>
              <Label className="text-xs">Why — Por que será feito</Label>
              <Textarea rows={2} value={form.why || ""} onChange={(e) => setForm({ ...form, why: e.target.value })} disabled={!editavel} />
            </div>
            <div>
              <Label className="text-xs">Where — Onde</Label>
              <Input value={form.where_local || ""} onChange={(e) => setForm({ ...form, where_local: e.target.value })} disabled={!editavel} />
            </div>
            <div>
              <Label className="text-xs">How — Como será feito</Label>
              <Textarea rows={3} value={form.how || ""} onChange={(e) => setForm({ ...form, how: e.target.value })} disabled={!editavel} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Who — Corresponsável</Label>
                <Input value={form.corresponsavel_nome || ""}
                  onChange={(e) => setForm({ ...form, corresponsavel_nome: e.target.value })}
                  disabled={!editavel} placeholder="Quem apoia a execução" />
              </div>
              <div>
                <Label className="text-xs">Where — Setor / GES</Label>
                <Input value={form.responsavel_setor || ""}
                  onChange={(e) => setForm({ ...form, responsavel_setor: e.target.value })}
                  disabled={!editavel} />
              </div>
            </div>

            <div>
              <Label className="text-xs">How much — Detalhamento do custo</Label>
              <Input value={form.quanto_texto || ""}
                onChange={(e) => setForm({ ...form, quanto_texto: e.target.value })}
                disabled={!editavel}
                placeholder="Ex.: 2 orçamentos, mão de obra própria, sem custo direto" />
            </div>

            {/* Cronograma mensal do 5W2H. O plano NÃO se resume a marcações "X":
                as datas, marcos e prazo continuam sendo a fonte de controle —
                isto é a visão de calendário exigida pela planilha do cliente. */}
            <div>
              <Label className="text-xs">When — Meses previstos de execução</Label>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 mt-1">
                {MESES.map((m, i) => {
                  const num = i + 1;
                  const marcado = (form.meses_execucao || []).includes(num);
                  return (
                    <button
                      key={m} type="button" disabled={!editavel}
                      onClick={() => {
                        const atual: number[] = form.meses_execucao || [];
                        setForm({
                          ...form,
                          meses_execucao: marcado
                            ? atual.filter((x) => x !== num)
                            : [...atual, num].sort((a, b) => a - b),
                        });
                      }}
                      className={`text-[10px] py-1.5 rounded border transition ${
                        marcado
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/40 hover:bg-muted"
                      } ${!editavel ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="acomp" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Concluir a ação não encerra o risco: a verificação de eficácia é aberta
              automaticamente e o risco residual só é confirmado depois dela.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Objetivo</Label>
                <Input value={form.objetivo || ""}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Hierarquia da medida (NR-01)</Label>
                <Select value={form.hierarquia_medida || ""}
                  onValueChange={(v) => setForm({ ...form, hierarquia_medida: v })} disabled={!editavel}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PGR_HIERARQUIA_ORDENADA.map((h) => (
                      <SelectItem key={h} value={h}>{PGR_HIERARQUIA_LABEL[h]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Justificativa</Label>
              <Textarea rows={2} value={form.justificativa || ""}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })} disabled={!editavel} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Data de abertura</Label>
                <Input type="date" value={form.data_abertura || ""}
                  onChange={(e) => setForm({ ...form, data_abertura: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Data de início</Label>
                <Input type="date" value={form.data_inicio || ""}
                  onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Execução (%)</Label>
                <Input type="number" min={0} max={100} value={form.percentual_execucao ?? 0}
                  onChange={(e) => setForm({ ...form, percentual_execucao: e.target.value })}
                  disabled={!editavel} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Indicador</Label>
                <Input value={form.indicador || ""}
                  onChange={(e) => setForm({ ...form, indicador: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Meta / critério de aceitação</Label>
                <Input value={form.meta_criterio || ""}
                  onChange={(e) => setForm({ ...form, meta_criterio: e.target.value })} disabled={!editavel} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Forma de acompanhamento</Label>
                <Input value={form.forma_acompanhamento || ""}
                  onChange={(e) => setForm({ ...form, forma_acompanhamento: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Evidência esperada</Label>
                <Input value={form.evidencia_esperada || ""}
                  onChange={(e) => setForm({ ...form, evidencia_esperada: e.target.value })} disabled={!editavel} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Recursos necessários</Label>
                <Input value={form.recursos_necessarios || ""}
                  onChange={(e) => setForm({ ...form, recursos_necessarios: e.target.value })} disabled={!editavel} />
              </div>
              <div>
                <Label className="text-xs">Trabalhadores atingidos</Label>
                <Input type="number" min={0} value={form.trabalhadores_atingidos ?? ""}
                  onChange={(e) => setForm({ ...form, trabalhadores_atingidos: e.target.value })}
                  disabled={!editavel} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Eleva a prioridade da ação, não a pontuação do risco.
                </p>
              </div>
              <div>
                <Label className="text-xs">Reavaliar risco residual em</Label>
                <Input type="date" value={form.data_reavaliacao_residual || ""}
                  onChange={(e) => setForm({ ...form, data_reavaliacao_residual: e.target.value })}
                  disabled={!editavel} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="eficacia">
            <ItemEficaciaPanel acaoId={acaoId || null} canEdit={editavel} />
          </TabsContent>

          <TabsContent value="evid" className="space-y-3">
            {editavel && (
              <div className="border-2 border-dashed rounded-md p-4 text-center">
                <input type="file" id="pgr-evid-file" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidencia(f); e.currentTarget.value = ""; }} />
                <label htmlFor="pgr-evid-file">
                  <Button variant="outline" asChild disabled={busy}>
                    <span><Upload className="h-4 w-4 mr-2" /> Anexar evidência (Drive da empresa)</span>
                  </Button>
                </label>
                <p className="text-[11px] text-muted-foreground mt-2">Pasta: <code>pgr/v{pgrVersao}/acoes/{acaoId?.slice(0,8)}…</code> · arquivos não públicos.</p>
              </div>
            )}
            {evidencias.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">Nenhuma evidência anexada.</p>
            ) : (
              <ul className="divide-y border rounded-md">
                {evidencias.map((ev: any) => (
                  <li key={ev.id} className="flex items-center justify-between p-2 text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <a href={ev.drive_view_link} target="_blank" rel="noreferrer" className="truncate hover:underline">{ev.nome_arquivo}</a>
                      <span className="text-[11px] text-muted-foreground shrink-0">{ev.tamanho_bytes ? Math.round(ev.tamanho_bytes/1024)+" KB" : ""}</span>
                    </div>
                    {editavel && (
                      <Button size="icon" variant="ghost" onClick={() => removerEvidencia(ev.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="hist">
            {historico.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">Sem histórico.</p>
            ) : (
              <ul className="space-y-2">
                {historico.map((h: any) => (
                  <li key={h.id} className="border rounded p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium flex items-center gap-1">
                        <History className="h-3 w-3" />
                        {h.campo_alterado === "status" ? `${h.status_anterior || "—"} → ${h.status_novo}` : `${h.campo_alterado}: ${h.valor_anterior ?? "—"} → ${h.valor_novo ?? "—"}`}
                      </div>
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {h.motivo && <div className="text-muted-foreground mt-1">{h.motivo}</div>}
                    {h.user_email && <div className="text-[10px] text-muted-foreground">por {h.user_email}</div>}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {acaoId && editavel && (
          <div className="border-t pt-3 flex flex-wrap gap-2">
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
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {editavel && <Button onClick={salvar} disabled={busy}>{acaoId ? "Salvar alterações" : "Criar ação"}</Button>}
        </DialogFooter>

        {/* Concluir */}
        <Dialog open={showConcluir} onOpenChange={setShowConcluir}>
          <DialogContent>
            <DialogHeader><DialogTitle>Concluir ação</DialogTitle><DialogDescription>Informe a data efetiva da conclusão.</DialogDescription></DialogHeader>
            <Label className="text-xs">Data de conclusão *</Label>
            <Input type="date" value={dataConcl} onChange={(e) => setDataConcl(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConcluir(false)}>Cancelar</Button>
              <Button onClick={concluir} disabled={busy}>Confirmar conclusão</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancelar */}
        <Dialog open={showCancelar} onOpenChange={setShowCancelar}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cancelar ação</DialogTitle><DialogDescription>Informe o motivo do cancelamento.</DialogDescription></DialogHeader>
            <Label className="text-xs">Motivo *</Label>
            <Textarea rows={3} value={motivoCanc} onChange={(e) => setMotivoCanc(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelar(false)}>Voltar</Button>
              <Button onClick={cancelar} disabled={busy}>Cancelar ação</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prorrogar */}
        <Dialog open={showProrrog} onOpenChange={setShowProrrog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Prorrogar prazo</DialogTitle><DialogDescription>Informe o novo prazo e a justificativa.</DialogDescription></DialogHeader>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Novo prazo *</Label>
                <Input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Justificativa *</Label>
                <Textarea rows={3} value={justProrrog} onChange={(e) => setJustProrrog(e.target.value)} />
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
